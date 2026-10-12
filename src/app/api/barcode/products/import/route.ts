import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseBarcodeWorkbook } from "@/lib/barcode/parseWorkbook";

export const dynamic = "force-dynamic";

// 미리보기 없이 바로 추가/병합한다 (원래 바코드 프로그램의 동작과 동일) — 상품코드+컬러+사이즈가
// 이미 있으면 상품명/바코드를 갱신하고, 없으면 새로 추가한다.
export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "엑셀 파일을 선택하세요" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const rows = parseBarcodeWorkbook(buffer);

  let insertedCount = 0;
  let updatedCount = 0;
  const errorRows = rows.filter((r) => r.error).map((r) => ({ rowIndex: r.rowIndex, reason: r.error! }));

  for (const row of rows) {
    if (row.error) continue;
    const { productCode, productName, colorName, sizeName, barcode1, barcode2 } = row.data;

    const existing = await prisma.barcodeProduct.findUnique({
      where: {
        barcodeProductKey: {
          productCode: productCode!,
          colorName: colorName!,
          sizeName: sizeName!,
        },
      },
    });

    if (existing) {
      await prisma.barcodeProduct.update({
        where: { id: existing.id },
        data: {
          productName: productName ?? existing.productName,
          barcode1: barcode1 ?? existing.barcode1,
          barcode2: barcode2 ?? existing.barcode2,
        },
      });
      updatedCount += 1;
    } else {
      await prisma.barcodeProduct.create({
        data: {
          productCode: productCode!,
          productName: productName ?? "",
          colorName: colorName!,
          sizeName: sizeName!,
          barcode1: barcode1!,
          barcode2: barcode2 ?? null,
        },
      });
      insertedCount += 1;
    }
  }

  return NextResponse.json({ insertedCount, updatedCount, errorRows });
}
