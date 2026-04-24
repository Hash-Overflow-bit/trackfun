import { NextResponse } from "next/server";
import { getSpreadRevenueSummary, getRecentEntries } from "@/lib/execution/ledger.db";
import { withAdminAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const GET = withAdminAuth(async (_req, _user) => {
  const [summary, recent] = await Promise.all([
    getSpreadRevenueSummary(),
    getRecentEntries(20),
  ]);

  return NextResponse.json(
    { ...summary, recent, fetchedAt: Date.now() },
    { headers: { "Cache-Control": "no-store" } }
  );
});
