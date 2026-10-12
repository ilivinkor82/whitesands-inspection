import { afterEach, beforeEach, describe, expect, it } from "vitest";

const ACCOUNTS = [
  { id: "master", password: "test1234", displayName: "마스터", role: "admin" },
  { id: "jsc", password: "jsc1234", displayName: "작업자(jsc)", role: "worker" },
];

describe("findAccountByPassword", () => {
  const originalEnv = process.env.ACCOUNTS_JSON;

  beforeEach(() => {
    process.env.ACCOUNTS_JSON = JSON.stringify(ACCOUNTS);
  });

  afterEach(() => {
    process.env.ACCOUNTS_JSON = originalEnv;
  });

  it("비밀번호로 정확한 계정을 찾는다", async () => {
    const { findAccountByPassword } = await import("@/lib/accounts");
    expect(findAccountByPassword("test1234")?.id).toBe("master");
    expect(findAccountByPassword("jsc1234")?.id).toBe("jsc");
  });

  it("등록되지 않은 비밀번호는 null을 반환한다", async () => {
    const { findAccountByPassword } = await import("@/lib/accounts");
    expect(findAccountByPassword("wrong-password")).toBeNull();
  });

  it("ACCOUNTS_JSON이 없으면 아무 비밀번호도 통과하지 못한다", async () => {
    delete process.env.ACCOUNTS_JSON;
    const { findAccountByPassword } = await import("@/lib/accounts");
    expect(findAccountByPassword("test1234")).toBeNull();
  });
});
