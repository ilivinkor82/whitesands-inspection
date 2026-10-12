import { PrismaClient } from "@prisma/client";

// Next.js dev server reloads modules on every request; cache the client on
// globalThis so we don't exhaust Neon's connection limit with a fresh
// PrismaClient per reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
