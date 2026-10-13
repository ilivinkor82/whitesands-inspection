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
  imageUrl: string | null;
}

type Step = "order" | "product" | "scan";

export function BarcodeClient() {
  const [step, setStep] = useState<Step>("order");
  const [orderNo, setOrderNo] = useState("");
  const [orderSuggestions, setOrderSuggestions] = useState<string[]>([]);

  const [productCatalog, setProductCatalog] = useState<{ productCode: string; productName: string }[]>([]);
  const [selectedProductCode, setSelectedProductCode] = useState("");
  const [colorVariants, setColorVariants] = useState<BarcodeProductRow[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState("");
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
  const [isAdmin, setIsAdmin] = useState(false);

  const scanInputRef = useRef<HTMLInputElement>(null);
  // React state(scanning)만으로는 막을 수 없는 중복 제출이 있었다: 스캐너가 보내는
  // Enter와 "0.4초 멈추면 자동판정" 보조 타이머가 같은 스캔에 대해 둘 다 발동하면,
  // 보조 타이머 콜백은 Enter가 눌린 시점 이전에 만들어진 클로저라 scanning state가
  // 아직 false였던 걸 그대로 들고 있어서 가드를 못 뚫었다 — ref는 항상 최신값을
  // 읽으므로 이 문제가 없다.
  const scanningRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/barcode/orders")
      .then((r) => r.json())
      .then((d) => setOrderSuggestions(d.orderNumbers ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/barcode/products/catalog")
      .then((r) => r.json())
      .then((d) => setProductCatalog(d.products ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setSelectedVariantId("");
    if (!selectedProductCode) {
      setColorVariants([]);
      return;
    }
    fetch(`/api/barcode/products/by-code?productCode=${encodeURIComponent(selectedProductCode)}`)
      .then((r) => r.json())
      .then((d) => setColorVariants(d.variants ?? []))
      .catch(() => setColorVariants([]));
  }, [selectedProductCode]);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => setIsAdmin(d.account?.role === "admin"))
      .catch(() => setIsAdmin(false));
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
    debounceTimerRef.current = setTimeout(() => {
      handleScan();
    }, 400);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanValue, step]);

  function pickProduct(p: BarcodeProductRow) {
    setSelectedProduct(p);
    setLastResult(null);
    setStep("scan");
  }

  async function handleScan() {
    const code = scanValue.trim();
    if (!code || !selectedProduct || scanningRef.current) return;
    scanningRef.current = true;
    setScanning(true);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
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
      scanningRef.current = false;
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
        {isAdmin && (
          <button className="btn secondary" onClick={handleTemplateDownload}>
            엑셀 양식 다운로드
          </button>
        )}
        {isAdmin && (
          <label className="btn secondary" style={{ cursor: "pointer" }}>
            {importing ? "업로드 중..." : "제품정보 업로드 (엑셀)"}
            <input type="file" accept=".xlsx,.xls" onChange={handleImport} style={{ display: "none" }} disabled={importing} />
          </label>
        )}
        <button className="btn secondary" onClick={handleHistoryDownload}>
          검수내역 다운로드{orderNo ? ` (${orderNo})` : " (전체)"}
        </button>
        {importMessage && <span>{importMessage}</span>}
      </div>

      {step === "order" && (
        <div className="card">
          <h3>1단계) 오더번호 선택</h3>
          <select
            value={orderNo}
            onChange={(e) => setOrderNo(e.target.value)}
            style={{ width: 280, padding: "6px 8px" }}
          >
            <option value="">-- 업로드된 발주서 중 선택 --</option>
            {orderSuggestions.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          {orderSuggestions.length === 0 && (
            <p style={{ color: "#888", marginTop: 8 }}>
              아직 업로드된 발주서가 없습니다 — 먼저 "검수제품 등록" 메뉴에서 오더를 등록하세요.
            </p>
          )}
          <div style={{ marginTop: 12 }}>
            <button className="btn" disabled={!orderNo.trim()} onClick={() => setStep("product")}>
              다음
            </button>
          </div>
        </div>
      )}

      {step === "product" && (
        <div className="card">
          <button
            className="btn secondary"
            style={{ marginBottom: 12 }}
            onClick={() => {
              setStep("order");
              setSelectedProductCode("");
            }}
          >
            ← 오더번호 변경
          </button>
          <h3>2단계) 검수할 상품 선택 (오더: {orderNo})</h3>

          <div style={{ marginBottom: 12 }}>
            <label>
              상품
              <br />
              <select
                value={selectedProductCode}
                onChange={(e) => setSelectedProductCode(e.target.value)}
                style={{ width: 420, padding: "6px 8px" }}
              >
                <option value="">-- 상품 선택 --</option>
                {productCatalog.map((p) => (
                  <option key={p.productCode} value={p.productCode}>
                    {p.productCode} · {p.productName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedProductCode && (
            <div style={{ marginBottom: 12 }}>
              <label>
                컬러 / 사이즈
                <br />
                <select
                  value={selectedVariantId}
                  onChange={(e) => setSelectedVariantId(e.target.value)}
                  style={{ width: 280, padding: "6px 8px" }}
                >
                  <option value="">-- 컬러 선택 --</option>
                  {colorVariants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.colorName}
                      {v.sizeName !== "ONE SIZE" ? ` (${v.sizeName})` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {selectedVariantId &&
            (() => {
              const variant = colorVariants.find((v) => v.id === selectedVariantId);
              if (!variant) return null;
              return (
                <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
                  {variant.imageUrl && (
                    <img
                      src={variant.imageUrl}
                      alt={variant.productName}
                      className="product-thumb"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.visibility = "hidden";
                      }}
                    />
                  )}
                  <span className="color-badge">{variant.colorName}</span>
                  <button className="btn" onClick={() => pickProduct(variant)}>
                    이 상품으로 검수 시작
                  </button>
                </div>
              );
            })()}
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
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 8 }}>
            {selectedProduct.imageUrl && (
              <img
                src={selectedProduct.imageUrl}
                alt={selectedProduct.productName}
                style={{ width: 120, height: 120, objectFit: "contain", border: "1px solid #ddd", borderRadius: 6, background: "white" }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            <h3 style={{ margin: 0 }}>
              {selectedProduct.productCode} · {selectedProduct.productName} · {selectedProduct.colorName} /{" "}
              {selectedProduct.sizeName}
            </h3>
          </div>

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
