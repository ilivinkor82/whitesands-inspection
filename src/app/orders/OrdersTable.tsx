"use client";

import { useCallback, useEffect, useState } from "react";

interface OrderRow {
  id: string;
  orderNo: string;
  productCode: string;
  colorCode: string;
  productName: string;
  colorName: string;
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

// 컬럼 순서와 1:1 대응 — 늘리거나 줄이면 DEFAULT_COL_WIDTHS도 같이 맞춰야 한다.
const COLUMN_COUNT = 16;
const DEFAULT_COL_WIDTHS = [100, 90, 100, 220, 80, 110, 80, 80, 80, 90, 80, 110, 80, 60, 220, 60];
const COL_WIDTHS_STORAGE_KEY = "orders-table-col-widths-v1";

// 저장된 폭이 이 브라우저에만 적용되는 화면 설정이라 localStorage를 쓴다 — 컬럼
// 개수가 바뀐 옛 저장값이 섞여 있으면(배열 길이가 안 맞으면) 조용히 기본값으로
// 되돌린다.
function loadColWidths(): number[] {
  try {
    const raw = localStorage.getItem(COL_WIDTHS_STORAGE_KEY);
    if (!raw) return DEFAULT_COL_WIDTHS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === COLUMN_COUNT && parsed.every((n) => typeof n === "number" && n > 0)) {
      return parsed;
    }
  } catch {
    // 접근 불가/손상된 값 — 기본값으로 진행
  }
  return DEFAULT_COL_WIDTHS;
}

function saveColWidths(widths: number[]) {
  try {
    localStorage.setItem(COL_WIDTHS_STORAGE_KEY, JSON.stringify(widths));
  } catch {
    // 저장 실패해도 화면 동작엔 지장 없음 — 다음 방문 때 기본값으로 보일 뿐
  }
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
  const [colWidths, setColWidths] = useState<number[]>(DEFAULT_COL_WIDTHS);

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

  useEffect(() => {
    setColWidths(loadColWidths());
  }, []);

  // 헤더 오른쪽 경계를 드래그하는 동안 mousemove/mouseup을 document에 붙여서
  // 마우스가 th 영역을 벗어나도 계속 따라오게 한다 — 드래그 1번(mousedown~up)마다
  // 새로 만든 클로저를 쓰므로, 리렌더로 colWidths가 바뀌어도 add/remove가 같은
  // 함수 참조를 가리켜서 리스너가 꼬이지 않는다.
  function handleResizeStart(index: number, e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = colWidths[index];
    const target = e.currentTarget as HTMLElement;
    target.classList.add("active");

    function onMove(ev: MouseEvent) {
      const next = Math.max(36, startWidth + (ev.clientX - startX));
      setColWidths((prev) => {
        const copy = [...prev];
        copy[index] = next;
        return copy;
      });
    }

    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      target.classList.remove("active");
      setColWidths((current) => {
        saveColWidths(current);
        return current;
      });
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function resetColWidths() {
    setColWidths(DEFAULT_COL_WIDTHS);
    saveColWidths(DEFAULT_COL_WIDTHS);
  }

  function Resizer({ index }: { index: number }) {
    return <span className="col-resizer" onMouseDown={(e) => handleResizeStart(index, e)} />;
  }

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
      <div style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
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
        <button className="btn secondary" onClick={resetColWidths} style={{ marginLeft: "auto" }}>
          열 너비 초기화
        </button>
      </div>

      {loading ? (
        <p>불러오는 중...</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="orders-table">
            <colgroup>
              {colWidths.map((w, i) => (
                <col key={i} style={{ width: w }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th>
                  오더번호
                  <Resizer index={0} />
                </th>
                <th>
                  상품코드
                  <Resizer index={1} />
                </th>
                <th>
                  컬러코드
                  <Resizer index={2} />
                </th>
                <th>
                  상품명
                  <Resizer index={3} />
                </th>
                <th>
                  컬러
                  <Resizer index={4} />
                </th>
                <th>
                  이동일자
                  <br />
                  (주희→제이에스)
                  <Resizer index={5} />
                </th>
                <th>
                  이동수량
                  <Resizer index={6} />
                </th>
                <th>
                  바코드
                  <br />
                  검수수량
                  <Resizer index={7} />
                </th>
                <th>
                  제품
                  <br />
                  검수수량
                  <Resizer index={8} />
                </th>
                <th>
                  바코드불량수량
                  <Resizer index={9} />
                </th>
                <th>
                  양품수량
                  <Resizer index={10} />
                </th>
                <th>
                  복귀일자
                  <br />
                  (제이에스→주희)
                  <Resizer index={11} />
                </th>
                <th>
                  복귀수량
                  <Resizer index={12} />
                </th>
                <th>
                  차이
                  <Resizer index={13} />
                </th>
                <th>
                  비고
                  <Resizer index={14} />
                </th>
                <th>
                  {isAdmin ? "삭제" : ""}
                  <Resizer index={15} />
                </th>
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
                  <td>{toDateInputValue(row.shipDate)}</td>
                  <td className="text-right">
                    <input
                      type="number"
                      defaultValue={row.shippedQty ?? ""}
                      onBlur={(e) =>
                        patchRow(row.id, {
                          shippedQty: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    />
                  </td>
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
                    <input
                      type="number"
                      defaultValue={row.defectQty ?? ""}
                      onBlur={(e) =>
                        patchRow(row.id, {
                          defectQty: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    />
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
                    <textarea
                      defaultValue={row.notes ?? ""}
                      maxLength={1000}
                      rows={2}
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
                  <td colSpan={16}>데이터가 없습니다. 엑셀 업로드로 추가하세요.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
