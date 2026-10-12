import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseWorkbook, listSheetNames } from "@/lib/excel/parseWorkbook";
import { classifyDiff } from "@/lib/excel/diff";

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "엑셀 파일을 선택하세요" }, { status: 400 });
  }
  const sheetName = (formData?.get("sheetName") as string | null) ?? undefined;

  const buffer = Buffer.from(await file.arrayBuffer());

  const sheetNames = listSheetNames(buffer);
  if (sheetNames.length > 1 && !sheetName) {
    return NextResponse.json({ needsSheetSelection: true, sheetNames });
  }

  let parsed;
  try {
    parsed = parseWorkbook(buffer, sheetName);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "파싱 실패" }, { status: 400 });
  }

  const keys = parsed.rows
    .filter((r) => !r.error)
    .map((r) => ({
      orderNo: String(r.data.orderNo),
      productCode: String(r.data.productCode),
      colorCode: String(r.data.colorCode),
    }));

  const existing =
    keys.length > 0
      ? await prisma.orderLine.findMany({
          where: { OR: keys.map((k) => ({ orderNo: k.orderNo, productCode: k.productCode, colorCode: k.colorCode })) },
        })
      : [];

  const diff = classifyDiff(parsed, existing);

  return NextResponse.json({
    sheetName: parsed.sheetName,
    ignoredColumns: parsed.ignoredColumns,
    headerFieldsPresent: parsed.headerFieldsPresent,
    importType: parsed.importType,
    filename: (file as File).name,
    ...diff,
  });
}
