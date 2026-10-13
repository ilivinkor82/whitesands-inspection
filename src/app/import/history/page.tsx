import { TopNav } from "@/components/TopNav";
import { ImportHistoryTable } from "./ImportHistoryTable";

export default function ImportHistoryPage() {
  return (
    <>
      <TopNav />
      <div className="page">
        <h1>검수등록 이력</h1>
        <ImportHistoryTable />
      </div>
    </>
  );
}
