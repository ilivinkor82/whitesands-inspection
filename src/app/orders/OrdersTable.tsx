"use client";

import { useCallback, useEffect, useState } from "react";

interface OrderRow {
  id: string;
  orderNo: string;
  productCode: string;
  colorCode: string;
  productName: string;
  colorName: string;
  requestedQty: number | null;
  shipDate: string | null;
  shippedQty: number | null;
  scannedQty: number | null;
  inspectedQty: number | null;
  defectQty: number | null;
  goodQty: number | null;
  returnDate: string | null;
  returnQty: number | null;
  diffQty: number | null;
  notes: string | null;
}

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function OrdersTable() {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const load = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders${query ? `?q=${encodeURIComponent(query)}` : ""}`);
      const data = await res.json();
      setRows(data.rows ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => setIsAdmin(d.account?.role === "admin"))
      .catch(() => setIsAdmin(false));
  }, []);

  async function deleteRow(row: OrderRow) {
    if (!confirm(`삭제하시겠습니까?\n${row.orderNo} / ${row.productCode} / ${row.colorName}\n되돌릴 수 없습니다.`)) {
      return;
    }
    setSavingId(row.id);
    try {
      const res = await fetch(`/api/orders/${row.id}`, { method: "DELETE" });
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

  async function patchRow(id: string, patch: Record<string, unknown>) {
    setSavingId(id);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (res.ok) {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...data.row } : r)));
      } else {
        alert(data.error ?? "저장에 실패했습니다");
      }
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="card">
      <div style={{ marginBottom: 12, display: "flex", gap: 8 }}>
        <input
          type="text"
          placeholder="오더번호 / 상품코드 / 컬러 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(q)}
          style={{ width: 280 }}
        />
        <button className="btn secondary" onClick={() => load(q)}>
          검색
        </button>
      </div>

      {loading ? (
        <p>불러오는 중...</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="orders-table">
            <colgroup>
              <col style={{ width: "7%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "5%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "5%" }} />
              <col style={{ width: "5%" }} />
              <col style={{ width: "5%" }} />
              <col style={{ width: "5%" }} />
              <col style={{ width: "5%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "5%" }} />
              <col style={{ width: "4%" }} />
              <col style={{ width: "5%" }} />
              <col style={{ width: "4%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>오더번호</th>
                <th>상품코드</th>
                <th>컬러코드</th>
                <th>상품명</th>
                <th>컬러</th>
                <th>출고요청수량</th>
                <th>
                  이동일자
                  <br />
                  (주희→제이에스)
                </th>
                <th>이동수량</th>
                <th>
                  바코드
                  <br />
                  검수수량
                </th>
                <th>
                  제품
                  <br />
                  검수수량
                </th>
                <th>불량수량</th>
                <th>양품수량</th>
                <th>
                  복귀일자
                  <br />
                  (제이에스→주희)
                </th>
                <th>복귀수량</th>
                <th>차이</th>
                <th>비고</th>
                <th>{isAdmin ? "삭제" : ""}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} style={{ opacity: savingId === row.id ? 0.5 : 1 }}>
                  <td className="text-left">{row.orderNo}</td>
                  <td className="text-left">{row.productCode}</td>
                  <td className="text-left">{row.colorCode}</td>
                  <td className="text-left product-name">{row.productName}</td>
                  <td className="text-left">{row.colorName}</td>
                  <td className="text-right">{row.requestedQty ?? ""}</td>
                  <td>{toDateInputValue(row.shipDate)}</td>
                  <td className="text-right">{row.shippedQty ?? ""}</td>
                  <td className="text-right">{row.scannedQty ?? ""}</td>
                  <td className="text-right">
                    <input
                      type="number"
                      defaultValue={row.inspectedQty ?? ""}
                      onBlur={(e) =>
                        patchRow(row.id, {
                          inspectedQty: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    />
                  </td>
                  <td className="text-right">
                    {isAdmin ? (
                      <input
                        type="number"
                        defaultValue={row.defectQty ?? ""}
                        onBlur={(e) =>
                          patchRow(row.id, {
                            defectQty: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                      />
                    ) : (
                      row.defectQty ?? ""
                    )}
                  </td>
                  <td className="text-right">{row.goodQty ?? ""}</td>
                  <td>
                    <input
                      type="date"
                      defaultValue={toDateInputValue(row.returnDate)}
                      onBlur={(e) => patchRow(row.id, { returnDate: e.target.value || null })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      defaultValue={row.returnQty ?? ""}
                      onBlur={(e) =>
                        patchRow(row.id, {
                          returnQty: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    />
                  </td>
                  <td className="text-right">{row.diffQty ?? ""}</td>
                  <td className="text-left">
                    <input
                      type="text"
                      defaultValue={row.notes ?? ""}
                      onBlur={(e) => patchRow(row.id, { notes: e.target.value || null })}
                    />
                  </td>
                  <td>
                    {isAdmin && (
                      <button className="btn secondary" style={{ padding: "2px 8px", fontSize: 11 }} onClick={() => deleteRow(row)}>
                        삭제
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={17}>데이터가 없습니다. 엑셀 업로드로 추가하세요.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
