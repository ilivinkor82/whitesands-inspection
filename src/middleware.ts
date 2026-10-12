import { NextResponse, type NextRequest } from "next/server";
import { unsealData } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

// 엑셀 업로드(출고/검수 데이터 대량 반영)와 그 이력은 admin 계정만 — worker는
// 현황 조회/수정과 바코드 검수만 쓸 수 있다.
const ADMIN_ONLY_PREFIXES = ["/import", "/api/import"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico") return true;
  return false;
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

function isAdminOnly(pathname: string): boolean {
  return ADMIN_ONLY_PREFIXES.some((p) => matchesPrefix(pathname, p));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const cookie = request.cookies.get(sessionOptions.cookieName!)?.value;
  let authenticated = false;
  let role: SessionData["role"];
  if (cookie) {
    try {
      const data = await unsealData<SessionData>(cookie, { password: sessionOptions.password as string });
      authenticated = data.authenticated === true;
      role = data.role;
    } catch {
      authenticated = false;
    }
  }

  if (!authenticated) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminOnly(pathname) && role !== "admin") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "이 기능은 관리자 계정만 쓸 수 있습니다" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/orders", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
