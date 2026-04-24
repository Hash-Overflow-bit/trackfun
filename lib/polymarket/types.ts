// ============================================================
// Polymarket / Market domain types (normalized for Track.fun)
// ============================================================

/** The normalized market shape used throughout Track.fun. */
export interface TrackFunMarket {
  /** Stable ID (Polymarket conditionId / slug) */
  id: string;
  /** Source: "polymarket" or "simulated" (for legacy seed data) */
  source: "polymarket" | "simulated";
  /** Human-readable question */
  title: string;
  /** Category / topic tag */
  category: string;
  /** Subtitle / description (optional) */
  description?: string;
  /** Outcome labels (e.g. ["Yes", "No"]) */
  outcomes: string[];
  /** YES-side implied probability in [0, 1]. For binary markets. */
  yesPrice: number;
  /** 24h change (decimal, e.g. 0.04 = +4%) */
  change24h: number;
  /** 24h volume in USD (best-effort) */
  vol: number;
  /** Total available liquidity in USD */
  liquidity: number;
  /** ISO end date when market resolves */
  endDate?: string;
  /** Whether market is still open for trading */
  active: boolean;
  /** Slug for linking to Polymarket */
  slug?: string;
  /** Full image URL (if provided) */
  image?: string;
}

/** Raw Polymarket Gamma API market shape (partial). */
export interface GammaMarket {
  id?: string;
  conditionId?: string;
  slug?: string;
  question?: string;
  description?: string;
  category?: string;
  active?: boolean;
  closed?: boolean;
  archived?: boolean;
  endDate?: string;
  endDateIso?: string;
  volume?: string | number;
  volume24hr?: string | number;
  liquidity?: string | number;
  liquidityNum?: number;
  outcomes?: string; // JSON-encoded string array
  outcomePrices?: string; // JSON-encoded string array ("0.42", "0.58")
  lastTradePrice?: number;
  bestBid?: number;
  bestAsk?: number;
  oneDayPriceChange?: number;
  image?: string;
  icon?: string;
  events?: Array<{ title?: string; category?: string; tags?: Array<{ label?: string }> }>;
  tags?: Array<{ label?: string }>;
}
