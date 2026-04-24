// ============================================================
// Prisma client singleton.
//
// In Next.js dev mode, hot reloads cause the module to re-evaluate,
// which would create new PrismaClient instances and exhaust DB
// connections. We cache on globalThis to prevent that.
// ============================================================

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
