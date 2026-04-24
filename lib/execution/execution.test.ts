// ============================================================
// Execution-pricing test suite.
//
// Plain Node assertions — no test runner required.
// Run with:  npx tsx lib/execution/execution.test.ts
//   (or)    ts-node lib/execution/execution.test.ts
//
// Exits with code 1 on failure.
// ============================================================

import assert from "node:assert/strict";
import {
  calculateSpreadAdjustedPrice,
  clampPrice,
  getExecutionPrice,
  markToMarket,
  realizedPnl,
  recordExecution,
  resetSpreadLedger,
  getGlobalSpreadRevenue,
  getSpreadRevenueByBot,
  getSpreadRevenueByMarket,
} from "./index";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log("    " + (err instanceof Error ? err.message : String(err)));
    failed++;
  }
}

const SPREAD = 0.01;
const eps = 1e-9;

function approx(a: number, b: number, tolerance = 1e-9): void {
  assert.ok(Math.abs(a - b) < tolerance, `expected ${a} ≈ ${b}`);
}

// ============================================================
console.log("\n📊 clampPrice()");
// ============================================================
test("clamps below 0.01", () => { assert.equal(clampPrice(0), 0.01); });
test("clamps above 0.99", () => { assert.equal(clampPrice(1), 0.99); });
test("passes through valid prices", () => { assert.equal(clampPrice(0.42), 0.42); });
test("handles NaN", () => { assert.equal(clampPrice(NaN), 0.5); });
test("handles Infinity (safe fallback)", () => { assert.equal(clampPrice(Infinity), 0.5); });
test("handles -Infinity (safe fallback)", () => { assert.equal(clampPrice(-Infinity), 0.5); });

// ============================================================
console.log("\n📊 calculateSpreadAdjustedPrice()");
// ============================================================
test("BUY pays reference + spread", () => {
  approx(calculateSpreadAdjustedPrice(0.50, "BUY", SPREAD), 0.51);
});
test("SELL receives reference - spread", () => {
  approx(calculateSpreadAdjustedPrice(0.50, "SELL", SPREAD), 0.49);
});
test("BUY clamps at 0.99 when ref is high", () => {
  assert.equal(calculateSpreadAdjustedPrice(0.995, "BUY", SPREAD), 0.99);
});
test("SELL clamps at 0.01 when ref is low", () => {
  assert.equal(calculateSpreadAdjustedPrice(0.005, "SELL", SPREAD), 0.01);
});
test("zero spread is a no-op", () => {
  approx(calculateSpreadAdjustedPrice(0.42, "BUY", 0), 0.42);
  approx(calculateSpreadAdjustedPrice(0.42, "SELL", 0), 0.42);
});

// ============================================================
console.log("\n📊 getExecutionPrice()");
// ============================================================
test("YES BUY uses YES reference", () => {
  const r = getExecutionPrice({
    yesReferencePrice: 0.60,
    side: "BUY", outcome: "YES", size: 100,
    botId: "b1", marketId: "m1", spreadCents: SPREAD,
  });
  approx(r.referencePrice, 0.60);
  approx(r.executionPrice, 0.61);
  approx(r.spreadAmount, 0.01);
  approx(r.spreadRevenue, 1.0); // 0.01 * 100
});

test("NO BUY uses (1 - YES) as reference", () => {
  const r = getExecutionPrice({
    yesReferencePrice: 0.60,
    side: "BUY", outcome: "NO", size: 200,
    botId: "b1", marketId: "m1", spreadCents: SPREAD,
  });
  approx(r.referencePrice, 0.40);
  approx(r.executionPrice, 0.41);
  approx(r.spreadRevenue, 2.0); // 0.01 * 200
});

test("YES SELL receives ref minus spread", () => {
  const r = getExecutionPrice({
    yesReferencePrice: 0.70,
    side: "SELL", outcome: "YES", size: 50,
    botId: "b1", marketId: "m1", spreadCents: SPREAD,
  });
  approx(r.referencePrice, 0.70);
  approx(r.executionPrice, 0.69);
  approx(r.spreadRevenue, 0.5);
});

test("NO SELL receives (1-YES) minus spread", () => {
  const r = getExecutionPrice({
    yesReferencePrice: 0.70,
    side: "SELL", outcome: "NO", size: 50,
    botId: "b1", marketId: "m1", spreadCents: SPREAD,
  });
  approx(r.referencePrice, 0.30);
  approx(r.executionPrice, 0.29);
  approx(r.spreadRevenue, 0.5);
});

test("clamp reduces effective spread, not below zero", () => {
  const r = getExecutionPrice({
    yesReferencePrice: 0.995,
    side: "BUY", outcome: "YES", size: 100,
    botId: "b1", marketId: "m1", spreadCents: SPREAD,
  });
  approx(r.executionPrice, 0.99);
  // Effective spread = 0.99 - 0.995 = -0.005, but spreadRevenue clamps at 0.
  approx(r.spreadRevenue, 0, 1e-9);
});

test("invalid reference prices are clamped before adjustment", () => {
  const r = getExecutionPrice({
    yesReferencePrice: 1.5, // bogus
    side: "BUY", outcome: "YES", size: 10,
    botId: "b1", marketId: "m1", spreadCents: SPREAD,
  });
  // 1.5 clamps to 0.99, then BUY adds spread → clamps back to 0.99.
  assert.equal(r.executionPrice, 0.99);
});

// ============================================================
console.log("\n📊 markToMarket() + realizedPnl()");
// ============================================================
test("markToMarket uses execution price, not reference", () => {
  // Bot bought YES at exec 0.51 (ref was 0.50).
  // Current ref is 0.60. Unrealized PnL should be (0.60 - 0.51) * size.
  const pnl = markToMarket(0.51, 0.60, "YES", 100);
  approx(pnl, 9.0);
});

test("markToMarket inverts for NO outcome", () => {
  // Bot bought NO at exec 0.41 (ref was 0.40 = 1 - 0.60 YES ref).
  // Current YES ref is 0.50 → current NO ref = 0.50.
  // Unrealized PnL = (0.50 - 0.41) * 100 = 9.0.
  const pnl = markToMarket(0.41, 0.50, "NO", 100);
  approx(pnl, 9.0);
});

test("realizedPnl is negative when bot exits at worse price", () => {
  // Entry exec 0.51, exit exec 0.49 → loss of 0.02 per unit.
  const pnl = realizedPnl(0.51, 0.49, 100);
  approx(pnl, -2.0);
});

test("PnL is always computed from execution prices — spread is baked in", () => {
  // Bot buys YES at ref 0.50, spread 0.01 → entry exec 0.51.
  // Market moves: ref is still 0.50 at close.
  // Bot sells YES at ref 0.50 → exit exec 0.49.
  // PnL = (0.49 - 0.51) * size = -2 per 100 units.
  // This loss IS the spread round-trip: 0.02 * 100 = 2 = the house revenue.
  const entry = calculateSpreadAdjustedPrice(0.50, "BUY", SPREAD);
  const exit = calculateSpreadAdjustedPrice(0.50, "SELL", SPREAD);
  const pnl = realizedPnl(entry, exit, 100);
  approx(pnl, -2.0);
});

// ============================================================
console.log("\n📊 Revenue ledger");
// ============================================================
test("records positive revenue on a normal fill", () => {
  resetSpreadLedger();
  recordExecution({
    yesReferencePrice: 0.50,
    side: "BUY", outcome: "YES", size: 100,
    botId: "bot_a", marketId: "mkt_1", spreadCents: SPREAD,
  });
  approx(getGlobalSpreadRevenue(), 1.0);
  approx(getSpreadRevenueByBot("bot_a"), 1.0);
  approx(getSpreadRevenueByMarket("mkt_1"), 1.0);
});

test("aggregates across multiple fills", () => {
  resetSpreadLedger();
  recordExecution({
    yesReferencePrice: 0.50, side: "BUY", outcome: "YES", size: 100,
    botId: "bot_a", marketId: "mkt_1", spreadCents: SPREAD,
  });
  recordExecution({
    yesReferencePrice: 0.50, side: "SELL", outcome: "YES", size: 100,
    botId: "bot_a", marketId: "mkt_1", spreadCents: SPREAD,
  });
  recordExecution({
    yesReferencePrice: 0.30, side: "BUY", outcome: "NO", size: 50,
    botId: "bot_b", marketId: "mkt_2", spreadCents: SPREAD,
  });
  approx(getGlobalSpreadRevenue(), 2.5); // 1.0 + 1.0 + 0.5
  approx(getSpreadRevenueByBot("bot_a"), 2.0);
  approx(getSpreadRevenueByBot("bot_b"), 0.5);
  approx(getSpreadRevenueByMarket("mkt_1"), 2.0);
  approx(getSpreadRevenueByMarket("mkt_2"), 0.5);
});

test("clamped fills record no negative revenue", () => {
  resetSpreadLedger();
  recordExecution({
    yesReferencePrice: 0.995, side: "BUY", outcome: "YES", size: 100,
    botId: "bot_c", marketId: "mkt_3", spreadCents: SPREAD,
  });
  // Effective spread clamped to 0 — ledger should have no entry.
  approx(getGlobalSpreadRevenue(), 0);
});

test("resetSpreadLedger() wipes everything", () => {
  recordExecution({
    yesReferencePrice: 0.50, side: "BUY", outcome: "YES", size: 100,
    botId: "bot_x", marketId: "mkt_x", spreadCents: SPREAD,
  });
  assert.ok(getGlobalSpreadRevenue() > 0);
  resetSpreadLedger();
  assert.equal(getGlobalSpreadRevenue(), 0);
  assert.equal(getSpreadRevenueByBot("bot_x"), 0);
});

// ============================================================
console.log("\n📊 Round-trip revenue simulation");
// ============================================================
test("1000 round-trip trades capture exactly 2c per trade", () => {
  resetSpreadLedger();
  const SIZE = 100;
  const N = 1000;
  for (let i = 0; i < N; i++) {
    // Random reference price in safe range
    const ref = 0.2 + Math.random() * 0.6;
    recordExecution({
      yesReferencePrice: ref, side: "BUY", outcome: "YES", size: SIZE,
      botId: `bot_${i % 5}`, marketId: `mkt_${i % 3}`, spreadCents: SPREAD,
    });
    recordExecution({
      yesReferencePrice: ref, side: "SELL", outcome: "YES", size: SIZE,
      botId: `bot_${i % 5}`, marketId: `mkt_${i % 3}`, spreadCents: SPREAD,
    });
  }
  // Expected: each round-trip captures 2 * SPREAD * SIZE = 2.0
  // Total: 1000 * 2.0 = 2000
  approx(getGlobalSpreadRevenue(), 2000, 1e-6);
});

// ============================================================
console.log(`\n${failed === 0 ? "✅" : "❌"} ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
