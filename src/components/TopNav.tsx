"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function TopNav() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => setDisplayName(data.user?.displayName ?? null))
      .catch(() => setDisplayName(null));
  }, []);

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
      <span className="spacer" />
      {displayName && <span>{displayName}님</span>}
      <button className="btn secondary" onClick={handleLogout}>
        로그아웃
      </button>
    </nav>
  );
}
