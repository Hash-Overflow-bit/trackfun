
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchMarkets } from "@/lib/polymarket";

export const dynamic = "force-dynamic";

export async function GET() {
  const diagnostics = {
    env: {
      DATABASE_URL: process.env.DATABASE_URL ? "SET (Hidden)" : "MISSING",
      DIRECT_URL: process.env.DIRECT_URL ? "SET (Hidden)" : "MISSING",
      POLYMARKET_API_KEY: process.env.POLYMARKET_API_KEY ? "SET (Hidden)" : "MISSING",
      NEXT_PUBLIC_PRIVY_APP_ID: process.env.NEXT_PUBLIC_PRIVY_APP_ID || "MISSING",
    },
    database: "testing...",
    polymarket: "testing...",
    timestamp: new Date().toISOString(),
  };

  // 1. Test Database
  try {
    await prisma.$queryRaw`SELECT 1`;
    diagnostics.database = "OK (Connected)";
  } catch (err) {
    diagnostics.database = `FAILED: ${err instanceof Error ? err.message : String(err)}`;
  }

  // 2. Test Polymarket
  try {
    const markets = await fetchMarkets({ limit: 1 });
    diagnostics.polymarket = `OK (Fetched ${markets.length} markets)`;
  } catch (err) {
    diagnostics.polymarket = `FAILED: ${err instanceof Error ? err.message : String(err)}`;
  }

  const allOk = diagnostics.database.startsWith("OK") && diagnostics.polymarket.startsWith("OK");

  return NextResponse.json(diagnostics, { status: allOk ? 200 : 500 });
}
