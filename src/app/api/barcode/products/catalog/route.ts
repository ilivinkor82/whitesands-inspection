import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 상품 선택 1단계 드롭다운용 — 품번/컬러 구분 없이 상품(코드+이름) 단위로만 중복 제거해서 준다.
// orderNo가 있으면 전체 바코드 레지스트리가 아니라 그 발주서(OrderLine)에 실제로 있는
// 상품만 — 그것도 바코드가 등록돼 있어 2단계에서 컬러를 고를 수 있는 것만 — 추려서 준다.
export async function GET(request: NextRequest) {
  const orderNo = request.nextUrl.searchParams.get("orderNo")?.trim();

  if (orderNo) {
    const orderProducts = await prisma.orderLine.findMany({
      where: { orderNo },
      distinct: ["productCode"],
      select: { productCode: true, productName: true },
    });
    if (orderProducts.length === 0) return NextResponse.json({ products: [] });

    const registered = await prisma.barcodeProduct.findMany({
      where: { productCode: { in: orderProducts.map((p) => p.productCode) } },
      distinct: ["productCode"],
      select: { productCode: true },
    });
    const registeredCodes = new Set(registered.map((r) => r.productCode));

    const products = orderProducts
      .filter((p) => registeredCodes.has(p.productCode))
      .sort((a, b) => a.productCode.localeCompare(b.productCode));
    return NextResponse.json({ products });
  }

  const rows = await prisma.barcodeProduct.findMany({
    distinct: ["productCode"],
    select: { productCode: true, productName: true },
    orderBy: { productCode: "asc" },
  });
  return NextResponse.json({ products: rows });
}
