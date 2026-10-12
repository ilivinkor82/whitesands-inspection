"use client";

import { useRouter } from "next/navigation";

export function TopNav() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="topnav">
      <strong>화이트샌즈 검수 관리</strong>
      <a href="/orders">현황</a>
      <a href="/import">엑셀 업로드</a>
      <a href="/import/history">업로드 이력</a>
      <a href="/barcode">바코드 검수</a>
      <span className="spacer" />
      <button className="btn secondary" onClick={handleLogout}>
        로그아웃
      </button>
    </nav>
  );
}
