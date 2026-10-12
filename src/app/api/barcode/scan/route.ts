import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { kstDayRange } from "@/lib/datetime";

export const dynamic = "force-dynamic";

const ScanSchema = z.object({
  orderNo: z.string().min(1),
  productCode: z.string().min(1),
  productName: z.string(),
  colorName: z.string().min(1),
  sizeName: z.string().min(1),
  scannedBarcode: z.string().min(1),
});

async function todayCounts(orderNo: string) {
  const { start, end } = kstDayRange();
  const [matchCount, mismatchCount] = await Promise.all([
    prisma.scanLog.count({ where: { orderNo, result: "MATCH", scannedAt: { gte: start, lt: end } } }),
    prisma.scanLog.count({ where: { orderNo, result: "MISMATCH", scannedAt: { gte: start, lt: end } } }),
  ]);
  return { matchCount, mismatchCount };
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = ScanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "입력값이 올바르지 않습니다" }, { status: 400 });
  }

  const { orderNo, productCode, productName, colorName, sizeName, scannedBarcode } = parsed.data;

  const product = await prisma.barcodeProduct.findUnique({
    where: { barcodeProductKey: { productCode, colorName, sizeName } },
  });

  const expectedBarcode = product?.barcode1 ?? null;
  const matches = product != null && (scannedBarcode === product.barcode1 || (!!product.barcode2 && scannedBarcode === product.barcode2));
  const result = matches ? "MATCH" : "MISMATCH";

  await prisma.scanLog.create({
    data: { orderNo, productCode, productName, colorName, sizeName, scannedBarcode, expectedBarcode, result },
  });

  const counts = await todayCounts(orderNo);

  return NextResponse.json({ result, expectedBarcode, ...counts });
}
