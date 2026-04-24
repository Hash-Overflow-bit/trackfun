import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, user) => {
  const [myBots, backings, notifications, balance, investments] = await Promise.all([
    prisma.bot.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.backing.findMany({
      where: { userId: user.id },
      include: { bot: true },
      orderBy: { backedAt: "desc" },
    }),
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.userBalance.upsert({
      where: { userId: user.id },
      create: { userId: user.id, available: 0, invested: 0 },
      update: {},
    }),
    prisma.botInvestment.findMany({
      where: { userId: user.id, status: "open" },
      include: { bot: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const totalBackedCapital = backings.reduce((s, b) => s + b.amount, 0);
  const portfolioValue = backings.reduce(
    (s, b) => s + b.amount * (1 + b.bot.pnl),
    0
  );

  // Investment portfolio totals
  const totalPrincipal = investments.reduce((s, i) => s + i.principal, 0);
  const totalCurrentValue = investments.reduce((s, i) => s + i.currentValue, 0);

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      walletAddr: user.walletAddr,
      isAdmin: user.isAdmin,
      displayName: user.email?.split("@")[0] ?? user.walletAddr?.slice(0, 8) ?? "player",
    },
    myBots: myBots.map(b => ({
      ...b,
      createdAt: b.createdAt.getTime(),
      lastTickAt: b.lastTickAt.getTime(),
      migratedAt: b.migratedAt?.getTime() ?? null,
    })),
    backings: backings.map(b => ({
      botId: b.botId,
      amount: b.amount,
      backedAt: b.backedAt.getTime(),
      bot: { ...b.bot, createdAt: b.bot.createdAt.getTime(), lastTickAt: b.bot.lastTickAt.getTime(), migratedAt: b.bot.migratedAt?.getTime() ?? null },
    })),
    notifications: notifications.map(n => ({ ...n, timestamp: n.createdAt.getTime() })),
    balance: {
      available: balance.available,
      invested: balance.invested,
      totalDeposited: balance.totalDeposited,
      totalWithdrawn: balance.totalWithdrawn,
      currency: balance.currency,
    },
    investments: investments.map(i => ({
      id: i.id,
      botId: i.botId,
      botName: i.bot.name,
      botEmoji: i.bot.emoji,
      botPnl: i.bot.pnl,
      principal: i.principal,
      currentValue: i.currentValue,
      pnl: i.currentValue - i.principal,
      pnlPct: i.principal > 0 ? (i.currentValue - i.principal) / i.principal : 0,
      createdAt: i.createdAt.getTime(),
    })),
    portfolio: {
      // Backing portfolio (existing, fantasy)
      totalBackedCapital,
      backingPortfolioValue: portfolioValue,
      backingPnl: portfolioValue - totalBackedCapital,
      // Investment portfolio (new, real)
      investmentPrincipal: totalPrincipal,
      investmentValue: totalCurrentValue,
      investmentPnl: totalCurrentValue - totalPrincipal,
      investmentPnlPct: totalPrincipal > 0 ? (totalCurrentValue - totalPrincipal) / totalPrincipal : 0,
      // Legacy aliases kept for backward-compat with client
      portfolioValue,
      portfolioPnl: portfolioValue - totalBackedCapital,
      portfolioPct: totalBackedCapital > 0 ? (portfolioValue - totalBackedCapital) / totalBackedCapital : 0,
    },
  }, { headers: { "Cache-Control": "no-store" } });
});
