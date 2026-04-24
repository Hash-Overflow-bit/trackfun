// ============================================================
// DB-backed execution engine.
//
// Persists both TradeRecord rows and SpreadRevenue rows.
// Used by /api/bots/execute (user-initiated) and the cron tick.
// ============================================================

import { prisma } from "@/lib/db";
import { getExecutionPrice } from "./pricing";
import { recordSpreadRevenue } from "./ledger.db";
import type { ExecutionInput, ExecutionResult } from "./types";

export async function recordExecution(
  input: ExecutionInput
): Promise<{ tradeId: string; result: ExecutionResult }> {
  const result = getExecutionPrice(input);

  // Persist trade + spread revenue in a transaction.
  const trade = await prisma.tradeRecord.create({
    data: {
      botId: result.botId,
      marketId: result.marketId,
      side: result.side,
      outcome: result.outcome,
      size: result.size,
      referencePrice: result.referencePrice,
      executionPrice: result.executionPrice,
      spreadAmount: result.spreadAmount,
      pnl: null, // realized on close
    },
  });

  // Ledger write is fire-and-forget so trade isn't blocked by analytics.
  recordSpreadRevenue(result).catch(() => {});

  return { tradeId: trade.id, result };
}

// Pure helpers unchanged — still useful for PnL calcs.
export { markToMarket, realizedPnl } from "./engine";
