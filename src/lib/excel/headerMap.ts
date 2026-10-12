export type FieldType = "string" | "int" | "date";

export type OrderLineField =
  | "orderNo"
  | "productCode"
  | "colorCode"
  | "productName"
  | "colorName"
  | "requestedQty"
  | "shipDate"
  | "shippedQty"
  | "inspectedQty"
  | "defectQty"
  | "returnDate"
  | "returnQty"
  | "notes";

interface FieldDef {
  field: OrderLineField;
  type: FieldType;
  /** 이 파일에 헤더가 있으면 이 카테고리로 분류된다 (importType 추론용). */
  category: "key" | "shipment" | "inspection" | "other";
  /** 같은 필드를 가리키는 허용 헤더 문자열 (괄호 변형 등). 첫 항목이 표준 표기. */
  headers: string[];
}

export const FIELD_DEFS: FieldDef[] = [
  { field: "orderNo", type: "string", category: "key", headers: ["오더번호", "오더제목"] },
  { field: "productCode", type: "string", category: "key", headers: ["상품코드"] },
  { field: "colorCode", type: "string", category: "key", headers: ["컬러코드", "상품컬러코드"] },
  { field: "productName", type: "string", category: "other", headers: ["상품명", "상품명(수집)"] },
  { field: "colorName", type: "string", category: "other", headers: ["컬러", "옵션(수집)"] },
  {
    field: "requestedQty",
    type: "int",
    category: "shipment",
    headers: ["출고요청수량"],
  },
  {
    field: "shipDate",
    type: "date",
    category: "shipment",
    headers: ["이동일자(주희→JS)", "이동일자", "이동일자(주희물류→제이에스)", "출고일"],
  },
  { field: "shippedQty", type: "int", category: "shipment", headers: ["이동수량", "수량"] },
  { field: "inspectedQty", type: "int", category: "inspection", headers: ["검수수량"] },
  { field: "defectQty", type: "int", category: "inspection", headers: ["불량수량"] },
  {
    field: "returnDate",
    type: "date",
    category: "inspection",
    headers: ["복귀일자(JS→주희)", "복귀일자", "복귀일자(제이에스→주희물류)"],
  },
  { field: "returnQty", type: "int", category: "inspection", headers: ["복귀수량"] },
  { field: "notes", type: "string", category: "other", headers: ["비고", "전산처리방법"] },
];

// 엑셀에 있어도 항상 무시하는 열 (계산값 — 신뢰하지 않음)
export const IGNORED_COMPUTED_HEADERS = [
  "양품수량",
  "양품수량(=검수-불량)",
  "차이",
  "차이(=이동-복귀)",
];

const HEADER_TO_FIELD = new Map<string, OrderLineField>();
for (const def of FIELD_DEFS) {
  for (const h of def.headers) {
    HEADER_TO_FIELD.set(normalizeHeader(h), def.field);
  }
}

export function normalizeHeader(raw: string): string {
  return raw.trim().replace(/\s+/g, "");
}

export function headerToField(raw: string): OrderLineField | null {
  return HEADER_TO_FIELD.get(normalizeHeader(raw)) ?? null;
}

// 일부 헤더는 값을 그대로 쓰지 않고 가공해야 한다 (예: 택배 발주서의 "옵션(수집)"은
// "색상: 베이지" 형태라 컬러명만 뽑아내야 함). 헤더 원문 기준으로 등록한다.
const HEADER_EXTRACTORS: Record<string, (raw: string) => string> = {
  [normalizeHeader("옵션(수집)")]: (raw) => {
    const m = raw.match(/색상\s*[:：]\s*(.+)/);
    return (m ? m[1] : raw).trim();
  },
};

export function headerExtractor(raw: string): ((v: string) => string) | null {
  return HEADER_EXTRACTORS[normalizeHeader(raw)] ?? null;
}

export function fieldType(field: OrderLineField): FieldType {
  const def = FIELD_DEFS.find((d) => d.field === field);
  if (!def) throw new Error(`알 수 없는 필드: ${field}`);
  return def.type;
}

export function fieldCategory(field: OrderLineField): FieldDef["category"] {
  const def = FIELD_DEFS.find((d) => d.field === field);
  if (!def) throw new Error(`알 수 없는 필드: ${field}`);
  return def.category;
}

export const KEY_FIELDS: OrderLineField[] = ["orderNo", "productCode", "colorCode"];

export function isIgnoredComputedHeader(raw: string): boolean {
  const n = normalizeHeader(raw);
  return IGNORED_COMPUTED_HEADERS.some((h) => normalizeHeader(h) === n);
}
