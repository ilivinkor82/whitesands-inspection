import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { FIELD_DEFS } from "@/lib/excel/headerMap";

export const dynamic = "force-dynamic";

// 계산열(양품수량/차이)은 임포트 시 항상 무시되므로 양식에도 넣지 않는다.
export async function GET() {
  const headers = FIELD_DEFS.map((d) => d.headers[0]);
  const sheet = XLSX.utils.aoa_to_sheet([headers]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="inspection-template.xlsx"',
    },
  });
}
