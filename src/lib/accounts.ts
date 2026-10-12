import crypto from "crypto";

export interface Account {
  id: string;
  password: string;
  displayName: string;
  role: "admin" | "worker";
}

/**
 * 계정은 아이디+비밀번호 입력창이 아니라 "비밀번호 하나로 구분"하는 방식이다 —
 * 어떤 비밀번호를 입력했는지에 따라 로그인된 사람이 정해진다. ACCOUNTS_JSON 환경변수에
 * JSON 배열로 등록한다:
 *   [{"id":"master","password":"test1234","displayName":"마스터","role":"admin"},
 *    {"id":"jsc","password":"jsc1234","displayName":"작업자(jsc)","role":"worker"}]
 */
function loadAccounts(): Account[] {
  const raw = process.env.ACCOUNTS_JSON;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a): a is Account =>
        a && typeof a.id === "string" && typeof a.password === "string" && typeof a.displayName === "string"
    );
  } catch {
    return [];
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    crypto.timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function findAccountByPassword(password: string): Account | null {
  const accounts = loadAccounts();
  for (const account of accounts) {
    if (timingSafeEqual(password, account.password)) return account;
  }
  return null;
}
