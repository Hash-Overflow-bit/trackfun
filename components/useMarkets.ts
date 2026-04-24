"use client";

// ============================================================
// useMarkets — fetches Polymarket-backed markets from our API
// route, polls on an interval, and exposes loading/error state.
//
// Falls back to built-in seed data if the API is unavailable, so
// the UI is never empty while devs are setting things up.
// ============================================================

import { useEffect, useRef, useState } from "react";
import type { TrackFunMarket } from "@/lib/polymarket";
import { MARKET_SEEDS } from "./seeds";

const DEFAULT_REFRESH_MS = Number(
  process.env.NEXT_PUBLIC_POLYMARKET_REFRESH_MS ?? "30000"
);

export interface UseMarketsOptions {
  limit?: number;
  orderBy?: "volume" | "liquidity" | "createdAt";
  refreshMs?: number;
  /** Set false to disable polling */
  poll?: boolean;
}

export interface UseMarketsResult {
  markets: TrackFunMarket[];
  loading: boolean;
  error: string | null;
  /** True when we are showing fallback seed data (API failed or unavailable) */
  usingFallback: boolean;
  /** Timestamp of the last successful fetch */
  lastFetchedAt: number | null;
  /** Manually trigger a refetch */
  refetch: () => void;
}

export function useMarkets(opts: UseMarketsOptions = {}): UseMarketsResult {
  const { limit = 30, orderBy = "volume", poll = true } = opts;
  const refreshMs = opts.refreshMs ?? DEFAULT_REFRESH_MS;

  const [markets, setMarkets] = useState<TrackFunMarket[]>(MARKET_SEEDS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(true);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchOnce = async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("orderBy", orderBy);
      const res = await fetch(`/api/polymarket/markets?${params.toString()}`, {
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const data = (await res.json()) as {
        markets: TrackFunMarket[];
        fetchedAt: number;
      };
      if (Array.isArray(data.markets) && data.markets.length > 0) {
        setMarkets(data.markets);
        setUsingFallback(false);
        setError(null);
        setLastFetchedAt(data.fetchedAt ?? Date.now());
      } else {
        // API returned empty — keep fallback but don't flag error
        setUsingFallback(true);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setUsingFallback(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOnce();
    if (!poll) return;
    const id = setInterval(fetchOnce, Math.max(5000, refreshMs));
    return () => {
      clearInterval(id);
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, orderBy, poll, refreshMs]);

  return { markets, loading, error, usingFallback, lastFetchedAt, refetch: fetchOnce };
}
