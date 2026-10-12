import { TopNav } from "@/components/TopNav";
import { OrdersTable } from "./OrdersTable";

export default function OrdersPage() {
  return (
    <>
      <TopNav />
      <div className="page-wide">
        <h1>출고 / 검수 / 복귀 현황</h1>
        <OrdersTable />
      </div>
    </>
  );
}
