// Server-side execution pricing and revenue tracking.
// Do not import from client components.

export * from "./types";
export {
  getExecutionPrice,
  calculateSpreadAdjustedPrice,
  clampPrice,
  getSpreadCents,
} from "./pricing";
export {
  recordExecution,
  markToMarket,
  realizedPnl,
} from "./engine";
export {
  recordSpreadRevenue,
  getGlobalSpreadRevenue,
  getSpreadRevenueByBot,
  getSpreadRevenueByMarket,
  getSpreadRevenueSummary,
  getRecentEntries,
  resetSpreadLedger,
} from "./ledger";
