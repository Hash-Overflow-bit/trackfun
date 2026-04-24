// ============================================================
// /api/investments
//
// GET  — list user's open + closed investments (with current value)
// POST — invest in a pro bot (body: { botId, amount })
// ============================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { investInBot, divestBot } from "@/lib/investments";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (_req, user) => {
  const investments = await prisma.botInvestment.findMany({
    where: { userId: user.id },
    include: { bot: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    investments: investments.map(inv => ({
      id: inv.id,
      botId: inv.botId,
      botName: inv.bot.name,
      botEmoji: inv.bot.emoji,
      botStatus: inv.bot.status,
      botPnl: inv.bot.pnl,
      principal: inv.principal,
      entryFeePaid: inv.entryFeePaid,
      shares: inv.sharesIssued,
      currentValue: inv.currentValue,
      pnl: inv.currentValue - inv.principal,
      pnlPct: inv.principal > 0 ? (inv.currentValue - inv.principal) / inv.principal : 0,
      status: inv.status,
      createdAt: inv.createdAt.getTime(),
      closedAt: inv.closedAt?.getTime() ?? null,
    })),
  }, { headers: { "Cache-Control": "no-store" } });
});

export const POST = withAuth(async (req, user) => {
  const allowed = await checkRateLimit(`invest:${user.id}`, 20, 60);
  if (!allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const botId = String(body.botId ?? "");
  const amount = Number(body.amount ?? 0);
  if (!botId) return NextResponse.json({ error: "botId required" }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount must be positive" }, { status: 400 });
  }
  if (amount < 10) {
    return NextResponse.json({ error: "Minimum investment is $10" }, { status: 400 });
  }

  try {
    const result = await investInBot(user.id, botId, amount);
    return NextResponse.json({
      ok: true,
      investmentId: result.investmentId,
      principal: result.principal,
      entryFee: result.entryFee,
      shares: result.shares,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Invest failed" }, { status: 400 });
  }
});

// DELETE /api/investments?id=xxx — divest
export const DELETE = withAuth(async (req, user) => {
  const url = new URL(req.url);
  const investmentId = url.searchParams.get("id");
  if (!investmentId) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    const result = await divestBot(user.id, investmentId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Divest failed" }, { status: 400 });
  }
});
