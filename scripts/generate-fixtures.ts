import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";

const outDir = path.resolve(__dirname, "..", "fixtures");
fs.mkdirSync(outDir, { recursive: true });

function writeWorkbook(filename: string, rows: unknown[][]) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  XLSX.writeFile(workbook, path.join(outDir, filename));
  console.log(`생성: fixtures/${filename}`);
}

// 1) 출고요청서 — CX261012-01, 애쉬퍼플/클라우드핑크 각 60개
writeWorkbook("sample-shipment.xlsx", [
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

// 2) 검수결과 — 같은 키, 검수/불량/복귀 필드만 (출고 필드는 열 자체가 없음)
writeWorkbook("sample-inspection.xlsx", [
  ["오더번호", "상품코드", "컬러코드", "검수수량", "불량수량", "복귀일자(JS→주희)", "복귀수량"],
  ["CX261012-01", "WLF10N9S", "WLF10N9SAPPX", 60, 2, "2026-10-20", 58],
  ["CX261012-01", "WLF10N9S", "WLF10N9SCLPX", 60, 0, "2026-10-20", 60],
]);
