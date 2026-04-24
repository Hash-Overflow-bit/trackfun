// ============================================================
// Simulated execution pricing.
//
// Bots in Track.fun see reference prices from Polymarket, but
// their actual fills include a spread so the house captures
// revenue silently. This is the SINGLE source of truth for
// turning a reference price + intent into an executable fill.
//
// SERVER-SIDE ONLY. Never import this in client code.
//
// Tuning:
//   SIM_SPREAD_CENTS — absolute spread in price units (0–1).
//     Default 0.01 = 1 cent per side.
//     For prediction markets this scales correctly across prices,
//     unlike a basis-points-on-price approach.
// ============================================================

import type { ExecutionInput, ExecutionResult, Side, Outcome } from "./types";

// ---- Config ----------------------------------------------------------------

const DEFAULT_SPREAD_CENTS = 0.01; // 1 cent per side
const MIN_PRICE = 0.01;
const MAX_PRICE = 0.99;

/** Parse spread from env at read time (allows hot-tuning without redeploy). */
export function getSpreadCents(): number {
  const raw = process.env.SIM_SPREAD_CENTS;
  if (raw === undefined || raw === "") return DEFAULT_SPREAD_CENTS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_SPREAD_CENTS;
  // Safety: cap at 10 cents. Larger spreads break the fantasy UX.
  return Math.min(n, 0.1);
}

// ---- Core helpers ----------------------------------------------------------

/** Clamp a price to the tradable range. Exported so callers can verify. */
export function clampPrice(p: number): number {
  if (!Number.isFinite(p)) return 0.5;
  if (p < MIN_PRICE) return MIN_PRICE;
  if (p > MAX_PRICE) return MAX_PRICE;
  return p;
}

/**
 * Given a YES-side reference price, return the reference price for a given outcome.
 * For binary markets: NO reference = 1 - YES reference.
 */
function referenceForOutcome(yesRefPrice: number, outcome: Outcome): number {
  return outcome === "YES" ? yesRefPrice : 1 - yesRefPrice;
}

/**
 * Calculate a spread-adjusted fill price.
 *
 * Buy  => pay more than reference (ref + spread)
 * Sell => receive less than reference (ref - spread)
 *
 * After adjustment, clamp to [MIN_PRICE, MAX_PRICE].
 *
 * Exposed separately from getExecutionPrice() so it can be unit-tested
 * in isolation.
 */
export function calculateSpreadAdjustedPrice(
  referencePrice: number,
  side: Side,
  spreadCents: number = getSpreadCents()
): number {
  const signed = side === "BUY" ? referencePrice + spreadCents : referencePrice - spreadCents;
  return clampPrice(signed);
}

/**
 * Main entry point: compute the execution price for a simulated trade.
 *
 * Call this from every code path that fills an order — never compute
 * fills inline elsewhere. Keeps the spread logic auditable.
 */
export function getExecutionPrice(input: ExecutionInput): ExecutionResult {
  const {
    yesReferencePrice,
    side,
    outcome,
    size,
    marketId,
    botId,
    spreadCents = getSpreadCents(),
  } = input;

  // Guard against bad input.
  const safeYes = clampPrice(yesReferencePrice);
  const referencePrice = referenceForOutcome(safeYes, outcome);

  const executionPrice = calculateSpreadAdjustedPrice(referencePrice, side, spreadCents);

  // How much spread did we actually capture on this fill?
  // After clamping, the effective spread may be less than the configured one
  // (e.g. ref=0.995, buy => clamp to 0.99 → effective spread = 0.005 * size).
  const effectiveSpread =
    side === "BUY"
      ? executionPrice - referencePrice
      : referencePrice - executionPrice;

  // Spread revenue = effective spread per unit * size.
  // Always non-negative (clamping never swings it negative).
  const spreadRevenue = Math.max(0, effectiveSpread) * size;

  return {
    referencePrice,
    executionPrice,
    spreadAmount: effectiveSpread,
    spreadRevenue,
    side,
    outcome,
    size,
    marketId,
    botId,
    timestamp: Date.now(),
  };
}
