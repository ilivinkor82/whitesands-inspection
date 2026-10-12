import * as XLSX from "xlsx";
import { BARCODE_KEY_FIELDS, barcodeHeaderToField, type BarcodeProductField } from "./headerMap";

export interface ParsedBarcodeRow {
  rowIndex: number;
  data: Partial<Record<BarcodeProductField, string>>;
  error: string | null;
}

export function parseBarcodeWorkbook(buffer: Buffer): ParsedBarcodeRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });

  return raw.map((record, i) => {
    const rowIndex = i + 2;
    const data: Partial<Record<BarcodeProductField, string>> = {};
    const errors: string[] = [];

    for (const [header, cellValue] of Object.entries(record)) {
      const field = barcodeHeaderToField(header);
      if (!field) continue;
      const str = cellValue == null ? "" : String(cellValue).trim();
      data[field] = str === "" ? undefined : str;
    }

    for (const key of BARCODE_KEY_FIELDS) {
      if (!data[key]) errors.push(`필수 항목 누락: ${key === "productCode" ? "상품코드" : key === "colorName" ? "컬러" : "사이즈"}`);
    }
    if (!data.barcode1) errors.push("필수 항목 누락: 바코드1");

    return { rowIndex, data, error: errors.length > 0 ? errors.join("; ") : null };
  });
}
