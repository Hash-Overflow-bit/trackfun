// ============================================================
// GET /api/polymarket/markets
//
// Returns normalized Polymarket markets for the bot arena.
// Public endpoint — no auth required.
//
// Query params:
//   limit    = number (default 60, max 200)
//   category = string (case-insensitive substring filter)
//   orderBy  = "volume" | "liquidity" | "createdAt" (default "volume")
// ============================================================

import { NextResponse } from "next/server";
import { fetchMarkets } from "@/lib/polymarket";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.max(1, Math.min(200, Number(searchParams.get("limit") ?? "60") || 60));
    const orderByParam = searchParams.get("orderBy");
    const orderBy =
      orderByParam === "liquidity" || orderByParam === "createdAt" || orderByParam === "volume"
        ? orderByParam
        : "volume";

    // Serve from MarketCache (populated by cron) when available
    const cacheAge = 5 * 60_000; // 5 min
    let cached: any[] = [];
    try {
      cached = await prisma.marketCache.findMany({
        where: {
          active: true,
          closed: false,
          fetchedAt: { gt: new Date(Date.now() - cacheAge) },
        },
        orderBy:
          orderBy === "liquidity" ? { liquidity: "desc" }
          : orderBy === "createdAt" ? { fetchedAt: "desc" }
          : { volume: "desc" },
        take: limit,
      });
    } catch (dbErr) {
      console.warn("[Track.fun] MarketCache lookup failed, falling back to live API:", dbErr);
    }

    if (cached.length >= Math.min(limit, 10)) {
      return NextResponse.json(
        {
          markets: cached.map(m => ({
            id: m.id,
            title: m.title,
            category: m.category,
            yesPrice: m.yesPrice,
            volume: m.volume,
            liquidity: m.liquidity,
            endDate: m.endDate?.toISOString() ?? null,
            change24h: m.change24h,
            slug: m.slug,
            active: m.active,
            closed: m.closed,
          })),
          count: cached.length,
          fetchedAt: Date.now(),
          source: "cache",
        },
        { headers: { "Cache-Control": "public, s-maxage=20, stale-while-revalidate=60" } }
      );
    }

    // Cache empty/stale — fall back to live Polymarket
    const markets = await fetchMarkets({ limit, orderBy, active: true });
    return NextResponse.json(
      { markets, count: markets.length, fetchedAt: Date.now(), source: "live" },
      { headers: { "Cache-Control": "public, s-maxage=20, stale-while-revalidate=60" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Track.fun] Polymarket API Route Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch markets", detail: message },
      { status: 502 }
    );
  }
}
