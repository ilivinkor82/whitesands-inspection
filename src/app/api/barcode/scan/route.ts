import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { kstDayRange } from "@/lib/datetime";

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
 */
async function reflectToOrderLine(
  orderNo: string,
  productCode: string,
  colorName: string,
  isMatch: boolean
): Promise<OrderLineUpdateStatus> {
  const candidates = await prisma.orderLine.findMany({
    where: { orderNo, productCode, colorName },
  });

  if (candidates.length === 0) return "NOT_FOUND";
  if (candidates.length > 1) return "AMBIGUOUS";

  const target = candidates[0];
  await prisma.orderLine.update({
    where: { id: target.id },
    data: {
      inspectedQty: (target.inspectedQty ?? 0) + 1,
      defectQty: isMatch ? target.defectQty : (target.defectQty ?? 0) + 1,
    },
  });
  return "UPDATED";
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = ScanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "입력값이 올바르지 않습니다" }, { status: 400 });
  }

  const { orderNo, productCode, productName, colorName, sizeName, scannedBarcode } = parsed.data;

  const product = await prisma.barcodeProduct.findUnique({
    where: { barcodeProductKey: { productCode, colorName, sizeName } },
  });

  const expectedBarcode = product?.barcode1 ?? null;
  const matches = product != null && (scannedBarcode === product.barcode1 || (!!product.barcode2 && scannedBarcode === product.barcode2));
  const result = matches ? "MATCH" : "MISMATCH";

  await prisma.scanLog.create({
    data: { orderNo, productCode, productName, colorName, sizeName, scannedBarcode, expectedBarcode, result },
  });

  const orderLineStatus = await reflectToOrderLine(orderNo, productCode, colorName, matches);
  const counts = await todayCounts(orderNo);

  return NextResponse.json({ result, expectedBarcode, orderLineStatus, ...counts });
}
