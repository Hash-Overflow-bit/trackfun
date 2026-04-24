// ============================================================
// GET /api/deposits
//
// Returns the authenticated user's recent deposit history:
// pending, confirming, and credited deposits.
// ============================================================

import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BASE } from "@/lib/chains";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (_req, user) => {
  const deposits = await prisma.deposit.findMany({
    where: { userId: user.id },
    orderBy: { detectedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    deposits: deposits.map(d => ({
      id: d.id,
      txHash: d.txHash,
      fromAddress: d.fromAddress,
      toAddress: d.toAddress,
      chain: d.chain,
      token: d.token,
      amountUsd: d.amountUsd,
      blockNumber: d.blockNumber.toString(),
      blockTimestamp: d.blockTimestamp.getTime(),
      confirmations: d.confirmations,
      minConfirmations: BASE.confirmations,
      status: d.status,
      creditedAt: d.creditedAt?.getTime() ?? null,
      detectedAt: d.detectedAt.getTime(),
      explorerUrl: `${BASE.explorerBase}/tx/${d.txHash}`,
    })),
  }, { headers: { "Cache-Control": "no-store" } });
});
