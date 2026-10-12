import { TopNav } from "@/components/TopNav";
import { BarcodeClient } from "./BarcodeClient";

export default function BarcodePage() {
  return (
    <>
      <TopNav />
      <div className="page">
        <h1>바코드 검수</h1>
        <p>오더번호를 입력하고 상품을 고른 뒤, 스캐너로 바코드를 스캔하면 즉시 일치/불일치를 보여줍니다.</p>
        <BarcodeClient />
      </div>
    </>
  );
}
