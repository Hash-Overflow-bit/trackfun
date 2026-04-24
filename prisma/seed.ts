// ============================================================
// Database seed script.
//
// Run with:  npm run db:seed
//
// Populates:
//   - 65 seed (house) bots from BOT_ARCHETYPES
//   - Initial MarketCache rows from MARKET_SEEDS (so the UI has
//     something to show before the cron kicks in)
//   - An initial launch FeedEvent per bot so the feed isn't empty
//
// Idempotent: running twice won't create duplicates — it upserts.
// ============================================================

import { PrismaClient } from "@prisma/client";
import { BOT_ARCHETYPES } from "../components/seeds";
import { MARKET_SEEDS } from "../components/seeds";

const prisma = new PrismaClient();

function randBetween(a: number, b: number) { return a + Math.random() * (b - a); }
function rid() { return Math.random().toString(36).slice(2, 10); }

async function main() {
  console.log("🌱 Seeding database...");

  // 1. Seed bots (stable IDs so backing aggregates stay consistent)
  let botsCreated = 0;
  for (let i = 0; i < BOT_ARCHETYPES.length; i++) {
    const a = BOT_ARCHETYPES[i];
    const id = `seed_${i}`;

    const pnl = randBetween(-0.25, 1.8);
    const simBankroll = 1000 * (1 + pnl);
    const followers = Math.floor(randBetween(50, 15000) * (1 + Math.max(0, pnl)));
    const level = Math.min(10, 1 + Math.floor(Math.abs(pnl) * 3));
    const trades = Math.floor(randBetween(20, 500));

    // Derive initial status from qualifying thresholds
    const status = pnl >= 0.30 && trades >= 20 ? "pro"
                 : pnl >= 0.15 && trades >= 10 ? "rising"
                 : "new";

    await prisma.bot.upsert({
      where: { id },
      create: {
        id,
        ownerId: null,
        name: a.name,
        emoji: a.emoji,
        bio: a.bio,
        strategy: a.strategy,
        strategyText: a.bio,
        risk: a.risk,
        simBankroll,
        simStartBankroll: 1000,
        pnl,
        winRate: Math.min(0.85, Math.max(0.3, 0.55 + pnl * 0.1)),
        trades,
        streak: Math.floor(randBetween(-5, 12)),
        level,
        xp: Math.floor(randBetween(0, 95)),
        followers,
        status,
        migratedAt: status === "pro" ? new Date(Date.now() - Math.random() * 7 * 86400_000) : null,
        isSeed: true,
      },
      update: {}, // Don't overwrite progress on re-seed
    });

    // Create an empty investment pool for pro bots
    if (status === "pro") {
      await prisma.botInvestmentPool.upsert({
        where: { botId: id },
        create: { botId: id, totalPrincipal: 0, totalValue: 0, totalShares: 0, investorCount: 0 },
        update: {},
      });
    }
    botsCreated++;
  }
  console.log(`✓ ${botsCreated} bots seeded`);

  // 2. Seed markets
  let marketsCreated = 0;
  for (const m of MARKET_SEEDS.slice(0, 30)) {
    await prisma.marketCache.upsert({
      where: { id: m.id },
      create: {
        id: m.id,
        title: m.title,
        category: m.category ?? null,
        yesPrice: m.yesPrice,
        volume: m.vol ?? 0,
        liquidity: m.liquidity ?? 0,
        change24h: m.change24h ?? 0,
        active: m.active ?? true,
        closed: false,
        raw: m as any,
      },
      update: {
        yesPrice: m.yesPrice,
        volume: m.vol ?? 0,
        liquidity: m.liquidity ?? 0,
      },
    });
    marketsCreated++;
  }
  console.log(`✓ ${marketsCreated} markets seeded`);

  // 3. Seed some initial feed events so the feed isn't empty on first load
  const feedCount = await prisma.feedEvent.count();
  if (feedCount < 10) {
    const bots = await prisma.bot.findMany({ where: { isSeed: true }, take: 40 });
    for (let i = 0; i < 40; i++) {
      const bot = bots[Math.floor(Math.random() * bots.length)];
      await prisma.feedEvent.create({
        data: {
          type: Math.random() < 0.5 ? "trade" : Math.random() < 0.5 ? "milestone" : "launch",
          botId: bot.id,
          botName: bot.name,
          botEmoji: bot.emoji,
          botStrategy: bot.strategy,
          createdAt: new Date(Date.now() - Math.random() * 30 * 60_000),
        },
      });
    }
    console.log("✓ Initial feed events seeded");
  }

  console.log("✅ Seed complete");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
