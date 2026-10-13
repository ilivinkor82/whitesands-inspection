export type BarcodeProductField =
  | "productCode"
  | "productName"
  | "colorName"
  | "sizeName"
  | "barcode1"
  | "barcode2"
  | "imageUrl";

interface FieldDef {
  field: BarcodeProductField;
  headers: string[];
  required: boolean;
}

export const BARCODE_FIELD_DEFS: FieldDef[] = [
  { field: "productCode", headers: ["상품코드"], required: true },
  { field: "productName", headers: ["상품명"], required: true },
  { field: "colorName", headers: ["컬러", "칼라명"], required: true },
  { field: "sizeName", headers: ["사이즈"], required: false },
  { field: "barcode1", headers: ["바코드1", "바코드"], required: true },
  { field: "barcode2", headers: ["바코드2"], required: false },
  { field: "imageUrl", headers: ["이미지URL", "이미지", "사진URL", "사진"], required: false },
];

// DB 유니크 키 = 상품코드+컬러+사이즈. 사이즈는 파일에 없으면 "ONE SIZE"로 채운다
// (우양산/비니처럼 사이즈 구분이 없는 품목이 많아서 — 원래 exe의 데이터도 그렇게 돼 있었음).
export const BARCODE_KEY_FIELDS: BarcodeProductField[] = ["productCode", "colorName", "sizeName"];

// 파일에 실제로 있어야만 하는 필드 (사이즈 제외 — 사이즈는 기본값 처리).
export const BARCODE_REQUIRED_FROM_FILE: BarcodeProductField[] = ["productCode", "colorName", "barcode1"];

export const BARCODE_FIELD_LABEL: Record<BarcodeProductField, string> = {
  productCode: "상품코드",
  productName: "상품명",
  colorName: "컬러",
  sizeName: "사이즈",
  barcode1: "바코드1",
  barcode2: "바코드2",
  imageUrl: "이미지URL",
};

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
