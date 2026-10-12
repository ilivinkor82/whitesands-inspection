import { describe, expect, it } from "vitest";
import { headerToField, isIgnoredComputedHeader } from "@/lib/excel/headerMap";

describe("headerToField", () => {
  it("매핑된 한글 헤더를 필드명으로 변환한다", () => {
    expect(headerToField("오더번호")).toBe("orderNo");
    expect(headerToField("상품코드")).toBe("productCode");
    expect(headerToField("검수수량")).toBe("inspectedQty");
  });

  it("괄호가 붙은 변형 헤더도 같은 필드로 매핑한다", () => {
    expect(headerToField("이동일자(주희→JS)")).toBe("shipDate");
    expect(headerToField("이동일자")).toBe("shipDate");
    expect(headerToField("복귀일자(JS→주희)")).toBe("returnDate");
    expect(headerToField("복귀일자")).toBe("returnDate");
  });

  it("앞뒤 공백과 내부 공백 차이를 허용한다", () => {
    expect(headerToField("  오더번호  ")).toBe("orderNo");
  });

  it("모르는 헤더는 null을 반환한다", () => {
    expect(headerToField("알수없는열")).toBeNull();
  });
});

describe("isIgnoredComputedHeader", () => {
  it("양품수량/차이 계산열은 항상 무시 대상으로 인식한다", () => {
    expect(isIgnoredComputedHeader("양품수량")).toBe(true);
    expect(isIgnoredComputedHeader("양품수량(=검수-불량)")).toBe(true);
    expect(isIgnoredComputedHeader("차이(=이동-복귀)")).toBe(true);
    expect(isIgnoredComputedHeader("비고")).toBe(false);
  });
});
