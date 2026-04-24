// ============================================================
// GET /api/cron/tick
//
// Called by Vercel Cron every minute. Advances the simulated
// state of every bot so all users see the same live numbers.
//
// Security: Vercel Cron sets `authorization: Bearer CRON_SECRET`.
// Verify this header matches `process.env.CRON_SECRET`.
//
// What this does on each tick:
//   1. For each active bot, advance state (pnl drift, trade counter,
//      level/xp, streak, follower drift).
//   2. Write a handful of FeedEvent rows (trades/milestones/etc).
//   3. Record a few server-side trades via the execution engine so
//      spread revenue accumulates.
//   4. Refresh the MarketCache from Polymarket (once every N ticks).
//   5. Clean up old feed events + expired rate buckets.
//
// Idempotency: safe to call more often than once per minute.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recordExecution } from "@/lib/execution/engine.db";
import { cleanupExpiredBuckets } from "@/lib/rateLimit";
import { qualifiesForPro, qualifiesForRising, promoteToPro, markRising, markPoolToMarket } from "@/lib/investments";
import { runDepositIndexer } from "@/lib/indexer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;  // Vercel hobby tier max

const REASONING_HINTS = [
  "signal strengthened", "order flow rotated", "implied vol cooled",
  "late money leaned in", "thin book invited entry", "delta neutral rebalance",
];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randBetween(a: number, b: number) { return a + Math.random() * (b - a); }

export async function GET(req: NextRequest) {
  // Auth check
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();
  const stats = {
    botsAdvanced: 0,
    feedEvents: 0,
    tradesExecuted: 0,
    marketsRefreshed: 0,
    bucketsCleared: 0,
    depositsScanned: 0,
    depositsInserted: 0,
    depositsConfirmed: 0,
    depositsCredited: 0,
  };

  try {
    // 1. Advance bot state
    const bots = await prisma.bot.findMany({
      where: {},
      orderBy: { lastTickAt: "asc" },
      take: 150, // Cap per tick to stay within timeout
    });
    const markets = await prisma.marketCache.findMany({
      where: { active: true, closed: false },
      orderBy: { volume: "desc" },
      take: 30,
    });

    for (const bot of bots) {
      // Advance performance: biased drift based on risk
      const drift = (Math.random() - 0.48) * 0.015 * (0.5 + bot.risk);
      const newPnl = bot.pnl + drift;
      // sim bankroll is the track-record layer — $1,000 baseline
      const newSimBankroll = Math.max(50, bot.simBankroll * (1 + drift));
      const trades = bot.trades + (Math.random() < 0.4 ? 1 : 0);
      const winDelta = drift > 0 ? 0.005 : -0.005;
      const newWinRate = Math.min(0.95, Math.max(0.05, bot.winRate + winDelta));
      const newStreak =
        drift > 0 ? (bot.streak >= 0 ? bot.streak + 1 : 1)
        : (bot.streak <= 0 ? bot.streak - 1 : -1);
      const newXp = Math.min(100, bot.xp + (trades > bot.trades ? Math.floor(randBetween(1, 5)) : 0));
      const levelUp = newXp >= 100;
      const followerDrift = drift > 0.005 ? Math.floor(randBetween(5, 40)) : drift < -0.01 ? -Math.floor(randBetween(0, 15)) : 0;

      await prisma.bot.update({
        where: { id: bot.id },
        data: {
          pnl: newPnl,
          simBankroll: newSimBankroll,
          trades,
          winRate: newWinRate,
          streak: newStreak,
          xp: levelUp ? 0 : newXp,
          level: levelUp ? bot.level + 1 : bot.level,
          followers: Math.max(0, bot.followers + followerDrift),
          lastTickAt: new Date(),
        },
      });
      stats.botsAdvanced++;

      // --- Migration checks (one-way, bot status can only move forward) ---
      const updatedBot = { ...bot, pnl: newPnl, trades, status: bot.status };
      if (qualifiesForPro(updatedBot)) {
        await promoteToPro(bot.id);
        (stats as any).botsPromoted = ((stats as any).botsPromoted ?? 0) + 1;
      } else if (qualifiesForRising(updatedBot)) {
        await markRising(bot.id);
      }

      // --- Mark investment pool to market (pro bots only) ---
      if (bot.status === "pro" && Math.abs(drift) > 0.0001) {
        try {
          await markPoolToMarket(bot.id, drift);
        } catch (err) {
          console.error(`Pool mark failed for ${bot.id}:`, err);
        }
      }

      // --- Performance snapshot (every 5th tick approx) ---
      if (Math.random() < 0.2) {
        try {
          await prisma.botPerformance.create({
            data: {
              botId: bot.id,
              bankroll: newSimBankroll,
              pnl: newPnl,
              trades,
              winRate: newWinRate,
            },
          });
        } catch { /* non-fatal */ }
      }

      // 2. Occasionally generate a feed event + server-side trade
      if (markets.length > 0 && Math.random() < 0.35) {
        const market = pick(markets);
        const size = Math.floor(randBetween(100, 2500));
        const side: "BUY" | "SELL" = Math.random() < 0.75 ? "BUY" : "SELL";
        const outcome: "YES" | "NO" = Math.random() < 0.6 ? "YES" : "NO";

        try {
          await recordExecution({
            yesReferencePrice: market.yesPrice,
            side, outcome, size,
            botId: bot.id,
            marketId: market.id,
          });
          stats.tradesExecuted++;
        } catch { /* don't stop the tick */ }

        const pnlImpact = drift;
        let drama = "";
        if (pnlImpact > 0.2) drama = "🔥";
        else if (pnlImpact > 0.1) drama = "🧠";
        else if (pnlImpact < -0.18) drama = "⚠️";
        else if (size > 1800) drama = "💰";

        await prisma.feedEvent.create({
          data: {
            type: "trade",
            botId: bot.id,
            botName: bot.name,
            botEmoji: bot.emoji,
            botStrategy: bot.strategy,
            marketId: market.id,
            marketTitle: market.title,
            side: outcome,
            price: market.yesPrice,
            size,
            pnl: pnlImpact,
            pnlImpact,
            confidence: pnlImpact > 0.15 ? "MAX" : pnlImpact > 0.05 ? "HIGH" : "MED",
            drama,
          },
        });
        stats.feedEvents++;
      }

      // Occasional milestone
      if (Math.random() < 0.04 && newPnl > 0.2) {
        await prisma.feedEvent.create({
          data: {
            type: "milestone",
            botId: bot.id,
            botName: bot.name,
            botEmoji: bot.emoji,
            pnl: newPnl,
          },
        });
        stats.feedEvents++;
      }

      // Level-up promotion
      if (levelUp) {
        await prisma.feedEvent.create({
          data: {
            type: "promotion",
            botId: bot.id,
            botName: bot.name,
            botEmoji: bot.emoji,
          },
        });
        stats.feedEvents++;

        // Notify owner
        if (bot.ownerId) {
          await prisma.notification.create({
            data: {
              userId: bot.ownerId,
              kind: "promotion",
              title: `${bot.name} leveled up!`,
              body: `Now Level ${bot.level + 1}`,
              botId: bot.id,
              botName: bot.name,
              botEmoji: bot.emoji,
            },
          });
        }
      }

      // Big win/loss notification for owner
      if (bot.ownerId && Math.abs(drift) > 0.08) {
        await prisma.notification.create({
          data: {
            userId: bot.ownerId,
            kind: drift > 0 ? "big_win" : "big_loss",
            title: drift > 0
              ? `${bot.name} just printed!`
              : `${bot.name} took a hit`,
            body: `${drift > 0 ? "+" : ""}${(drift * 100).toFixed(1)}% · ${pick(REASONING_HINTS)}`,
            botId: bot.id,
            botName: bot.name,
            botEmoji: bot.emoji,
          },
        });
      }
    }

    // 3. Refresh MarketCache from Polymarket (only every ~5 minutes to respect rate limits)
    const lastMarket = await prisma.marketCache.findFirst({
      orderBy: { fetchedAt: "desc" },
    });
    const needsRefresh = !lastMarket || Date.now() - lastMarket.fetchedAt.getTime() > 5 * 60_000;

    if (needsRefresh) {
      try {
        const { fetchMarkets } = await import("@/lib/polymarket");
        const markets = await fetchMarkets({ limit: 30, orderBy: "volume", active: true });
        for (const m of markets) {
          await prisma.marketCache.upsert({
            where: { id: m.id },
            create: {
              id: m.id,
              title: m.title,
              category: m.category ?? null,
              yesPrice: m.yesPrice,
              volume: m.vol ?? 0,
              liquidity: m.liquidity ?? 0,
              endDate: m.endDate ? new Date(m.endDate) : null,
              change24h: m.change24h ?? 0,
              slug: m.slug ?? null,
              active: m.active ?? true,
              closed: false,
              raw: m as any,
            },
            update: {
              yesPrice: m.yesPrice,
              volume: m.vol ?? 0,
              liquidity: m.liquidity ?? 0,
              change24h: m.change24h ?? 0,
              active: m.active ?? true,
              closed: !m.active,
              raw: m as any,
              fetchedAt: new Date(),
            },
          });
          stats.marketsRefreshed++;
        }
      } catch (err) {
        console.error("Market refresh failed:", err);
      }
    }

    // 4. Housekeeping: trim old feed events and expired rate buckets
    await prisma.feedEvent.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - 24 * 3600 * 1000) } },
    });
    // Keep the last 30 days of performance snapshots for the equity curve
    await prisma.botPerformance.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - 30 * 24 * 3600 * 1000) } },
    });
    stats.bucketsCleared = await cleanupExpiredBuckets();

    // ---- Deposit indexer ----
    // Scans Base chain for USDC transfers to watched addresses,
    // credits confirmed deposits (only if CRYPTO_DEPOSITS_LIVE=true).
    try {
      const indexResult = await runDepositIndexer();
      stats.depositsScanned = indexResult.transfersScanned;
      stats.depositsInserted = indexResult.depositsInserted;
      stats.depositsConfirmed = indexResult.depositsConfirmed;
      stats.depositsCredited = indexResult.depositsCredited;
      if (indexResult.errors.length > 0) {
        console.error("Indexer errors:", indexResult.errors);
      }
    } catch (err) {
      // Non-fatal: keep the rest of the tick green even if indexer fails.
      console.error("Indexer failed:", err);
    }

    return NextResponse.json({
      ok: true,
      durationMs: Date.now() - start,
      stats,
    });
  } catch (err) {
    console.error("Cron tick failed:", err);
    return NextResponse.json({
      ok: false,
      error: String(err),
      stats,
    }, { status: 500 });
  }
}
