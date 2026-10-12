import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ products: [] });

  const products = await prisma.barcodeProduct.findMany({
    where: {
      OR: [
        { productCode: { contains: q, mode: "insensitive" } },
        { productName: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: [{ productCode: "asc" }, { colorName: "asc" }, { sizeName: "asc" }],
    take: 50,
  });

  return NextResponse.json({ products });
}
