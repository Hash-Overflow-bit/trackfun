// ============================================================
// GET /api/deposits/address
//
// Returns the authenticated user's USDC-on-Base deposit address.
// Lazily assigns one from the HD wallet on first request.
// ============================================================

import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { assignDepositAddress } from "@/lib/hdWallet";
import { BASE } from "@/lib/chains";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (_req, user) => {
  try {
    const { address, chain, token } = await assignDepositAddress(user.id);
    return NextResponse.json({
      address,
      chain,
      chainDisplayName: BASE.displayName,
      chainId: BASE.chainId,
      token,
      minConfirmations: BASE.confirmations,
      explorerBase: BASE.explorerBase,
      warning: process.env.CRYPTO_DEPOSITS_LIVE === "true"
        ? null
        : "Crypto deposits are not yet live. Your deposit will be detected but not credited until the platform enables live mode.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to provision address" },
      { status: 500 }
    );
  }
});
