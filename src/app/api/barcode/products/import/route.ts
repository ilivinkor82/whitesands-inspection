import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseBarcodeWorkbook } from "@/lib/barcode/parseWorkbook";

export const dynamic = "force-dynamic";

// 미리보기 없이 바로 추가/병합한다 (원래 바코드 프로그램의 동작과 동일) — 상품코드+컬러+사이즈가
// 이미 있으면 상품명/바코드를 갱신하고, 없으면 새로 추가한다.
//
// 회사에서 쓰는 파일이 둘 이상이고(재고 리포트는 "베이지" 같은 풀네임, 홈페이지 상품
// 내보내기는 "BE" 같은 짧은 코드만 줌) 같은 실물을 서로 다른 컬러 표기로 올리는 경우가
// 실제로 있었다 — 그대로 두면 컬러명이 다르다는 이유로 매번 중복 행이 생긴다. 바코드가
// 이미 등록돼 있으면 컬러 표기가 달라도 같은 실물로 보고 기존 행에 병합하고, 컬러명은
// 더 설명적인(긴) 쪽을 남긴다.
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
  let skippedCount = 0;
  const errorRows = rows.filter((r) => r.error).map((r) => ({ rowIndex: r.rowIndex, reason: r.error! }));

  for (const row of rows) {
    if (row.error) continue;
    const { productCode, productName, colorName, sizeName, barcode1, barcode2, imageUrl } = row.data;

    const existingByBarcode = barcode1 ? await prisma.barcodeProduct.findFirst({ where: { barcode1 } }) : null;
    const existing =
      existingByBarcode ??
      (await prisma.barcodeProduct.findUnique({
        where: {
          barcodeProductKey: {
            productCode: productCode!,
            colorName: colorName!,
            sizeName: sizeName!,
          },
        },
      }));

    if (existing) {
      const mergedColorName =
        colorName && colorName.length > existing.colorName.length ? colorName : existing.colorName;
      const mergedProductName =
        productName && productName.length > existing.productName.length ? productName : existing.productName;
      try {
        await prisma.barcodeProduct.update({
          where: { id: existing.id },
          data: {
            productName: mergedProductName,
            colorName: mergedColorName,
            barcode1: barcode1 ?? existing.barcode1,
            barcode2: barcode2 ?? existing.barcode2,
            imageUrl: imageUrl ?? existing.imageUrl,
          },
        });
        updatedCount += 1;
      } catch {
        // 병합된 컬러명이 다른 행의 유니크 키와 충돌하는 드문 경우 — 건드리지 않고 건너뜀
        skippedCount += 1;
      }
    } else {
      await prisma.barcodeProduct.create({
        data: {
          productCode: productCode!,
          productName: productName ?? "",
          colorName: colorName!,
          sizeName: sizeName!,
          barcode1: barcode1!,
          barcode2: barcode2 ?? null,
          imageUrl: imageUrl ?? null,
        },
      });
      insertedCount += 1;
    }
  }

  return NextResponse.json({ insertedCount, updatedCount, skippedCount, errorRows });
}
