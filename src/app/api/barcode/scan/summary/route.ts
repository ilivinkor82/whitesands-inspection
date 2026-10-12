import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const orderNo = request.nextUrl.searchParams.get("orderNo")?.trim();
  if (!orderNo) return NextResponse.json({ matchCount: 0, mismatchCount: 0 });

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const [matchCount, mismatchCount] = await Promise.all([
    prisma.scanLog.count({ where: { orderNo, result: "MATCH", scannedAt: { gte: start, lt: end } } }),
    prisma.scanLog.count({ where: { orderNo, result: "MISMATCH", scannedAt: { gte: start, lt: end } } }),
  ]);

  return NextResponse.json({ matchCount, mismatchCount });
}
