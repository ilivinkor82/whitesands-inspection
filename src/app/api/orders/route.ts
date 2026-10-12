import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeDerived } from "@/lib/compute";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();

  const rows = await prisma.orderLine.findMany({
    where: q
      ? {
          OR: [
            { orderNo: { contains: q, mode: "insensitive" } },
            { productCode: { contains: q, mode: "insensitive" } },
            { colorCode: { contains: q, mode: "insensitive" } },
            { productName: { contains: q, mode: "insensitive" } },
            { colorName: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: [{ orderNo: "asc" }, { productCode: "asc" }, { colorCode: "asc" }],
  });

  return NextResponse.json({ rows: rows.map(computeDerived) });
}
