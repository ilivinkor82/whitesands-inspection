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

  it("사이즈 열이 없으면 ONE SIZE로 기본값 처리한다 (에러 아님)", () => {
    const buffer = buildWorkbookBuffer([
      ["상품코드", "상품명", "컬러", "바코드1"],
      ["GLM102Z9Z", "상품명", "애프리콧", "8800230027769"],
    ]);
    const rows = parseBarcodeWorkbook(buffer);
    expect(rows[0].error).toBeNull();
    expect(rows[0].data.sizeName).toBe("ONE SIZE");
  });

  it("재고 리포트처럼 1행이 제목이고 2행이 실제 헤더여도 헤더 행을 찾아낸다", () => {
    const buffer = buildWorkbookBuffer([
      [" 재고일자 : 20260930 \r\n 조회구분 : 상품 + 칼라별 ", "", "", "", "", "", "", "", ""],
      ["No", "창고코드", "창고명", "품목", "상품코드", "상품명", "칼라", "칼라명", "바코드"],
      [
        "1",
        "NH",
        "주희물류",
        "우양산",
        "GLM26Z9Z",
        "[화이트샌즈 그린라벨] 26SS 650F 원터치 폴딩랩 UV 우양산 필로스",
        "BE",
        "(핑크&크림)베이지",
        "8800230024546",
      ],
    ]);
    const rows = parseBarcodeWorkbook(buffer);
    expect(rows).toHaveLength(1);
    expect(rows[0].error).toBeNull();
    expect(rows[0].data.productCode).toBe("GLM26Z9Z");
    // "칼라"(코드값 BE)가 아니라 "칼라명"(실제 색상명)이 컬러로 매핑돼야 한다
    expect(rows[0].data.colorName).toBe("(핑크&크림)베이지");
    expect(rows[0].data.barcode1).toBe("8800230024546");
    expect(rows[0].data.sizeName).toBe("ONE SIZE");
  });
});
