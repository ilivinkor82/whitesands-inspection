"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FIELD_DEFS, type OrderLineField } from "@/lib/excel/headerMap";

type Value = string | number | null;

interface NewRow {
  kind: "NEW";
  rowIndex: number;
  data: Record<string, Value>;
}

interface UpdateRow {
  kind: "UPDATE";
  rowIndex: number;
  id: string;
  key: { orderNo: string; productCode: string; colorCode: string };
  changes: Record<string, { old: Value; new: Value }>;
}

interface ErrorRow {
  kind: "ERROR";
  rowIndex: number;
  reason: string;
  rawData: Record<string, Value>;
}

interface ParseResponse {
  error?: string;
  needsSheetSelection?: boolean;
  sheetNames?: string[];
  sheetName?: string;
  ignoredColumns?: string[];
  headerFieldsPresent?: OrderLineField[];
  importType?: "SHIPMENT" | "INSPECTION" | "MIXED";
  filename?: string;
  newRows?: NewRow[];
  updatedRows?: UpdateRow[];
  unchangedCount?: number;
  errorRows?: ErrorRow[];
}

const LABEL: Record<string, string> = Object.fromEntries(
  FIELD_DEFS.map((d) => [d.field, d.headers[0]])
);

function formatValue(v: Value): string {
  if (v == null) return "";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10);
  return String(v);
}

export function ImportClient() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResponse | null>(null);
  const [selectedNew, setSelectedNew] = useState<Set<number>>(new Set());
  const [selectedUpdate, setSelectedUpdate] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<{
    insertedCount: number;
    updatedCount: number;
    skippedCount: number;
  } | null>(null);

  const columns = useMemo(
    () => FIELD_DEFS.filter((d) => parseResult?.headerFieldsPresent?.includes(d.field)).map((d) => d.field),
    [parseResult]
  );

  async function doParse(sheetName?: string) {
    if (!file) return;
    setLoading(true);
    setError(null);
    setCommitResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (sheetName) formData.append("sheetName", sheetName);
      const res = await fetch("/api/import/parse", { method: "POST", body: formData });
      const data: ParseResponse = await res.json();
      if (!res.ok) {
        setError(data.error ?? "파싱에 실패했습니다");
        return;
      }
      setParseResult(data);
      setSelectedNew(new Set((data.newRows ?? []).map((r) => r.rowIndex)));
      setSelectedUpdate(new Set((data.updatedRows ?? []).map((r) => r.rowIndex)));
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    if (!parseResult) return;
    setLoading(true);
    setError(null);
    try {
      const newRows = (parseResult.newRows ?? []).filter((r) => selectedNew.has(r.rowIndex));
      const updatedRows = (parseResult.updatedRows ?? []).filter((r) => selectedUpdate.has(r.rowIndex));
      const res = await fetch("/api/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: parseResult.filename,
          importType: parseResult.importType,
          newRows,
          updatedRows,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "반영에 실패했습니다");
        return;
      }
      setCommitResult(data);
      setParseResult(null);
      setFile(null);
    } finally {
      setLoading(false);
    }
  }

  function toggle(set: Set<number>, setFn: (s: Set<number>) => void, idx: number) {
    const next = new Set(set);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setFn(next);
  }

  if (commitResult) {
    return (
      <div className="card">
        <h2>반영 완료</h2>
        <p>
          신규 {commitResult.insertedCount}건 · 수정 {commitResult.updatedCount}건 · 건너뜀{" "}
          {commitResult.skippedCount}건
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={() => router.push("/orders")}>
            현황 보기
          </button>
          <button className="btn secondary" onClick={() => setCommitResult(null)}>
            다른 파일 업로드
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setParseResult(null);
          }}
        />
        <button className="btn" style={{ marginLeft: 12 }} disabled={!file || loading} onClick={() => doParse()}>
          {loading ? "처리 중..." : "파일 분석"}
        </button>
        {error && <p className="error-text">{error}</p>}
      </div>

      {parseResult?.needsSheetSelection && (
        <div className="card">
          <p>시트가 여러 개입니다. 사용할 시트를 선택하세요.</p>
          {parseResult.sheetNames?.map((name) => (
            <button key={name} className="btn secondary" style={{ marginRight: 8 }} onClick={() => doParse(name)}>
              {name}
            </button>
          ))}
        </div>
      )}

      {parseResult && !parseResult.needsSheetSelection && (
        <div className="card">
          <div className="summary-bar">
            <span>신규 {parseResult.newRows?.length ?? 0}건</span>
            <span>수정 {parseResult.updatedRows?.length ?? 0}건</span>
            <span>변경없음 {parseResult.unchangedCount ?? 0}건</span>
            <span className={parseResult.errorRows?.length ? "error-text" : ""}>
              오류 {parseResult.errorRows?.length ?? 0}건
            </span>
          </div>

          {parseResult.ignoredColumns && parseResult.ignoredColumns.length > 0 && (
            <p style={{ color: "#888" }}>무시된 열: {parseResult.ignoredColumns.join(", ")}</p>
          )}

          {(parseResult.newRows?.length ?? 0) > 0 && (
            <>
              <h3>신규 행</h3>
              <table>
                <thead>
                  <tr>
                    <th></th>
                    {columns.map((c) => (
                      <th key={c}>{LABEL[c]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parseResult.newRows!.map((row) => (
                    <tr key={row.rowIndex} className="row-new">
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedNew.has(row.rowIndex)}
                          onChange={() => toggle(selectedNew, setSelectedNew, row.rowIndex)}
                        />
                      </td>
                      {columns.map((c) => (
                        <td key={c}>{formatValue(row.data[c])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {(parseResult.updatedRows?.length ?? 0) > 0 && (
            <>
              <h3>수정 행 (바뀐 값만 표시)</h3>
              <table>
                <thead>
                  <tr>
                    <th></th>
                    <th>오더번호</th>
                    <th>상품코드</th>
                    <th>컬러코드</th>
                    <th>변경 내용</th>
                  </tr>
                </thead>
                <tbody>
                  {parseResult.updatedRows!.map((row) => (
                    <tr key={row.rowIndex} className="row-update">
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedUpdate.has(row.rowIndex)}
                          onChange={() => toggle(selectedUpdate, setSelectedUpdate, row.rowIndex)}
                        />
                      </td>
                      <td>{row.key.orderNo}</td>
                      <td>{row.key.productCode}</td>
                      <td>{row.key.colorCode}</td>
                      <td style={{ textAlign: "left", whiteSpace: "normal" }}>
                        {Object.entries(row.changes).map(([field, change]) => (
                          <div key={field} className="changed-cell">
                            {LABEL[field] ?? field}:{" "}
                            <span className="old-value">{formatValue(change.old) || "(없음)"}</span>→{" "}
                            {formatValue(change.new) || "(없음)"}
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {(parseResult.errorRows?.length ?? 0) > 0 && (
            <>
              <h3>오류 행 (반영되지 않음)</h3>
              <table>
                <thead>
                  <tr>
                    <th>엑셀 행 번호</th>
                    <th>이유</th>
                  </tr>
                </thead>
                <tbody>
                  {parseResult.errorRows!.map((row) => (
                    <tr key={row.rowIndex} className="row-error">
                      <td>{row.rowIndex}</td>
                      <td className="error-text" style={{ textAlign: "left", whiteSpace: "normal" }}>
                        {row.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div style={{ marginTop: 16 }}>
            <button
              className="btn"
              disabled={loading || (selectedNew.size === 0 && selectedUpdate.size === 0)}
              onClick={handleCommit}
            >
              {loading ? "반영 중..." : `선택한 ${selectedNew.size + selectedUpdate.size}건 가져오기 확정`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
