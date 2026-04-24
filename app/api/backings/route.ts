import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Each user has a virtual $100k bankroll they can allocate across bots.
const MAX_USER_BANKROLL = 100_000;

export const POST = withAuth(async (req, user) => {
  // Rate limit: 30 backings per minute per user
  const allowed = await checkRateLimit(`back:${user.id}`, 30, 60);
  if (!allowed) {
    return NextResponse.json({ error: "Too many backings. Slow down." }, { status: 429 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const botId = String(body.botId ?? "");
  const amount = Number(body.amount ?? 0);

  if (!botId) return NextResponse.json({ error: "botId required" }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount must be positive" }, { status: 400 });
  }
  if (amount > MAX_USER_BANKROLL) {
    return NextResponse.json({ error: `amount exceeds $${MAX_USER_BANKROLL} cap` }, { status: 400 });
  }

  // Check the bot exists
  const bot = await prisma.bot.findUnique({ where: { id: botId } });
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

  // Check the user's total backing across all bots won't exceed cap
  const currentTotal = await prisma.backing.aggregate({
    where: { userId: user.id },
    _sum: { amount: true },
  });
  const willBe = (currentTotal._sum.amount ?? 0) + amount;
  if (willBe > MAX_USER_BANKROLL) {
    return NextResponse.json(
      { error: `Would exceed your $${MAX_USER_BANKROLL} total cap` },
      { status: 400 }
    );
  }

  // Upsert: add to existing backing or create new
  const backing = await prisma.backing.upsert({
    where: { userId_botId: { userId: user.id, botId } },
    create: { userId: user.id, botId, amount },
    update: { amount: { increment: amount } },
  });

  // Notification
  await prisma.notification.create({
    data: {
      userId: user.id,
      kind: "back_confirmed",
      title: `You backed ${bot.name}`,
      body: `$${Math.round(amount)} allocated · mirrors ${bot.name}'s trades 1:1`,
      botId: bot.id,
      botName: bot.name,
      botEmoji: bot.emoji,
    },
  });

  return NextResponse.json({
    backing: {
      ...backing,
      backedAt: backing.backedAt.getTime(),
    },
  });
});

// GET /api/backings — list the user's backings
export const GET = withAuth(async (req, user) => {
  const backings = await prisma.backing.findMany({
    where: { userId: user.id },
    include: { bot: true },
    orderBy: { backedAt: "desc" },
  });

  return NextResponse.json({
    backings: backings.map(b => ({
      botId: b.botId,
      amount: b.amount,
      backedAt: b.backedAt.getTime(),
      bot: {
        ...b.bot,
        createdAt: b.bot.createdAt.getTime(),
        lastTickAt: b.bot.lastTickAt.getTime(),
      },
    })),
  }, { headers: { "Cache-Control": "no-store" } });
});
