import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { kstDayRange } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const orderNo = request.nextUrl.searchParams.get("orderNo")?.trim();
  if (!orderNo) return NextResponse.json({ matchCount: 0, mismatchCount: 0 });

  const { start, end } = kstDayRange();

  const [matchCount, mismatchCount] = await Promise.all([
    prisma.scanLog.count({ where: { orderNo, result: "MATCH", scannedAt: { gte: start, lt: end } } }),
    prisma.scanLog.count({ where: { orderNo, result: "MISMATCH", scannedAt: { gte: start, lt: end } } }),
  ]);

  return NextResponse.json({ matchCount, mismatchCount });
}
