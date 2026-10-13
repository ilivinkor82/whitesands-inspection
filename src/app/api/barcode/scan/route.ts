import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { kstDayRange } from "@/lib/datetime";
import { getCurrentAccount } from "@/lib/session";

export const dynamic = "force-dynamic";

const ScanSchema = z.object({
  orderNo: z.string().min(1),
  productCode: z.string().min(1),
  productName: z.string(),
  colorName: z.string().min(1),
  sizeName: z.string().min(1),
  scannedBarcode: z.string().min(1),
});

async function todayCounts(orderNo: string) {
  const { start, end } = kstDayRange();
  const [matchCount, mismatchCount] = await Promise.all([
    prisma.scanLog.count({ where: { orderNo, result: "MATCH", scannedAt: { gte: start, lt: end } } }),
    prisma.scanLog.count({ where: { orderNo, result: "MISMATCH", scannedAt: { gte: start, lt: end } } }),
  ]);
  return { matchCount, mismatchCount };
}

type OrderLineUpdateStatus = "UPDATED" | "NOT_FOUND" | "AMBIGUOUS";

/**
 * 스캔 1건 = 현물 1개 검수 — 해당 오더의 OrderLine(검수수량/불량수량)에 1씩 반영한다.
 * 바코드 레지스트리는 컬러를 "컬러명"(예: 애쉬퍼플)으로만 들고 있고, OrderLine은
 * 컬러코드(SKU)가 식별키라서 둘을 바로 조인할 수 없다 — 대신 OrderLine에도 같이 있는
 * colorName으로 (오더번호+상품코드+컬러명) 매칭한다. 일치하는 행이 정확히 하나일 때만
 * 반영하고, 0건/2건 이상이면 애매하니 건드리지 않고 상태만 알려준다.
 *
 * find-then-write(읽고 +1해서 쓰기)는 짧은 간격으로 스캔이 몰리면 두 요청이 같은
 * 값을 읽고 둘 다 +1만 반영되는 lost-update가 실제로 발생했다 — DB가 직접
 * COALESCE(col,0)+1을 계산하는 원자적 UPDATE로 바꿔서 경쟁 조건 자체를 없앤다.
 */
async function reflectToOrderLine(
  orderNo: string,
  productCode: string,
  colorName: string,
  isMatch: boolean,
  accountId: string | null
): Promise<OrderLineUpdateStatus> {
  const candidates = await prisma.orderLine.findMany({
    where: { orderNo, productCode, colorName },
    select: { id: true },
  });

  if (candidates.length === 0) return "NOT_FOUND";
  if (candidates.length > 1) return "AMBIGUOUS";

  const targetId = candidates[0].id;
  if (isMatch) {
    await prisma.$executeRaw`
      UPDATE "OrderLine"
      SET "inspectedQty" = COALESCE("inspectedQty", 0) + 1,
          "updatedBy" = ${accountId},
          "updatedAt" = now()
      WHERE id = ${targetId}
    `;
  } else {
    await prisma.$executeRaw`
      UPDATE "OrderLine"
      SET "inspectedQty" = COALESCE("inspectedQty", 0) + 1,
          "defectQty" = COALESCE("defectQty", 0) + 1,
          "updatedBy" = ${accountId},
          "updatedAt" = now()
      WHERE id = ${targetId}
    `;
  }
  return "UPDATED";
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = ScanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "입력값이 올바르지 않습니다" }, { status: 400 });
  }

  const { orderNo, productCode, productName, colorName, sizeName, scannedBarcode } = parsed.data;
  const account = await getCurrentAccount();
  const accountId = account?.accountId ?? null;

  const product = await prisma.barcodeProduct.findUnique({
    where: { barcodeProductKey: { productCode, colorName, sizeName } },
  });

  const expectedBarcode = product?.barcode1 ?? null;
  const matches = product != null && (scannedBarcode === product.barcode1 || (!!product.barcode2 && scannedBarcode === product.barcode2));
  const result = matches ? "MATCH" : "MISMATCH";

  await prisma.scanLog.create({
    data: { orderNo, productCode, productName, colorName, sizeName, scannedBarcode, expectedBarcode, result, scannedBy: accountId },
  });

  const orderLineStatus = await reflectToOrderLine(orderNo, productCode, colorName, matches, accountId);
  const counts = await todayCounts(orderNo);

  return NextResponse.json({ result, expectedBarcode, orderLineStatus, ...counts });
}
