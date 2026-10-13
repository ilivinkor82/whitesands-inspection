"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDateTimeKST } from "@/lib/datetime";

interface ImportRow {
  id: string;
  filename: string;
  type: string;
  uploadedAt: string;
  uploadedBy: string | null;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
}

export function ImportHistoryTable() {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/import/history");
      const data = await res.json();
      setRows(data.imports ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function patchRow(id: string, patch: Record<string, unknown>) {
    setSavingId(id);
    try {
      const res = await fetch(`/api/import/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (res.ok) {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...data.item } : r)));
      } else {
        alert(data.error ?? "저장에 실패했습니다");
      }
    } finally {
      setSavingId(null);
    }
  }

  async function deleteRow(row: ImportRow) {
    if (
      !confirm(
        `이 업로드 이력을 삭제하시겠습니까?\n${row.filename} (${formatDateTimeKST(new Date(row.uploadedAt))})\n` +
          `이 이력만 지워질 뿐, 이미 반영된 현황(OrderLine) 데이터는 그대로 남습니다. 되돌릴 수 없습니다.`
      )
    ) {
      return;
    }
    setSavingId(row.id);
    try {
      const res = await fetch(`/api/import/${row.id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setRows((prev) => prev.filter((r) => r.id !== row.id));
      } else {
        alert(data.error ?? "삭제에 실패했습니다");
      }
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="card">
      {loading ? (
        <p>불러오는 중...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>업로드 시각(KST)</th>
              <th>업로드한 사람</th>
              <th>파일명</th>
              <th>종류</th>
              <th>신규</th>
              <th>수정</th>
              <th>건너뜀</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} style={{ opacity: savingId === row.id ? 0.5 : 1 }}>
                <td>{formatDateTimeKST(new Date(row.uploadedAt))}</td>
                <td>{row.uploadedBy ?? "-"}</td>
                <td>
                  <input
                    type="text"
                    defaultValue={row.filename}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== row.filename) patchRow(row.id, { filename: v });
                    }}
                    style={{ width: 220 }}
                  />
                </td>
                <td>{row.type}</td>
                <td>{row.insertedCount}</td>
                <td>{row.updatedCount}</td>
                <td>{row.skippedCount}</td>
                <td>
                  <button className="btn secondary" style={{ padding: "2px 8px", fontSize: 11 }} onClick={() => deleteRow(row)}>
                    삭제
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8}>검수등록 이력이 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
