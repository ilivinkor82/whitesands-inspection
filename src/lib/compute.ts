export interface DerivableFields {
  inspectedQty: number | null;
  defectQty: number | null;
  shippedQty: number | null;
  returnQty: number | null;
}

export interface DerivedFields {
  goodQty: number | null; // 양품수량 = 검수수량 - 불량수량
  diffQty: number | null; // 차이 = 이동수량 - 복귀수량
}

/**
 * 양품수량/차이는 DB 컬럼으로 저장하지 않는다 — 항상 여기서 계산해서 붙인다.
 * 워커의 수동 입력이나 엑셀 임포트가 이 값을 직접 쓰지 못하게 해서
 * 숫자가 어긋나는 것을 막는다.
 */
export function computeDerived<T extends DerivableFields>(row: T): T & DerivedFields {
  const goodQty =
    row.inspectedQty != null && row.defectQty != null ? row.inspectedQty - row.defectQty : null;
  const diffQty =
    row.shippedQty != null && row.returnQty != null ? row.shippedQty - row.returnQty : null;
  return { ...row, goodQty, diffQty };
}
