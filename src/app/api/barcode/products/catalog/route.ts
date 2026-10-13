import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 상품 선택 1단계 드롭다운용 — 품번/컬러 구분 없이 상품(코드+이름) 단위로만 중복 제거해서 준다.
export async function GET() {
  const rows = await prisma.barcodeProduct.findMany({
    distinct: ["productCode"],
    select: { productCode: true, productName: true },
    orderBy: { productCode: "asc" },
  });
  return NextResponse.json({ products: rows });
}
