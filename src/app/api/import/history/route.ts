import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const imports = await prisma.import.findMany({
    orderBy: { uploadedAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ imports });
}
