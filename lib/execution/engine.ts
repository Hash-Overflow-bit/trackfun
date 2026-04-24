// ============================================================
// Trade execution engine.
//
// Every simulated fill goes through recordExecution(), which:
//   1. Computes the spread-adjusted fill price.
//   2. Records spread revenue in the ledger.
//   3. Returns a Trade record suitable for persistence.
//
// Bots MUST NOT compute fills inline. Always call this helper.
// ============================================================

import { getExecutionPrice } from "./pricing";
import { recordSpreadRevenue } from "./ledger";
import type { ExecutionInput, ExecutionResult, Trade } from "./types";

/** Generate a trade ID. Replace with UUIDs + DB sequence in production. */
function tradeId(): string {
  return "trd_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/**
 * Execute a simulated trade.
 *
 * Side-effects:
 *   - Appends an entry to the spread-revenue ledger.
 *
 * Returns:
 *   - The full execution result (for callers that want audit detail).
 */
export function recordExecution(input: ExecutionInput): {
  trade: Trade;
  result: ExecutionResult;
} {
  const result = getExecutionPrice(input);
  recordSpreadRevenue(result);

  const trade: Trade = {
    id: tradeId(),
    botId: result.botId,
    marketId: result.marketId,
    side: result.side,
    outcome: result.outcome,
    size: result.size,
    referencePrice: result.referencePrice,
    executionPrice: result.executionPrice,
    spreadAmount: result.spreadAmount,
    pnl: null, // realized on close
    timestamp: result.timestamp,
  };

  return { trade, result };
}

/**
 * Mark a position to market using the CURRENT reference price and the
 * entry EXECUTION price. PnL uses the execution price, never the ref.
 *
 * For a long YES position:
 *   unrealizedPnl = (currentRef - entryExec) * size
 *
 * For a long NO position, we invert by convention — callers pass
 * outcome so we compute correctly.
 */
export function markToMarket(
  entryExecutionPrice: number,
  currentYesReferencePrice: number,
  outcome: "YES" | "NO",
  size: number
): number {
  const currentRef = outcome === "YES" ? currentYesReferencePrice : 1 - currentYesReferencePrice;
  return (currentRef - entryExecutionPrice) * size;
}

/**
 * Realize PnL on position close.
 *
 * exit executionPrice is what the bot actually receives when selling,
 * or pays back when closing a short. Both entry and exit are
 * spread-adjusted, so the spread bites the bot on both ends.
 */
export function realizedPnl(
  entryExecutionPrice: number,
  exitExecutionPrice: number,
  size: number
): number {
  return (exitExecutionPrice - entryExecutionPrice) * size;
}
