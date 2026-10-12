import * as XLSX from "xlsx";
import {
  BARCODE_FIELD_LABEL,
  BARCODE_REQUIRED_FROM_FILE,
  barcodeHeaderToField,
  type BarcodeProductField,
} from "./headerMap";

export interface ParsedBarcodeRow {
  rowIndex: number;
  data: Partial<Record<BarcodeProductField, string>>;
  error: string | null;
}

const HEADER_SCAN_LIMIT = 10;
const DEFAULT_SIZE_NAME = "ONE SIZE";

/**
 * 헤더가 항상 1행이라는 보장이 없다 (재고 리포트류는 1행에 제목 텍스트가 오고
 * 2행이 실제 헤더인 경우가 많음) — 상위 몇 행 중 알려진 헤더와 가장 많이
 * 겹치는 행을 헤더로 쓴다.
 */
function findHeaderRowIndex(grid: unknown[][]): number {
  const scanLimit = Math.min(HEADER_SCAN_LIMIT, grid.length);
  let bestIndex = 0;
  let bestMatchCount = -1;
  for (let i = 0; i < scanLimit; i++) {
    const row = grid[i] ?? [];
    const matchCount = row.filter(
      (cell) => typeof cell === "string" && barcodeHeaderToField(cell) !== null
    ).length;
    if (matchCount > bestMatchCount) {
      bestMatchCount = matchCount;
      bestIndex = i;
    }
  }
  return bestIndex;
}

export function parseBarcodeWorkbook(buffer: Buffer): ParsedBarcodeRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const grid: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });

  const headerRowIndex = findHeaderRowIndex(grid);
  const headerRow = (grid[headerRowIndex] ?? []).map((h) => (h == null ? "" : String(h)));

  const rows: ParsedBarcodeRow[] = [];

  for (let i = headerRowIndex + 1; i < grid.length; i++) {
    const rawRow = grid[i] ?? [];
    if (rawRow.every((cell) => cell == null || String(cell).trim() === "")) continue; // 빈 행 건너뜀

    const data: Partial<Record<BarcodeProductField, string>> = {};
    headerRow.forEach((header, colIdx) => {
      const field = barcodeHeaderToField(header);
      if (!field) return;
      const cellValue = rawRow[colIdx];
      const str = cellValue == null ? "" : String(cellValue).trim();
      if (str !== "") data[field] = str;
    });

    if (!data.sizeName) data.sizeName = DEFAULT_SIZE_NAME;

    const errors: string[] = [];
    for (const key of BARCODE_REQUIRED_FROM_FILE) {
      if (!data[key]) errors.push(`필수 항목 누락: ${BARCODE_FIELD_LABEL[key]}`);
    }

    rows.push({ rowIndex: i + 1, data, error: errors.length > 0 ? errors.join("; ") : null });
  }

  return rows;
}
