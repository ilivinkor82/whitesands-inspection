import { TopNav } from "@/components/TopNav";
import { ImportClient } from "./ImportClient";

export default function ImportPage() {
  return (
    <>
      <TopNav />
      <div className="page">
        <h1>엑셀 업로드</h1>
        <p>
          출고요청서 또는 검수결과 엑셀(.xlsx)을 업로드하면 변경 내용을 미리보기로 보여줍니다.
          확인 후 선택한 행만 반영됩니다 — 업로드만으로는 아무것도 바뀌지 않습니다.
        </p>
        <p>
          <a href="/api/import/template" className="btn secondary" style={{ textDecoration: "none" }}>
            양식 파일 다운로드 (.xlsx)
          </a>
        </p>
        <ImportClient />
      </div>
    </>
  );
}
