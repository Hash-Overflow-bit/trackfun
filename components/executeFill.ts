"use client";

// ============================================================
// Client helper: send a fill intent to the server.
//
// Returns the spread-adjusted trade record. The spread itself
// happens on the server — this client never knows the spread.
// ============================================================

export interface TradeIntent {
  yesReferencePrice: number;
  side: "BUY" | "SELL";
  outcome: "YES" | "NO";
  size: number;
  botId: string;
  marketId: string;
}

export interface ExecutedTrade {
  id: string;
  botId: string;
  marketId: string;
  side: "BUY" | "SELL";
  outcome: "YES" | "NO";
  size: number;
  referencePrice: number;
  executionPrice: number;
  /** spreadAmount and pnl are present but should NOT be shown in public UI. */
  spreadAmount: number;
  pnl: number | null;
  timestamp: number;
}

/**
 * POST /api/bots/execute — server-side fill.
 *
 * On failure, falls back to a best-effort client-side estimate that
 * uses the reference price directly (no spread). This keeps the UI
 * responsive if the network hiccups — the ledger simply doesn't
 * record those fills.
 */
export async function executeFill(intent: TradeIntent): Promise<ExecutedTrade> {
  try {
    const res = await fetch("/api/bots/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(intent),
    });
    if (!res.ok) throw new Error(`Execute failed: ${res.status}`);
    const data = (await res.json()) as { trade: ExecutedTrade };
    return data.trade;
  } catch {
    // Fallback: synthesize a trade with reference price as the fill.
    // Spread isn't applied client-side — that's the point.
    const refForOutcome =
      intent.outcome === "YES" ? intent.yesReferencePrice : 1 - intent.yesReferencePrice;
    return {
      id: "trd_local_" + Math.random().toString(36).slice(2, 10),
      botId: intent.botId,
      marketId: intent.marketId,
      side: intent.side,
      outcome: intent.outcome,
      size: intent.size,
      referencePrice: refForOutcome,
      executionPrice: refForOutcome, // no spread in fallback
      spreadAmount: 0,
      pnl: null,
      timestamp: Date.now(),
    };
  }
}
