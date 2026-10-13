import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 상품 선택 2단계 드롭다운용 — 정확히 이 상품코드에 속한 컬러/사이즈 전체.
//
// 발주서(OrderLine)의 컬러로만 좁히고 싶었지만, 실제 데이터에서 OrderLine.colorName과
// BarcodeProduct.colorName 표기가 정확히 안 맞는 경우가 있다(예: "핑크" vs
// "(인디)핑크&베리", "베이지" vs "(핑크&크림)베이지") — 그렇게 좁히면 그 컬러가
// 목록에서 아예 사라져서 스캔 자체를 할 수 없게 된다. 그래서 1단계(상품)만 발주서로
// 좁히고, 컬러는 여전히 전체 레지스트리를 보여준다.
export async function GET(request: NextRequest) {
  const productCode = request.nextUrl.searchParams.get("productCode")?.trim();
  if (!productCode) return NextResponse.json({ variants: [] });

  const variants = await prisma.barcodeProduct.findMany({
    where: { productCode },
    orderBy: [{ colorName: "asc" }, { sizeName: "asc" }],
  });
  return NextResponse.json({ variants });
}
