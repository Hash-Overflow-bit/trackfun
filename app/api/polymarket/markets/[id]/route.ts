// ============================================================
// GET /api/polymarket/markets/[id]
//
// Returns a single normalized Polymarket market by slug or conditionId.
// Public endpoint — no auth required.
// ============================================================

import { NextResponse } from "next/server";
import { fetchMarketById } from "@/lib/polymarket";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    // FETCH DIRECTLY FROM POLYMARKET (Ignoring database cache)
    const market = await fetchMarketById(params.id);

    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    return NextResponse.json(
      { market, fetchedAt: Date.now(), source: "live" },
      {
        headers: {
          "Cache-Control": "public, s-maxage=20, stale-while-revalidate=60",
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(
      `[Track.fun] Polymarket Detail API Error for ${params.id}:`,
      err,
    );
    return NextResponse.json(
      { error: "Failed to fetch market", detail: message },
      { status: 502 },
    );
  }
}
