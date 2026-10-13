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

  // 제품검수수량(inspectedQty)/불량수량(defectQty)은 worker 계정에서 서버에서도 막는다
  // (화면에서 입력칸을 숨기는 것과 별개로 API 직접 호출도 차단). 불량수량은 여전히
  // 바코드 불일치 스캔으로도 쌓이기 때문에 worker가 직접 고치면 스캔 집계와 어긋난다.
  // 바코드검수수량(scannedQty)은 스캔 전용 집계라 애초에 이 스키마에 없어서 아무도
  // PATCH로 못 건드린다.
  if (account?.role !== "admin" && (parsed.data.inspectedQty !== undefined || parsed.data.defectQty !== undefined)) {
    return NextResponse.json({ error: "검수수량/불량수량은 관리자 계정만 수정할 수 있습니다" }, { status: 403 });
  }

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
