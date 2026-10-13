import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 상품 선택 2단계 드롭다운용 — 정확히 이 상품코드에 속한 컬러/사이즈 전체.
export async function GET(request: NextRequest) {
  const productCode = request.nextUrl.searchParams.get("productCode")?.trim();
  if (!productCode) return NextResponse.json({ variants: [] });

  const variants = await prisma.barcodeProduct.findMany({
    where: { productCode },
    orderBy: [{ colorName: "asc" }, { sizeName: "asc" }],
  });
  return NextResponse.json({ variants });
}
