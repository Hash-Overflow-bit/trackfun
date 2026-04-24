import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const ALLOWED_STRATEGIES = ["momentum", "contrarian", "macro", "chaos", "oracle", "sniper", "custom"];

export const POST = withAuth(async (req, user) => {
  // Rate limit: max 5 bot creations per user per hour
  const allowed = await checkRateLimit(`bot-create:${user.id}`, 5, 3600);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many bot creations. Try again in an hour." },
      { status: 429 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validate
  const name = String(body.name ?? "").trim().slice(0, 40);
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const strategy = String(body.strategy ?? "custom");
  if (!ALLOWED_STRATEGIES.includes(strategy)) {
    return NextResponse.json({ error: "Invalid strategy" }, { status: 400 });
  }

  const emoji = String(body.emoji ?? "🤖").slice(0, 8);
  const bio = String(body.bio ?? "").slice(0, 200);
  const strategyText = String(body.strategyText ?? "").slice(0, 2000);
  const risk = Math.min(1, Math.max(0, Number(body.risk ?? 0.5)));

  // User can own at most 10 bots to prevent abuse
  const existingCount = await prisma.bot.count({ where: { ownerId: user.id } });
  if (existingCount >= 10) {
    return NextResponse.json({ error: "Max 10 bots per user." }, { status: 400 });
  }

  const bot = await prisma.bot.create({
    data: {
      ownerId: user.id,
      name,
      emoji,
      bio,
      strategy,
      strategyText,
      risk,
      simBankroll: 1000,
      simStartBankroll: 1000,
      pnl: 0,
      winRate: 0.5,
      trades: 0,
      streak: 0,
      level: 1,
      xp: 0,
      followers: 0,
      status: "new",
      isSeed: false,
    },
  });

  // Create launch feed event
  await prisma.feedEvent.create({
    data: {
      type: "launch",
      botId: bot.id,
      botName: bot.name,
      botEmoji: bot.emoji,
      botStrategy: bot.strategy,
    },
  });

  // Create notification for the owner
  await prisma.notification.create({
    data: {
      userId: user.id,
      kind: "bot_launched",
      title: `${bot.name} is live`,
      body: `Your bot entered the arena · $10,000 virtual bankroll`,
      botId: bot.id,
      botName: bot.name,
      botEmoji: bot.emoji,
    },
  });

  return NextResponse.json({
    bot: {
      ...bot,
      createdAt: bot.createdAt.getTime(),
      lastTickAt: bot.lastTickAt.getTime(),
    },
  });
});
