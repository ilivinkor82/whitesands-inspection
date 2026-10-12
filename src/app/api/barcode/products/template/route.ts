import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { BARCODE_FIELD_DEFS } from "@/lib/barcode/headerMap";

export const dynamic = "force-dynamic";

export async function GET() {
  const headers = BARCODE_FIELD_DEFS.map((d) => d.headers[0]);
  const sheet = XLSX.utils.aoa_to_sheet([headers]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="barcode-product-template.xlsx"',
    },
  });
}
