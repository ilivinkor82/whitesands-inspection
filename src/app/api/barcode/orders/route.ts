import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 오더번호 입력창 자동완성용 — OrderLine에 이미 있는 오더번호 목록 (강제 연결은 아님, 편의 제공만)
export async function GET() {
  const rows = await prisma.orderLine.findMany({
    select: { orderNo: true },
    distinct: ["orderNo"],
    orderBy: { orderNo: "desc" },
    take: 200,
  });
  return NextResponse.json({ orderNumbers: rows.map((r) => r.orderNo) });
}
