import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseWorkbook } from "@/lib/excel/parseWorkbook";

function buildWorkbookBuffer(rows: unknown[][]): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

describe("parseWorkbook", () => {
  it("CX261012-01 출고요청 2행을 정확히 파싱한다", () => {
    const buffer = buildWorkbookBuffer([
      ["오더번호", "상품코드", "컬러코드", "상품명", "컬러", "출고요청수량", "이동일자(주희→JS)", "이동수량"],
      [
        "CX261012-01",
        "WLF10N9S",
        "WLF10N9SAPPX",
        "[화이트샌즈] 26FW 헤이즈 니트 비니 마요르",
        "애쉬퍼플",
        60,
        "2026-10-13",
        60,
      ],
      [
        "CX261012-01",
        "WLF10N9S",
        "WLF10N9SCLPX",
        "[화이트샌즈] 26FW 헤이즈 니트 비니 마요르",
        "클라우드핑크",
        60,
        "2026-10-13",
        60,
      ],
    ]);

    const result = parseWorkbook(buffer);

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].error).toBeNull();
    expect(result.rows[0].data.orderNo).toBe("CX261012-01");
    expect(result.rows[0].data.colorCode).toBe("WLF10N9SAPPX");
    expect(result.rows[0].data.requestedQty).toBe(60);
    expect(result.rows[0].data.shipDate).toBeInstanceOf(Date);
    expect((result.rows[0].data.shipDate as Date).getFullYear()).toBe(2026);
    expect((result.rows[0].data.shipDate as Date).getMonth()).toBe(9); // 0-indexed → 10월
    expect((result.rows[0].data.shipDate as Date).getDate()).toBe(13);
    expect(result.importType).toBe("SHIPMENT");
  });

  it("숫자로 읽을 수 없는 셀은 에러 행으로 분류한다", () => {
    const buffer = buildWorkbookBuffer([
      ["오더번호", "상품코드", "컬러코드", "출고요청수량"],
      ["CX261012-01", "WLF10N9S", "WLF10N9SAPPX", "육십개"],
    ]);

    const result = parseWorkbook(buffer);
    expect(result.rows[0].error).toMatch(/숫자가 아님/);
  });

  it("필수 식별자가 빠지면 에러 행으로 분류한다", () => {
    const buffer = buildWorkbookBuffer([
      ["오더번호", "상품코드", "컬러코드"],
      ["CX261012-01", "", "WLF10N9SAPPX"],
    ]);

    const result = parseWorkbook(buffer);
    expect(result.rows[0].error).toMatch(/필수 식별자 누락/);
  });

  it("검수결과 전용 파일은 headerFieldsPresent가 검수 필드만 포함하고 importType=INSPECTION이다", () => {
    const buffer = buildWorkbookBuffer([
      ["오더번호", "상품코드", "컬러코드", "검수수량", "불량수량", "복귀일자", "복귀수량"],
      ["CX261012-01", "WLF10N9S", "WLF10N9SAPPX", 60, 2, "2026-10-20", 58],
    ]);

    const result = parseWorkbook(buffer);
    expect(result.importType).toBe("INSPECTION");
    expect(result.headerFieldsPresent).toContain("inspectedQty");
    expect(result.headerFieldsPresent).not.toContain("requestedQty");
  });

  it("알 수 없는 열은 ignoredColumns에 보고되고 파싱을 막지 않는다", () => {
    const buffer = buildWorkbookBuffer([
      ["오더번호", "상품코드", "컬러코드", "담당자"],
      ["CX261012-01", "WLF10N9S", "WLF10N9SAPPX", "홍길동"],
    ]);

    const result = parseWorkbook(buffer);
    expect(result.ignoredColumns).toContain("담당자");
    expect(result.rows[0].error).toBeNull();
  });

  it("양품수량/차이 같은 계산열이 있어도 무시하고 덮어쓰지 않는다", () => {
    const buffer = buildWorkbookBuffer([
      ["오더번호", "상품코드", "컬러코드", "검수수량", "불량수량", "양품수량(=검수-불량)"],
      ["CX261012-01", "WLF10N9S", "WLF10N9SAPPX", 60, 2, 999],
    ]);

    const result = parseWorkbook(buffer);
    expect(result.ignoredColumns).not.toContain("양품수량(=검수-불량)");
    expect(result.headerFieldsPresent).not.toContain("goodQty" as never);
    expect(result.rows[0].data).not.toHaveProperty("goodQty");
  });

  it("택배 발주서 양식(오더제목/상품컬러코드/옵션(수집)/수량/출고일)을 인식하고 개인정보 열은 무시한다", () => {
    const buffer = buildWorkbookBuffer([
      [
        "출고일",
        "오더제목",
        "전산처리방법",
        "수령인(Recipient)",
        "받는분연락처",
        "주소",
        "상품명(수집)",
        "수량",
        "상품코드",
        "상품컬러코드",
        "옵션(수집)",
      ],
      [
        "2026-10-08",
        "CX261008-01",
        "매장출고등록(주희물류->롯데백화점 잠실점)",
        "김양자",
        "01093682501",
        "서울시 광진구 광장동 145-8",
        "[화이트샌즈 그린라벨] 25SS 500 AIR 초경량 UV 우양산 아크라",
        1,
        "GKM61Z9Z",
        "GKM61Z9ZBEX",
        "색상: 베이지",
      ],
    ]);

    const result = parseWorkbook(buffer);
    const row = result.rows[0];

    expect(row.error).toBeNull();
    expect(row.data.orderNo).toBe("CX261008-01");
    expect(row.data.productCode).toBe("GKM61Z9Z");
    expect(row.data.colorCode).toBe("GKM61Z9ZBEX");
    expect(row.data.colorName).toBe("베이지"); // "색상: 베이지"에서 추출
    expect(row.data.shippedQty).toBe(1);
    expect(row.data.notes).toMatch(/매장출고등록/);

    // 개인정보 열은 어떤 필드로도 매핑되지 않아 row.data에 값 자체가 절대 들어가지 않는다
    expect(result.ignoredColumns).toEqual(
      expect.arrayContaining(["수령인(Recipient)", "받는분연락처", "주소"])
    );
    for (const value of Object.values(row.data)) {
      expect(value).not.toBe("김양자");
      expect(value).not.toBe("01093682501");
    }
  });
});
