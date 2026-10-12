import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fieldType, type OrderLineField } from "@/lib/excel/headerMap";
import { valuesEqual } from "@/lib/excel/diff";
import type { ParsedValue } from "@/lib/excel/parseWorkbook";
import { getCurrentAccount } from "@/lib/session";

const ValueSchema = z.union([z.string(), z.number(), z.null()]);

const NewRowSchema = z.object({
  kind: z.literal("NEW"),
  rowIndex: z.number(),
  data: z.record(ValueSchema),
});

const UpdateRowSchema = z.object({
  kind: z.literal("UPDATE"),
  rowIndex: z.number(),
  id: z.string(),
  key: z.object({ orderNo: z.string(), productCode: z.string(), colorCode: z.string() }),
  changes: z.record(z.object({ old: ValueSchema, new: ValueSchema })),
});

const CommitSchema = z.object({
  filename: z.string(),
  importType: z.enum(["SHIPMENT", "INSPECTION", "MIXED"]),
  newRows: z.array(NewRowSchema),
  updatedRows: z.array(UpdateRowSchema),
});

function coerceForField(field: OrderLineField, value: ParsedValue): string | number | Date | null {
  if (value == null) return null;
  const type = fieldType(field);
  if (type === "int") return typeof value === "number" ? value : Number(value);
  if (type === "date") return new Date(value as string);
  return String(value);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = CommitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다", details: parsed.error.flatten() }, { status: 400 });
  }

  const { filename, importType, newRows, updatedRows } = parsed.data;
  const account = await getCurrentAccount();
  const accountId = account?.accountId ?? null;

  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const conflictIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (const row of newRows) {
      const data: Record<string, string | number | Date | null> = {};
      for (const [field, value] of Object.entries(row.data)) {
        data[field] = coerceForField(field as OrderLineField, value);
      }
      try {
        await tx.orderLine.create({
          data: {
            ...data,
            orderNo: String(data.orderNo ?? ""),
            productCode: String(data.productCode ?? ""),
            colorCode: String(data.colorCode ?? ""),
            productName: String(data.productName ?? ""),
            colorName: String(data.colorName ?? ""),
            updatedBy: accountId,
          } as never,
        });
        insertedCount += 1;
      } catch {
        // 동시에 같은 키로 다른 업로드가 먼저 들어온 경우 (unique 제약 충돌) — 건너뜀
        skippedCount += 1;
      }
    }

    for (const row of updatedRows) {
      const current = await tx.orderLine.findUnique({ where: { id: row.id } });
      if (!current) {
        skippedCount += 1;
        continue;
      }

      let conflict = false;
      const data: Record<string, string | number | Date | null> = {};
      for (const [field, change] of Object.entries(row.changes)) {
        const currentValue = (current as unknown as Record<string, ParsedValue>)[field] ?? null;
        const expectedOld = coerceForField(field as OrderLineField, change.old);
        if (!valuesEqual(currentValue, expectedOld)) {
          conflict = true;
          break;
        }
        data[field] = coerceForField(field as OrderLineField, change.new);
      }

      if (conflict) {
        skippedCount += 1;
        conflictIds.push(row.id);
        continue;
      }

      await tx.orderLine.update({ where: { id: row.id }, data: { ...data, updatedBy: accountId } });
      updatedCount += 1;
    }
  });

  const importRecord = await prisma.import.create({
    data: {
      filename,
      type: importType,
      uploadedBy: accountId,
      insertedCount,
      updatedCount,
      skippedCount,
      errorCount: 0,
    },
  });

  return NextResponse.json({
    importId: importRecord.id,
    insertedCount,
    updatedCount,
    skippedCount,
    conflictIds,
  });
}
