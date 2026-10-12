import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "화이트샌즈 검수 관리",
  description: "주희물류 ↔ 제이에스컴퍼니 출고/검수/복귀 현황",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
