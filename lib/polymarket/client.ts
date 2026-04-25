// ============================================================
// Polymarket Gamma API client — READ-ONLY
// Docs: https://docs.polymarket.com/developers/gamma-markets-api/overview
//
// All trading is disabled. We only pull public market metadata
// for the Track.fun simulated bot arena.
// ============================================================

import type { GammaMarket, TrackFunMarket } from "./types";

const GAMMA_URL =
  process.env.POLYMARKET_GAMMA_URL?.replace(/\/$/, "") ||
  "https://gamma-api.polymarket.com";

/** Parse a JSON-encoded string array. Gamma returns '["Yes","No"]' style. */
function parseJsonArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((v) => String(v));
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
  } catch {
    return [];
  }
}

function toNumber(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

/** Derive category string from nested event/tag data. */
function deriveCategory(m: GammaMarket): string {
  if (m.category) return m.category;
  const eventCat = m.events?.[0]?.category;
  if (eventCat) return eventCat;
  const firstTag =
    m.tags?.[0]?.label || m.events?.[0]?.tags?.[0]?.label;
  if (firstTag) return firstTag;
  return "General";
}

/**
 * Normalize a raw Gamma market into the Track.fun market shape.
 * Filters out non-binary markets by only keeping the first two outcomes.
 */
export function normalizeMarket(m: GammaMarket): TrackFunMarket | null {
  const outcomes = parseJsonArray(m.outcomes);
  const prices = parseJsonArray(m.outcomePrices).map((p) => toNumber(p));

  // We only support binary YES/NO style markets in the current UI.
  if (outcomes.length < 2) return null;

  // YES is conventionally outcomes[0] for Polymarket binary markets.
  // Fall back to lastTradePrice or bestBid if no outcomePrices.
  let yesPrice = prices[0];
  if (!yesPrice || yesPrice <= 0) {
    yesPrice = toNumber(m.lastTradePrice) || toNumber(m.bestBid) || 0.5;
  }
  yesPrice = Math.max(0.01, Math.min(0.99, yesPrice));

  const id = m.conditionId || m.id || m.slug;
  if (!id) return null;

  return {
    id: String(id),
    source: "polymarket",
    title: m.question || "Untitled market",
    category: deriveCategory(m),
    description: m.description,
    outcomes: outcomes.slice(0, 2),
    yesPrice,
    change24h: toNumber(m.oneDayPriceChange, 0),
    vol: toNumber(m.volume24hr) || toNumber(m.volume),
    liquidity: toNumber(m.liquidityNum) || toNumber(m.liquidity),
    endDate: m.endDateIso || m.endDate,
    active: Boolean(m.active) && !m.closed && !m.archived,
    slug: m.slug,
    image: m.image || m.icon,
  };
}

export interface FetchMarketsOptions {
  /** Max markets to return. Gamma default ~500, we keep it tight. */
  limit?: number;
  /** Only active markets. Default true. */
  active?: boolean;
  /** Order by: "volume" (default), "liquidity", "createdAt" */
  orderBy?: "volume" | "liquidity" | "createdAt";
  /** Category filter (case-insensitive substring match) */
  category?: string;
}

/** Internal: build the Gamma URL with query params. */
function buildMarketsUrl(opts: FetchMarketsOptions = {}): string {
  const params = new URLSearchParams();
  params.set("limit", String(opts.limit ?? 60));
  params.set("active", String(opts.active ?? true));
  params.set("closed", "false");
  params.set("archived", "false");
  // Gamma accepts order + ascending
  const orderMap: Record<string, string> = {
    volume: "volume24hr",
    liquidity: "liquidity",
    createdAt: "createdAt",
  };
  params.set("order", orderMap[opts.orderBy ?? "volume"] || "volume24hr");
  params.set("ascending", "false");
  return `${GAMMA_URL}/markets?${params.toString()}`;
}

/**
 * Fetch active markets from Polymarket Gamma API.
 * Throws on network / non-200 responses so callers can handle errors.
 */
export async function fetchMarkets(
  opts: FetchMarketsOptions = {}
): Promise<TrackFunMarket[]> {
  const url = buildMarketsUrl(opts);
  const headers: Record<string, string> = { accept: "application/json" };
  if (process.env.POLYMARKET_API_KEY) {
    headers["x-api-key"] = process.env.POLYMARKET_API_KEY;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout for Vercel

  const res = await fetch(url, {
    headers,
    signal: controller.signal,
    cache: "no-store",
  });
  clearTimeout(timeout);
  if (!res.ok) {
    throw new Error(`Polymarket Gamma returned ${res.status}: ${res.statusText}`);
  }
  const data: GammaMarket[] = await res.json();

  let markets = (Array.isArray(data) ? data : [])
    .map(normalizeMarket)
    .filter((m): m is TrackFunMarket => m !== null);

  if (opts.category) {
    const needle = opts.category.toLowerCase();
    markets = markets.filter((m) => m.category.toLowerCase().includes(needle));
  }

  return markets;
}

/** Fetch a single market by Polymarket slug or conditionId. */
export async function fetchMarketById(
  idOrSlug: string
): Promise<TrackFunMarket | null> {
  // Gamma supports `/markets/{id}` and querystring-based slug lookup.
  const params = new URLSearchParams();
  // Try slug lookup first since our IDs might be slugs.
  params.set("slug", idOrSlug);
  const url = `${GAMMA_URL}/markets?${params.toString()}&limit=1`;

  const headers: Record<string, string> = { accept: "application/json" };
  if (process.env.POLYMARKET_API_KEY) {
    headers["x-api-key"] = process.env.POLYMARKET_API_KEY;
  }

  const controller2 = new AbortController();
  const timeout2 = setTimeout(() => controller2.abort(), 8000);

  const res = await fetch(url, {
    headers,
    signal: controller2.signal,
    cache: "no-store",
  });
  clearTimeout(timeout2);

  if (!res.ok) return null;

  const data = (await res.json()) as GammaMarket[];
  const raw = Array.isArray(data) ? data[0] : null;
  if (!raw) return null;
  return normalizeMarket(raw);
}

/** Fetch trending markets — shorthand for top-volume active markets. */
export async function fetchTrendingMarkets(
  limit = 12
): Promise<TrackFunMarket[]> {
  return fetchMarkets({ limit, orderBy: "volume", active: true });
}
