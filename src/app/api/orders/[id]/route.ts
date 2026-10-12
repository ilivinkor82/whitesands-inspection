import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { computeDerived } from "@/lib/compute";

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

  const updated = await prisma.orderLine.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json({ row: computeDerived(updated) });
}
