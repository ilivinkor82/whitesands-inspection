import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { formatDateTimeKST } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const orderNo = request.nextUrl.searchParams.get("orderNo")?.trim() || undefined;

  const logs = await prisma.scanLog.findMany({
    where: orderNo ? { orderNo } : undefined,
    orderBy: { scannedAt: "desc" },
    take: 5000,
  });

  const rows = [
    ["시간(KST)", "오더번호", "상품코드", "상품명", "컬러", "사이즈", "스캔된바코드", "기대바코드", "결과"],
    ...logs.map((log) => [
      formatDateTimeKST(log.scannedAt),
      log.orderNo,
      log.productCode,
      log.productName,
      log.colorName,
      log.sizeName,
      log.scannedBarcode,
      log.expectedBarcode ?? "",
      log.result === "MATCH" ? "일치" : "불일치",
    ]),
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="scan-log${orderNo ? `-${orderNo}` : ""}.xlsx"`,
    },
  });
}
