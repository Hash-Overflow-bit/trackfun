// ============================================================
// POST /api/bots/execute
//
// Server-side simulated fill endpoint. Clients POST a trade
// intent and receive back the spread-adjusted execution price
// and a stored Trade record. Spread revenue is silently
// captured in the ledger.
//
// This is the ONLY sanctioned path for executing simulated
// trades. Clients must never compute fills locally.
//
// Body:
//   {
//     yesReferencePrice: number,  // 0-1
//     side: "BUY" | "SELL",
//     outcome: "YES" | "NO",
//     size: number,               // virtual USD
//     botId: string,
//     marketId: string,
//   }
// ============================================================

import { NextResponse } from "next/server";
import { recordExecution } from "@/lib/execution/engine.db";
import { withAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { prisma } from "@/lib/db";
import type { Side, Outcome } from "@/lib/execution";

interface ExecuteBody {
  yesReferencePrice?: unknown;
  side?: unknown;
  outcome?: unknown;
  size?: unknown;
  botId?: unknown;
  marketId?: unknown;
}

function validate(body: ExecuteBody): string | null {
  if (typeof body.yesReferencePrice !== "number") return "yesReferencePrice must be a number";
  if (body.side !== "BUY" && body.side !== "SELL") return "side must be BUY or SELL";
  if (body.outcome !== "YES" && body.outcome !== "NO") return "outcome must be YES or NO";
  if (typeof body.size !== "number" || body.size <= 0) return "size must be a positive number";
  if (typeof body.botId !== "string" || !body.botId) return "botId is required";
  if (typeof body.marketId !== "string" || !body.marketId) return "marketId is required";
  return null;
}

export const POST = withAuth(async (request, user) => {
  // Rate limit: 60 executions per user per minute
  const allowed = await checkRateLimit(`execute:${user.id}`, 60, 60);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let body: ExecuteBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const err = validate(body);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const botId = body.botId as string;
  // Verify the user owns this bot (or it's a seed bot in which case allow)
  const bot = await prisma.bot.findUnique({ where: { id: botId } });
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  if (bot.ownerId && bot.ownerId !== user.id) {
    return NextResponse.json({ error: "Not your bot" }, { status: 403 });
  }

  const { tradeId, result } = await recordExecution({
    yesReferencePrice: body.yesReferencePrice as number,
    side: body.side as Side,
    outcome: body.outcome as Outcome,
    size: body.size as number,
    botId,
    marketId: body.marketId as string,
  });

  return NextResponse.json(
    { tradeId, trade: result, executedAt: result.timestamp },
    { headers: { "Cache-Control": "no-store" } }
  );
});
