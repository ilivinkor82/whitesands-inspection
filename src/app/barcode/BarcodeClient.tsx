"use client";

import { useEffect, useRef, useState } from "react";

interface BarcodeProductRow {
  id: string;
  productCode: string;
  productName: string;
  colorName: string;
  sizeName: string;
  barcode1: string;
  barcode2: string | null;
}

type Step = "order" | "product" | "scan";

export function BarcodeClient() {
  const [step, setStep] = useState<Step>("order");
  const [orderNo, setOrderNo] = useState("");
  const [orderSuggestions, setOrderSuggestions] = useState<string[]>([]);

  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<BarcodeProductRow[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<BarcodeProductRow | null>(null);

  const [scanValue, setScanValue] = useState("");
  const [lastResult, setLastResult] = useState<{
    result: "MATCH" | "MISMATCH";
    scanned: string;
    expected: string | null;
    orderLineStatus: "UPDATED" | "NOT_FOUND" | "AMBIGUOUS";
  } | null>(null);
  const [counts, setCounts] = useState({ matchCount: 0, mismatchCount: 0 });
  const [scanning, setScanning] = useState(false);

  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const scanInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/barcode/orders")
      .then((r) => r.json())
      .then((d) => setOrderSuggestions(d.orderNumbers ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (step === "scan" && orderNo) {
      fetch(`/api/barcode/scan/summary?orderNo=${encodeURIComponent(orderNo)}`)
        .then((r) => r.json())
        .then((d) => setCounts({ matchCount: d.matchCount ?? 0, mismatchCount: d.mismatchCount ?? 0 }))
        .catch(() => {});
      scanInputRef.current?.focus();
    }
  }, [step, orderNo]);

  // 스캐너가 Enter(줄바꿈)를 안 보내는 모델도 있어서, 입력이 잠깐(400ms) 멈추면
  // 자동으로 판정한다 — Enter 입력은 즉시 판정, 이건 보조 수단.
  useEffect(() => {
    if (step !== "scan" || !scanValue.trim()) return;
    const timer = setTimeout(() => {
      handleScan();
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanValue, step]);

  async function searchProducts(q: string) {
    setProductQuery(q);
    if (!q.trim()) {
      setProductResults([]);
      return;
    }
    const res = await fetch(`/api/barcode/products?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setProductResults(data.products ?? []);
  }

  function pickProduct(p: BarcodeProductRow) {
    setSelectedProduct(p);
    setLastResult(null);
    setStep("scan");
  }

  async function handleScan() {
    const code = scanValue.trim();
    if (!code || !selectedProduct || scanning) return;
    setScanning(true);
    try {
      const res = await fetch("/api/barcode/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNo,
          productCode: selectedProduct.productCode,
          productName: selectedProduct.productName,
          colorName: selectedProduct.colorName,
          sizeName: selectedProduct.sizeName,
          scannedBarcode: code,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setLastResult({
          result: data.result,
          scanned: code,
          expected: data.expectedBarcode,
          orderLineStatus: data.orderLineStatus,
        });
        setCounts({ matchCount: data.matchCount, mismatchCount: data.mismatchCount });
      }
    } finally {
      setScanValue("");
      setScanning(false);
      scanInputRef.current?.focus();
    }
  }

  async function handleTemplateDownload() {
    window.location.href = "/api/barcode/products/template";
  }

  async function handleHistoryDownload() {
    const url = orderNo
      ? `/api/barcode/scan/export?orderNo=${encodeURIComponent(orderNo)}`
      : "/api/barcode/scan/export";
    window.location.href = url;
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/barcode/products/import", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        setImportMessage(
          `추가 ${data.insertedCount}건 · 갱신 ${data.updatedCount}건` +
            (data.errorRows?.length ? ` · 오류 ${data.errorRows.length}건` : "")
        );
      } else {
        setImportMessage(data.error ?? "업로드 실패");
      }
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn secondary" onClick={handleTemplateDownload}>
          엑셀 양식 다운로드
        </button>
        <label className="btn secondary" style={{ cursor: "pointer" }}>
          {importing ? "업로드 중..." : "엑셀 업로드(추가/병합)"}
          <input type="file" accept=".xlsx,.xls" onChange={handleImport} style={{ display: "none" }} disabled={importing} />
        </label>
        <button className="btn secondary" onClick={handleHistoryDownload}>
          검수내역 다운로드{orderNo ? ` (${orderNo})` : " (전체)"}
        </button>
        {importMessage && <span>{importMessage}</span>}
      </div>

      {step === "order" && (
        <div className="card">
          <h3>1단계) 오더번호 입력</h3>
          <input
            type="text"
            list="order-suggestions"
            value={orderNo}
            onChange={(e) => setOrderNo(e.target.value)}
            placeholder="예: CX261012-01"
            style={{ width: 280 }}
          />
          <datalist id="order-suggestions">
            {orderSuggestions.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
          <div style={{ marginTop: 12 }}>
            <button className="btn" disabled={!orderNo.trim()} onClick={() => setStep("product")}>
              다음
            </button>
          </div>
        </div>
      )}

      {step === "product" && (
        <div className="card">
          <button className="btn secondary" style={{ marginBottom: 12 }} onClick={() => setStep("order")}>
            ← 오더번호 변경
          </button>
          <h3>2단계) 검수할 상품 선택 (오더: {orderNo})</h3>
          <input
            type="text"
            placeholder="품번 또는 상품명 검색"
            value={productQuery}
            onChange={(e) => searchProducts(e.target.value)}
            style={{ width: 320 }}
            autoFocus
          />
          <table style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>상품코드</th>
                <th>상품명</th>
                <th>컬러</th>
                <th>사이즈</th>
              </tr>
            </thead>
            <tbody>
              {productResults.map((p) => (
                <tr key={p.id} className="product-pick-row" onClick={() => pickProduct(p)}>
                  <td>{p.productCode}</td>
                  <td style={{ textAlign: "left", whiteSpace: "normal" }}>{p.productName}</td>
                  <td>{p.colorName}</td>
                  <td>{p.sizeName}</td>
                </tr>
              ))}
              {productQuery && productResults.length === 0 && (
                <tr>
                  <td colSpan={4}>검색 결과가 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {step === "scan" && selectedProduct && (
        <div className="card">
          <button
            className="btn secondary"
            style={{ marginBottom: 12 }}
            onClick={() => {
              setStep("product");
              setLastResult(null);
            }}
          >
            ← 다른 상품 선택
          </button>
          <div className="summary-bar">
            <span>오더: {orderNo}</span>
            <span>
              오늘 검수 — 일치 {counts.matchCount} / 불일치 {counts.mismatchCount}
            </span>
          </div>
          <h3>
            {selectedProduct.productCode} · {selectedProduct.productName} · {selectedProduct.colorName} /{" "}
            {selectedProduct.sizeName}
          </h3>

          <input
            ref={scanInputRef}
            type="text"
            value={scanValue}
            onChange={(e) => setScanValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleScan();
              }
            }}
            placeholder="여기를 클릭하고 바코드를 스캔하세요"
            style={{ width: "100%", fontSize: 20, padding: 10 }}
            autoFocus
          />

          {lastResult ? (
            <div className={`scan-banner ${lastResult.result === "MATCH" ? "match" : "mismatch"}`}>
              {lastResult.result === "MATCH" ? "일치" : "불일치"}
              <div style={{ fontSize: 16, marginTop: 8, fontWeight: "normal" }}>
                스캔: {lastResult.scanned}
                {lastResult.result === "MISMATCH" && ` / 기대: ${lastResult.expected ?? "(등록된 바코드 없음)"}`}
              </div>
              <div style={{ fontSize: 13, marginTop: 4, fontWeight: "normal", opacity: 0.9 }}>
                {lastResult.orderLineStatus === "UPDATED" && "✓ 현황(검수수량/불량수량)에 반영됨"}
                {lastResult.orderLineStatus === "NOT_FOUND" &&
                  "⚠ 현황에서 이 오더번호+상품+컬러를 찾지 못해 반영되지 않음"}
                {lastResult.orderLineStatus === "AMBIGUOUS" &&
                  "⚠ 현황에 같은 조건의 행이 여러 개라 반영되지 않음 — 직접 확인 필요"}
              </div>
            </div>
          ) : (
            <div className="scan-banner idle">스캔 대기 중</div>
          )}
        </div>
      )}
    </div>
  );
}
