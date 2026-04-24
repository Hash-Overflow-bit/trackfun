// ============================================================
// Spread revenue ledger (in-memory).
//
// Records every execution's spread capture and exposes aggregates
// for the admin panel. This is intentionally simple — swap the
// backing store for a DB (Postgres, SQLite) when the app is
// production-scale.
//
// SERVER-SIDE ONLY.
//
// Replacement guide for production:
//   1. Replace the in-memory Maps with a DB table `spread_revenue`
//      (columns: id, bot_id, market_id, amount, timestamp).
//   2. Replace record() with an INSERT.
//   3. Replace getGlobal() / getByBot() / getByMarket() with
//      aggregation queries (SUM GROUP BY).
// ============================================================

import type { ExecutionResult } from "./types";

interface LedgerEntry {
  botId: string;
  marketId: string;
  amount: number;
  timestamp: number;
}

// Process-lifetime storage. Resets on server restart.
const entries: LedgerEntry[] = [];
const byBot = new Map<string, number>();
const byMarket = new Map<string, number>();
let globalTotal = 0;

/** Record a fill. Called by recordExecution() after every trade. */
export function recordSpreadRevenue(r: ExecutionResult): void {
  if (r.spreadRevenue <= 0) return; // Nothing to record on degenerate fills.

  const entry: LedgerEntry = {
    botId: r.botId,
    marketId: r.marketId,
    amount: r.spreadRevenue,
    timestamp: r.timestamp,
  };
  entries.push(entry);

  byBot.set(r.botId, (byBot.get(r.botId) ?? 0) + r.spreadRevenue);
  byMarket.set(r.marketId, (byMarket.get(r.marketId) ?? 0) + r.spreadRevenue);
  globalTotal += r.spreadRevenue;

  // Cap entries history at 10k to bound memory. Aggregates remain accurate.
  if (entries.length > 10_000) entries.splice(0, entries.length - 10_000);
}

/** Total spread revenue captured across all bots and markets. */
export function getGlobalSpreadRevenue(): number {
  return globalTotal;
}

/** Total spread revenue attributable to a single bot. */
export function getSpreadRevenueByBot(botId: string): number {
  return byBot.get(botId) ?? 0;
}

/** Total spread revenue captured in a single market. */
export function getSpreadRevenueByMarket(marketId: string): number {
  return byMarket.get(marketId) ?? 0;
}

/** Full dump for admin panel / debugging. */
export function getSpreadRevenueSummary() {
  return {
    global: globalTotal,
    byBot: Object.fromEntries(byBot.entries()),
    byMarket: Object.fromEntries(byMarket.entries()),
    entryCount: entries.length,
  };
}

/** Recent entries for debug logs. */
export function getRecentEntries(limit = 50): LedgerEntry[] {
  return entries.slice(-limit).reverse();
}

/** Wipe the ledger — used by tests and by admin "reset season". */
export function resetSpreadLedger(): void {
  entries.length = 0;
  byBot.clear();
  byMarket.clear();
  globalTotal = 0;
}
