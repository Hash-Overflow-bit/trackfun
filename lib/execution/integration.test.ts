// Integration test: simulate a batch of tick-driven fills to verify
// end-to-end wiring. Runs the same `recordExecution` the route handler
// calls, with the same data shapes the client produces.

import assert from "node:assert/strict";
import {
  recordExecution,
  resetSpreadLedger,
  getGlobalSpreadRevenue,
  getSpreadRevenueByBot,
} from "./index";

resetSpreadLedger();

// Simulate 500 trade events like the TrackFun.tsx tick produces
const bots = ["bot_alpha", "bot_beta", "bot_gamma"];
const markets = ["0x1", "0x2", "0x3", "0x4"];
const SPREAD = 0.01;

let expectedRevenue = 0;
for (let i = 0; i < 500; i++) {
  const yesRef = 0.15 + Math.random() * 0.7; // 0.15-0.85 range
  const side = Math.random() < 0.8 ? "BUY" : "SELL";
  const outcome = Math.random() < 0.5 ? "YES" : "NO";
  const size = 50 + Math.floor(Math.random() * 2000);
  const botId = bots[i % bots.length];
  const marketId = markets[i % markets.length];

  recordExecution({
    yesReferencePrice: yesRef,
    side: side as "BUY" | "SELL",
    outcome: outcome as "YES" | "NO",
    size,
    botId,
    marketId,
    spreadCents: SPREAD,
  });

  // Expected revenue for this fill. Reference for outcome:
  const refForOutcome = outcome === "YES" ? yesRef : 1 - yesRef;
  // BUY pays ref + spread, SELL gets ref - spread.
  // Because all our refs are in [0.15, 0.85], no clamping occurs.
  // So effective spread = SPREAD on every fill.
  expectedRevenue += SPREAD * size;
}

const actual = getGlobalSpreadRevenue();
const diff = Math.abs(actual - expectedRevenue);
assert.ok(diff < 0.0001, `expected ~${expectedRevenue.toFixed(2)}, got ${actual.toFixed(2)}`);

console.log("✓ 500 simulated tick-fills captured expected revenue");
console.log(`  Total revenue: $${actual.toFixed(2)}`);
console.log(`  By bot:`);
for (const b of bots) {
  console.log(`    ${b}: $${getSpreadRevenueByBot(b).toFixed(2)}`);
}

// Verify: PnL round-trip still costs bot 2*spread*size
const ref = 0.50;
const result1 = recordExecution({
  yesReferencePrice: ref, side: "BUY", outcome: "YES", size: 100,
  botId: "roundtrip_bot", marketId: "roundtrip_mkt", spreadCents: SPREAD,
});
const result2 = recordExecution({
  yesReferencePrice: ref, side: "SELL", outcome: "YES", size: 100,
  botId: "roundtrip_bot", marketId: "roundtrip_mkt", spreadCents: SPREAD,
});
const botCost = (result1.result.executionPrice - result2.result.executionPrice) * 100;
const houseTake = result1.result.spreadRevenue + result2.result.spreadRevenue;
assert.ok(Math.abs(botCost - houseTake) < 1e-9, `botCost ${botCost} != houseTake ${houseTake}`);
console.log(`\n✓ Round-trip bot cost ($${botCost.toFixed(2)}) == house take ($${houseTake.toFixed(2)})`);

console.log("\n✅ Integration OK");
