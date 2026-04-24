// ============================================================
// GET /api/balance
//
// Returns the authenticated user's internal balance + ledger.
//
// Deposits are NOT made through this endpoint — users send USDC
// to their deposit address (see /api/deposits/address) and the
// indexer credits the balance on confirmation.
// ============================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (_req, user) => {
  const balance = await prisma.userBalance.upsert({
    where: { userId: user.id },
    create: { userId: user.id, available: 0, invested: 0 },
    update: {},
  });

  const ledger = await prisma.userBalanceLedger.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({
    balance: {
      available: balance.available,
      invested: balance.invested,
      totalDeposited: balance.totalDeposited,
      totalWithdrawn: balance.totalWithdrawn,
      currency: balance.currency,
    },
    ledger: ledger.map(l => ({ ...l, timestamp: l.createdAt.getTime() })),
  }, { headers: { "Cache-Control": "no-store" } });
});
