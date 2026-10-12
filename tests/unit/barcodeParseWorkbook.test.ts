import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseBarcodeWorkbook } from "@/lib/barcode/parseWorkbook";
import { barcodeHeaderToField } from "@/lib/barcode/headerMap";

function buildWorkbookBuffer(rows: unknown[][]): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

describe("barcodeHeaderToField", () => {
  it("한글 헤더를 필드명으로 매핑한다", () => {
    expect(barcodeHeaderToField("상품코드")).toBe("productCode");
    expect(barcodeHeaderToField("바코드1")).toBe("barcode1");
    expect(barcodeHeaderToField("바코드2")).toBe("barcode2");
  });
});

describe("parseBarcodeWorkbook", () => {
  it("정상 행을 파싱한다", () => {
    const buffer = buildWorkbookBuffer([
      ["상품코드", "상품명", "컬러", "사이즈", "바코드1", "바코드2"],
      ["GLM102Z9Z", "26SS 650F 원터치 폴딩랩 UV 우양산 이리스", "애프리콧", "ONE SIZE", "8800230027769", ""],
    ]);
    const rows = parseBarcodeWorkbook(buffer);
    expect(rows[0].error).toBeNull();
    expect(rows[0].data.productCode).toBe("GLM102Z9Z");
    expect(rows[0].data.barcode1).toBe("8800230027769");
    expect(rows[0].data.barcode2).toBeUndefined();
  });

  it("바코드1이 없으면 에러 행으로 분류한다", () => {
    const buffer = buildWorkbookBuffer([
      ["상품코드", "상품명", "컬러", "사이즈", "바코드1"],
      ["GLM102Z9Z", "상품명", "애프리콧", "ONE SIZE", ""],
    ]);
    const rows = parseBarcodeWorkbook(buffer);
    expect(rows[0].error).toMatch(/바코드1/);
  });
});
