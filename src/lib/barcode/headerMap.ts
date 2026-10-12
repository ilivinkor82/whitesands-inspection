export type BarcodeProductField =
  | "productCode"
  | "productName"
  | "colorName"
  | "sizeName"
  | "barcode1"
  | "barcode2";

interface FieldDef {
  field: BarcodeProductField;
  headers: string[];
  required: boolean;
}

export const BARCODE_FIELD_DEFS: FieldDef[] = [
  { field: "productCode", headers: ["상품코드"], required: true },
  { field: "productName", headers: ["상품명"], required: true },
  { field: "colorName", headers: ["컬러"], required: true },
  { field: "sizeName", headers: ["사이즈"], required: true },
  { field: "barcode1", headers: ["바코드1"], required: true },
  { field: "barcode2", headers: ["바코드2"], required: false },
];

export const BARCODE_KEY_FIELDS: BarcodeProductField[] = ["productCode", "colorName", "sizeName"];

function normalizeHeader(raw: string): string {
  return raw.trim().replace(/\s+/g, "");
}

const HEADER_TO_FIELD = new Map<string, BarcodeProductField>();
for (const def of BARCODE_FIELD_DEFS) {
  for (const h of def.headers) {
    HEADER_TO_FIELD.set(normalizeHeader(h), def.field);
  }
}

export function barcodeHeaderToField(raw: string): BarcodeProductField | null {
  return HEADER_TO_FIELD.get(normalizeHeader(raw)) ?? null;
}
