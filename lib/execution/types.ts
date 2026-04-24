// ============================================================
// Types for simulated trade execution.
// ============================================================

/** Direction of the fill from the bot's perspective. */
export type Side = "BUY" | "SELL";

/** Which outcome of a binary market the bot is trading. */
export type Outcome = "YES" | "NO";

/** Input to the execution pricing helper. */
export interface ExecutionInput {
  /** The YES-side reference price (0–1) from Polymarket-backed data. */
  yesReferencePrice: number;
  /** BUY = bot enters a long position; SELL = bot exits / shorts. */
  side: Side;
  /** Which outcome the bot is buying/selling. */
  outcome: Outcome;
  /** Position size in virtual USD. */
  size: number;
  /** Market identifier (conditionId or slug). */
  marketId: string;
  /** Bot identifier. */
  botId: string;
  /** Override default spread (mostly for tests). */
  spreadCents?: number;
}

/** Result of an execution: the fill plus audit fields for revenue tracking. */
export interface ExecutionResult {
  /** Reference price for the traded outcome (YES or NO). Informational only. */
  referencePrice: number;
  /** The actual fill price after spread adjustment + clamping. */
  executionPrice: number;
  /** Signed effective spread per unit of size. Non-negative after clamping. */
  spreadAmount: number;
  /** Total spread revenue captured on this fill (spreadAmount * size). */
  spreadRevenue: number;
  side: Side;
  outcome: Outcome;
  size: number;
  marketId: string;
  botId: string;
  timestamp: number;
}

/**
 * A stored trade record. The bot PnL calculation uses executionPrice —
 * never referencePrice.
 */
export interface Trade {
  id: string;
  botId: string;
  marketId: string;
  side: Side;
  outcome: Outcome;
  size: number;
  referencePrice: number;
  executionPrice: number;
  spreadAmount: number;
  /** Realized PnL for this trade, if closed. Null while open. */
  pnl: number | null;
  timestamp: number;
}

/** An open position tracked on a bot. */
export interface Position {
  id: string;
  botId: string;
  marketId: string;
  outcome: Outcome;
  /** Average entry price paid (already spread-adjusted). */
  avgEntryPrice: number;
  /** Position size in units (virtual USD). */
  size: number;
  /** Unrealized PnL marked-to-market against current reference price. */
  unrealizedPnl: number;
  openedAt: number;
}
