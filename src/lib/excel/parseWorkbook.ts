import * as XLSX from "xlsx";
import {
  FIELD_DEFS,
  KEY_FIELDS,
  fieldType,
  headerExtractor,
  headerToField,
  isIgnoredComputedHeader,
  type OrderLineField,
} from "./headerMap";

export type ParsedValue = string | number | Date | null;
export type ParsedRowData = Partial<Record<OrderLineField, ParsedValue>>;

export interface ParsedRow {
  /** 엑셀 시트 상의 실제 행 번호 (헤더=1행 기준, 데이터는 2부터) */
  rowIndex: number;
  data: ParsedRowData;
  error: string | null;
}

export interface ParseResult {
  sheetName: string;
  ignoredColumns: string[];
  headerFieldsPresent: OrderLineField[];
  rows: ParsedRow[];
  importType: "SHIPMENT" | "INSPECTION" | "MIXED";
}

const DATE_STRING_RE = /^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/;

function coerceDate(raw: unknown): { value: Date | null; error: string | null } {
  if (raw == null || raw === "") return { value: null, error: null };
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return { value: null, error: "날짜 형식을 읽을 수 없음" };
    return { value: raw, error: null };
  }
  if (typeof raw === "string") {
    const m = raw.trim().match(DATE_STRING_RE);
    if (m) {
      const [, y, mo, d] = m;
      const dt = new Date(Number(y), Number(mo) - 1, Number(d));
      return { value: dt, error: null };
    }
    return { value: null, error: `날짜 형식을 인식할 수 없음: "${raw}"` };
  }
  return { value: null, error: `날짜 형식을 인식할 수 없음: ${String(raw)}` };
}

function coerceInt(raw: unknown): { value: number | null; error: string | null } {
  if (raw == null || raw === "") return { value: null, error: null };
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, "").trim());
  if (!Number.isFinite(n)) return { value: null, error: `숫자가 아님: "${String(raw)}"` };
  return { value: Math.trunc(n), error: null };
}

function coerceString(raw: unknown): { value: string | null; error: string | null } {
  if (raw == null) return { value: null, error: null };
  const s = String(raw).trim();
  return { value: s === "" ? null : s, error: null };
}

/**
 * 업로드된 .xlsx 버퍼를 파싱한다. 지정한 sheetName이 없으면 첫 시트를 쓴다.
 * DB에 쓰지 않는다 — 순수 파싱/검증만 한다.
 */
export function parseWorkbook(buffer: Buffer, sheetName?: string): ParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const targetSheetName = sheetName ?? workbook.SheetNames[0];
  const sheet = workbook.Sheets[targetSheetName];
  if (!sheet) {
    throw new Error(`시트를 찾을 수 없음: ${targetSheetName}`);
  }

  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
    defval: null,
    raw: false,
    dateNF: "yyyy-mm-dd",
  });
  // cellDates:true + raw:false 조합은 날짜 셀을 문자열로 바꿔버릴 수 있어
  // 날짜 전용 패스를 raw:true로 한 번 더 돈다.
  const rawDates: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
    defval: null,
    raw: true,
  });

  const headerRow = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })[0] ?? [];
  const headerFieldsPresentSet = new Set<OrderLineField>();
  const ignoredColumns: string[] = [];

  for (const h of headerRow) {
    if (h == null || String(h).trim() === "") continue;
    const header = String(h);
    if (isIgnoredComputedHeader(header)) continue;
    const field = headerToField(header);
    if (field) {
      headerFieldsPresentSet.add(field);
    } else {
      ignoredColumns.push(header);
    }
  }

  const rows: ParsedRow[] = raw.map((record, i) => {
    const rowIndex = i + 2; // 1행은 헤더
    const data: ParsedRowData = {};
    const errors: string[] = [];

    for (const [header, cellValue] of Object.entries(record)) {
      const field = headerToField(header);
      if (!field) continue;
      const type = fieldType(field);
      if (type === "int") {
        const { value, error } = coerceInt(cellValue);
        if (error) errors.push(`${header}: ${error}`);
        data[field] = value;
      } else if (type === "date") {
        const rawDateCell = rawDates[i]?.[header];
        const { value, error } = coerceDate(rawDateCell ?? cellValue);
        if (error) errors.push(`${header}: ${error}`);
        data[field] = value;
      } else {
        const extractor = headerExtractor(header);
        const sourceValue =
          extractor && typeof cellValue === "string" ? extractor(cellValue) : cellValue;
        const { value, error } = coerceString(sourceValue);
        if (error) errors.push(`${header}: ${error}`);
        data[field] = value;
      }
    }

    for (const key of KEY_FIELDS) {
      if (!data[key]) {
        errors.push(`필수 식별자 누락: ${FIELD_DEFS.find((d) => d.field === key)!.headers[0]}`);
      }
    }

    return { rowIndex, data, error: errors.length > 0 ? errors.join("; ") : null };
  });

  const headerFieldsPresent = Array.from(headerFieldsPresentSet);
  const hasShipment = FIELD_DEFS.some(
    (d) => d.category === "shipment" && headerFieldsPresentSet.has(d.field)
  );
  const hasInspection = FIELD_DEFS.some(
    (d) => d.category === "inspection" && headerFieldsPresentSet.has(d.field)
  );
  const importType = hasShipment && hasInspection ? "MIXED" : hasInspection ? "INSPECTION" : "SHIPMENT";

  return {
    sheetName: targetSheetName,
    ignoredColumns,
    headerFieldsPresent,
    rows,
    importType,
  };
}

export function listSheetNames(buffer: Buffer): string[] {
  const workbook = XLSX.read(buffer, { type: "buffer", bookSheets: true });
  return workbook.SheetNames;
}
