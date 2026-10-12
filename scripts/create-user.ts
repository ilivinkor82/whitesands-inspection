import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", override: true });

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = argv[i + 1];
      out[key] = value;
      i++;
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { username, password, displayName } = args;

  if (!username || !password || !displayName) {
    console.error(
      "사용법: npm run create-user -- --username <아이디> --password <비밀번호> --displayName <이름>"
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.upsert({
      where: { username },
      create: { username, passwordHash, displayName },
      update: { passwordHash, displayName },
    });
    console.log(`계정 준비 완료: ${user.username} (${user.displayName})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
