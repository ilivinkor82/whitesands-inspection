import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { computeDerived } from "@/lib/compute";
import { getCurrentAccount } from "@/lib/session";

// 작업자 화면에서 인라인으로 고칠 수 있는 필드만 허용한다.
// 출고 관련 필드(출고요청수량/이동일자/이동수량)는 엑셀 임포트로만 들어온다.
const PatchSchema = z.object({
  inspectedQty: z.number().int().nullable().optional(),
  defectQty: z.number().int().nullable().optional(),
  returnDate: z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v ? new Date(v) : null)),
  returnQty: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "입력값이 올바르지 않습니다", details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.orderLine.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "행을 찾을 수 없습니다" }, { status: 404 });
  }

  const account = await getCurrentAccount();

  // 현황(이 PATCH)의 인라인 수정은 worker/admin 권한 차이가 없다 — 역할 구분은
  // 삭제(DELETE, 아래)처럼 되돌리기 어려운 파괴적 기능에만 둔다. 바코드검수수량
  // (scannedQty)은 스캔 전용 집계라 애초에 이 스키마에 없어서 PATCH 자체로 아무도
  // 못 건드린다.
  const updated = await prisma.orderLine.update({
    where: { id },
    data: { ...parsed.data, updatedBy: account?.accountId ?? null },
  });

  return NextResponse.json({ row: computeDerived(updated) });
}

// 행 삭제는 마스터(admin) 계정만 — 실수로 지우기 쉬운 파괴적 작업이라 역할 체크를
// 미들웨어가 아니라 여기서 직접 한다 (PATCH/GET은 작업자도 계속 써야 하므로
// 경로 전체를 admin 전용으로 막을 수 없다).
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await getCurrentAccount();
  if (account?.role !== "admin") {
    return NextResponse.json({ error: "이 기능은 관리자 계정만 쓸 수 있습니다" }, { status: 403 });
  }

  const existing = await prisma.orderLine.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "행을 찾을 수 없습니다" }, { status: 404 });
  }

  await prisma.orderLine.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
