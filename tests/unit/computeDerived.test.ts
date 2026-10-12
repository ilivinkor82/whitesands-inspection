import { describe, expect, it } from "vitest";
import { computeDerived } from "@/lib/compute";

describe("computeDerived", () => {
  it("검수수량/불량수량이 모두 있으면 양품수량을 계산한다", () => {
    const result = computeDerived({
      inspectedQty: 60,
      defectQty: 3,
      shippedQty: 60,
      returnQty: null,
    });
    expect(result.goodQty).toBe(57);
  });

  it("검수수량이 없으면 양품수량은 null이다 (0이 아니다)", () => {
    const result = computeDerived({
      inspectedQty: null,
      defectQty: null,
      shippedQty: 60,
      returnQty: null,
    });
    expect(result.goodQty).toBeNull();
  });

  it("이동수량/복귀수량이 모두 있으면 차이를 계산한다", () => {
    const result = computeDerived({
      inspectedQty: null,
      defectQty: null,
      shippedQty: 60,
      returnQty: 55,
    });
    expect(result.diffQty).toBe(5);
  });

  it("복귀수량이 없으면 차이는 null이다", () => {
    const result = computeDerived({
      inspectedQty: null,
      defectQty: null,
      shippedQty: 60,
      returnQty: null,
    });
    expect(result.diffQty).toBeNull();
  });
});
