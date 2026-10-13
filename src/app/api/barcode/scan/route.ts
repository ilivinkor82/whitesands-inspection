import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
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

type OrderLineUpdateStatus = "UPDATED" | "NOT_FOUND" | "AMBIGUOUS";

/**
 * 스캔 1건 = 현물 1개 검수 — 해당 오더의 OrderLine에 반영한다. "검수수량"은 바코드검수수량
 * (scannedQty)과 제품검수수량(inspectedQty) 두 칸으로 나뉘어 있는데, 스캔은 바코드검수수량만
 * 건드린다 — 제품검수수량은 관리자가 현물/엑셀 기준으로 직접 세는 별도 숫자라 스캔이
 * 건드리면 두 숫자를 대조할 수 없게 된다. 불량수량은 (아직은) 한 칸을 공유한다.
 *
 * 바코드 레지스트리는 컬러를 "컬러명"(예: 애쉬퍼플)으로만 들고 있고, OrderLine은
 * 컬러코드(SKU)가 식별키라서 둘을 바로 조인할 수 없다 — 대신 OrderLine에도 같이 있는
 * colorName으로 (오더번호+상품코드+컬러명) 매칭한다. 일치하는 행이 정확히 하나일 때만
 * 반영하고, 0건/2건 이상이면 애매하니 건드리지 않고 상태만 알려준다.
 *
 * 조회(후보 찾기)와 반영(UPDATE)을 CTE 하나로 묶어서 왕복 1번으로 끝낸다 — 예전엔
 * find-then-write 두 번의 왕복이었는데, 그 사이 간격에서 짧게 몰리는 스캔끼리
 * lost-update가 실제로 발생한 적이 있다. candidates가 정확히 1건일 때만 WHERE 조건이
 * 참이 되게 해서, 0건/2건 이상이면 UPDATE 자체가 조용히 아무 것도 안 건드리고
 * candidateCount로 상태를 구분한다 — 그래서 여전히 원자적이다.
 */
async function reflectToOrderLine(
  orderNo: string,
  productCode: string,
  colorName: string,
  isMatch: boolean,
  accountId: string | null
): Promise<OrderLineUpdateStatus> {
  const rows = await prisma.$queryRaw<{ candidateCount: bigint; updatedCount: bigint }[]>`
    WITH candidates AS (
      SELECT id FROM "OrderLine"
      WHERE "orderNo" = ${orderNo} AND "productCode" = ${productCode} AND "colorName" = ${colorName}
    ),
    updated AS (
      UPDATE "OrderLine" o
      SET "scannedQty" = COALESCE(o."scannedQty", 0) + 1,
          "defectQty" = CASE WHEN ${isMatch} THEN o."defectQty" ELSE COALESCE(o."defectQty", 0) + 1 END,
          "updatedBy" = ${accountId},
          "updatedAt" = now()
      WHERE o.id IN (SELECT id FROM candidates)
        AND (SELECT count(*) FROM candidates) = 1
      RETURNING o.id
    )
    SELECT
      (SELECT count(*) FROM candidates) AS "candidateCount",
      (SELECT count(*) FROM updated) AS "updatedCount"
  `;

  const candidateCount = Number(rows[0]?.candidateCount ?? 0);
  if (candidateCount === 0) return "NOT_FOUND";
  if (candidateCount > 1) return "AMBIGUOUS";
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

  // 스캔 기록 저장과 현황(OrderLine) 반영은 서로 다른 테이블에 쓰는 독립적인 작업이라
  // 순서대로 기다릴 필요가 없다 — 동시에 보내서 왕복을 줄인다. "오늘 검수" 카운트는
  // 이 응답이 이미 들고 있는 match/mismatch 결과로 클라이언트가 바로 누적하므로
  // 여기서 매번 다시 세지 않는다 (최초 진입 시 집계는 /api/barcode/scan/summary).
  const [, orderLineStatus] = await Promise.all([
    prisma.scanLog.create({
      data: { orderNo, productCode, productName, colorName, sizeName, scannedBarcode, expectedBarcode, result, scannedBy: accountId },
    }),
    reflectToOrderLine(orderNo, productCode, colorName, matches, accountId),
  ]);

  return NextResponse.json({ result, expectedBarcode, orderLineStatus });
}
