import { describe, expect, it } from "vitest";
import { classifyDiff, type ExistingOrderLineRow } from "@/lib/excel/diff";
import type { ParseResult, ParsedRow } from "@/lib/excel/parseWorkbook";

function makeExisting(overrides: Partial<ExistingOrderLineRow> = {}): ExistingOrderLineRow {
  return {
    id: "row-1",
    orderNo: "CX261012-01",
    productCode: "WLF10N9S",
    colorCode: "WLF10N9SAPPX",
    productName: "[화이트샌즈] 26FW 헤이즈 니트 비니 마요르",
    colorName: "애쉬퍼플",
    requestedQty: 60,
    shipDate: new Date(2026, 9, 13),
    shippedQty: 60,
    inspectedQty: null,
    defectQty: null,
    returnDate: null,
    returnQty: null,
    notes: null,
    ...overrides,
  };
}

function makeParseResult(rows: ParsedRow[], headerFieldsPresent: ParseResult["headerFieldsPresent"]): ParseResult {
  return {
    sheetName: "Sheet1",
    ignoredColumns: [],
    headerFieldsPresent,
    rows,
    importType: "MIXED",
  };
}

describe("classifyDiff", () => {
  it("기존 DB에 없는 키는 NEW로 분류한다", () => {
    const parsed = makeParseResult(
      [
        {
          rowIndex: 2,
          error: null,
          data: { orderNo: "CX261012-01", productCode: "WLF10N9S", colorCode: "WLF10N9SCLPX", requestedQty: 60 },
        },
      ],
      ["orderNo", "productCode", "colorCode", "requestedQty"]
    );

    const diff = classifyDiff(parsed, [makeExisting()]); // 기존엔 APPX만 있음, CLPX는 없음

    expect(diff.newRows).toHaveLength(1);
    expect(diff.updatedRows).toHaveLength(0);
  });

  it("값이 바뀐 필드만 UPDATE changes에 포함한다", () => {
    const parsed = makeParseResult(
      [
        {
          rowIndex: 2,
          error: null,
          data: {
            orderNo: "CX261012-01",
            productCode: "WLF10N9S",
            colorCode: "WLF10N9SAPPX",
            inspectedQty: 60,
            defectQty: 3,
          },
        },
      ],
      ["orderNo", "productCode", "colorCode", "inspectedQty", "defectQty"]
    );

    const diff = classifyDiff(parsed, [makeExisting({ inspectedQty: null, defectQty: null })]);

    expect(diff.updatedRows).toHaveLength(1);
    expect(diff.updatedRows[0].changes).toHaveProperty("inspectedQty");
    expect(diff.updatedRows[0].changes).toHaveProperty("defectQty");
    expect(diff.updatedRows[0].changes.inspectedQty).toEqual({ old: null, new: 60 });
  });

  it("값이 모두 같으면 UNCHANGED로 집계된다", () => {
    const parsed = makeParseResult(
      [
        {
          rowIndex: 2,
          error: null,
          data: { orderNo: "CX261012-01", productCode: "WLF10N9S", colorCode: "WLF10N9SAPPX", requestedQty: 60 },
        },
      ],
      ["orderNo", "productCode", "colorCode", "requestedQty"]
    );

    const diff = classifyDiff(parsed, [makeExisting({ requestedQty: 60 })]);

    expect(diff.updatedRows).toHaveLength(0);
    expect(diff.newRows).toHaveLength(0);
    expect(diff.unchangedCount).toBe(1);
  });

  it("회귀 테스트: 검수결과 전용 업로드는 출고 필드를 절대 건드리지 않는다", () => {
    // 이 업로드 파일은 검수수량/불량수량만 있고 출고요청수량/이동일자/이동수량 열이 없다.
    const parsed = makeParseResult(
      [
        {
          rowIndex: 2,
          error: null,
          data: {
            orderNo: "CX261012-01",
            productCode: "WLF10N9S",
            colorCode: "WLF10N9SAPPX",
            inspectedQty: 60,
            defectQty: 2,
          },
        },
      ],
      ["orderNo", "productCode", "colorCode", "inspectedQty", "defectQty"]
    );

    const existing = makeExisting({ requestedQty: 60, shippedQty: 60 });
    const diff = classifyDiff(parsed, [existing]);

    expect(diff.updatedRows).toHaveLength(1);
    const { changes } = diff.updatedRows[0];
    expect(changes).toHaveProperty("inspectedQty");
    expect(changes).toHaveProperty("defectQty");
    // 출고 관련 필드는 파일 헤더에 없었으므로 changes에 전혀 나타나선 안 된다
    expect(changes).not.toHaveProperty("requestedQty");
    expect(changes).not.toHaveProperty("shippedQty");
    expect(changes).not.toHaveProperty("shipDate");
  });

  it("필수 식별자가 없는 에러 행은 ERROR로 분류되고 비교 대상에서 빠진다", () => {
    const parsed = makeParseResult(
      [
        {
          rowIndex: 2,
          error: "필수 식별자 누락: 상품코드",
          data: { orderNo: "CX261012-01", colorCode: "WLF10N9SAPPX" },
        },
      ],
      ["orderNo", "productCode", "colorCode"]
    );

    const diff = classifyDiff(parsed, [makeExisting()]);

    expect(diff.errorRows).toHaveLength(1);
    expect(diff.newRows).toHaveLength(0);
    expect(diff.updatedRows).toHaveLength(0);
  });
});
