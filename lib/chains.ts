// ============================================================
// Chain config.
//
// Base mainnet. USDC (native, not bridged USDbC).
// Add more chains by extending this module — the indexer
// iterates over ACTIVE_CHAINS.
//
// RPC: use a dedicated provider (Alchemy / QuickNode / Infura)
// in production. Free public RPCs will rate-limit.
// ============================================================

export interface ChainConfig {
  name: string;               // "base"
  displayName: string;        // "Base"
  chainId: number;
  rpcUrl: string;
  usdcAddress: string;        // lowercased
  usdcDecimals: number;
  /** Blocks to wait before marking a deposit "confirmed". */
  confirmations: number;
  /** Max blocks to scan per indexer run. Keeps each run bounded. */
  maxBlocksPerRun: number;
  /** Block explorer base (for tx links). */
  explorerBase: string;
}

export const BASE: ChainConfig = {
  name: "base",
  displayName: "Base",
  chainId: 8453,
  rpcUrl: process.env.BASE_RPC_URL || "https://mainnet.base.org",
  // Native USDC on Base (by Circle). NOT USDbC (the bridged one).
  usdcAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  usdcDecimals: 6,
  confirmations: 12,           // ~24 seconds at 2s block time
  maxBlocksPerRun: 2000,
  explorerBase: "https://basescan.org",
};

export const ACTIVE_CHAINS: ChainConfig[] = [BASE];

export function getChain(name: string): ChainConfig | null {
  return ACTIVE_CHAINS.find(c => c.name === name) ?? null;
}

/** Is the platform allowed to credit user balances from real deposits? */
export function cryptoDepositsLive(): boolean {
  return process.env.CRYPTO_DEPOSITS_LIVE === "true";
}
