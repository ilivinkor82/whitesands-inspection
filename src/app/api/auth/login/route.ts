import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findAccountByPassword } from "@/lib/accounts";
import { getSession } from "@/lib/session";

const LoginSchema = z.object({
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  if (!process.env.ACCOUNTS_JSON) {
    return NextResponse.json({ error: "서버에 ACCOUNTS_JSON이 설정되지 않았습니다" }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "비밀번호를 입력하세요" }, { status: 400 });
  }

  const account = findAccountByPassword(parsed.data.password);
  if (!account) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다" }, { status: 401 });
  }

  const session = await getSession();
  session.authenticated = true;
  session.accountId = account.id;
  session.displayName = account.displayName;
  session.role = account.role;
  await session.save();

  return NextResponse.json({ ok: true, displayName: account.displayName });
}
