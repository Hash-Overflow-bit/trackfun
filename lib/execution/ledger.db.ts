// ============================================================
// DB-backed spread revenue ledger.
//
// Replaces the in-memory Map in ledger.ts. Same public interface,
// so callers don't change.
// ============================================================

import { prisma } from "@/lib/db";
import type { ExecutionResult } from "./types";

export async function recordSpreadRevenue(r: ExecutionResult): Promise<void> {
  if (r.spreadRevenue <= 0) return;
  try {
    await prisma.spreadRevenue.create({
      data: {
        botId: r.botId,
        marketId: r.marketId,
        amount: r.spreadRevenue,
      },
    });
  } catch (err) {
    // Don't fail the user's trade because analytics failed.
    console.error("Failed to record spread revenue:", err);
  }
}

export async function getGlobalSpreadRevenue(): Promise<number> {
  const result = await prisma.spreadRevenue.aggregate({
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

export async function getSpreadRevenueByBot(botId: string): Promise<number> {
  const result = await prisma.spreadRevenue.aggregate({
    where: { botId },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

export async function getSpreadRevenueByMarket(marketId: string): Promise<number> {
  const result = await prisma.spreadRevenue.aggregate({
    where: { marketId },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

export async function getSpreadRevenueSummary() {
  const [global, byBot, byMarket, entryCount] = await Promise.all([
    prisma.spreadRevenue.aggregate({ _sum: { amount: true } }),
    prisma.spreadRevenue.groupBy({
      by: ["botId"],
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 50,
    }),
    prisma.spreadRevenue.groupBy({
      by: ["marketId"],
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 50,
    }),
    prisma.spreadRevenue.count(),
  ]);

  return {
    global: global._sum.amount ?? 0,
    byBot: Object.fromEntries(byBot.map(r => [r.botId, r._sum.amount ?? 0])),
    byMarket: Object.fromEntries(byMarket.map(r => [r.marketId, r._sum.amount ?? 0])),
    entryCount,
  };
}

export async function getRecentEntries(limit = 50) {
  const rows = await prisma.spreadRevenue.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(r => ({
    botId: r.botId,
    marketId: r.marketId,
    amount: r.amount,
    timestamp: r.createdAt.getTime(),
  }));
}

export async function resetSpreadLedger(): Promise<void> {
  await prisma.spreadRevenue.deleteMany({});
}
