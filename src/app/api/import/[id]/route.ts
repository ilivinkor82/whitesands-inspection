import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 이 경로 전체(/api/import/*)는 middleware.ts에서 admin 전용으로 이미 막혀 있다 —
// worker는 여기까지 오지도 못하므로 /orders처럼 역할별로 따로 체크할 필요가 없다.
//
// 신규/수정/건너뜀 건수·업로드 시각·업로드한 사람은 그 업로드가 실제로 어떻게
// 반영됐는지의 기록이라 손으로 고치면 이력의 의미가 없어진다 — 그래서 파일명만
// 고칠 수 있게 하고(오타 등), 잘못 올라온 이력 자체를 지우고 싶으면 DELETE를 쓴다.
const PatchSchema = z.object({
  filename: z.string().min(1),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "입력값이 올바르지 않습니다", details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.import.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "이력을 찾을 수 없습니다" }, { status: 404 });
  }

  const updated = await prisma.import.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ item: updated });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const existing = await prisma.import.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "이력을 찾을 수 없습니다" }, { status: 404 });
  }

  await prisma.import.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
