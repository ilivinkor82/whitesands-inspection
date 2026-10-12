"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function TopNav() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        setDisplayName(data.account?.displayName ?? null);
        setRole(data.account?.role ?? null);
      })
      .catch(() => {
        setDisplayName(null);
        setRole(null);
      });
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const isAdmin = role === "admin";

  return (
    <nav className="topnav">
      <strong>화이트샌즈 검수 관리</strong>
      <a href="/orders">현황</a>
      {isAdmin && <a href="/import">검수제품 등록</a>}
      {isAdmin && <a href="/import/history">검수등록 이력</a>}
      <a href="/barcode">바코드 검수</a>
      <span className="spacer" />
      {displayName && <span>{displayName}님</span>}
      <button className="btn secondary" onClick={handleLogout}>
        로그아웃
      </button>
    </nav>
  );
}
