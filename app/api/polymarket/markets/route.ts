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

    // FETCH DIRECTLY FROM POLYMARKET (Ignoring database cache)
    console.log("[Track.fun] Fetching live data from Polymarket using API Key...");
    const markets = await fetchMarkets({ limit, orderBy, active: true });
    
    return NextResponse.json(
      { 
        markets, 
        count: markets.length, 
        fetchedAt: Date.now(), 
        source: "live" 
      },
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
