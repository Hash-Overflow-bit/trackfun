// ============================================================
// Investment engine.
//
// The single source of truth for:
//   - Whether a bot qualifies to migrate to "pro"
//   - How shares are calculated when a user invests
//   - How fees are applied
//   - How P&L is marked to market
//
// SERVER-SIDE ONLY. All state-changing ops are transactional.
// ============================================================

import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

// ------------------ Constants ------------------
export const ENTRY_FEE_PCT = 0.015;        // 1.5% entry fee
export const EXIT_FEE_PCT = 0.01;          // 1% exit fee
export const MIGRATION_RETURN = 0.30;      // +30% return
export const MIGRATION_MIN_TRADES = 20;
export const RISING_RETURN = 0.15;         // +15% = "rising" status
export const RISING_MIN_TRADES = 10;

// ------------------ Migration ------------------

/**
 * Pure check: does this bot's track record qualify for "pro"?
 * Criteria (either):
 *   (a) pnl >= +30% AND trades >= 20
 *   (b) top 10% of leaderboard by pnl
 */
export function qualifiesForPro(bot: {
  pnl: number;
  trades: number;
  status: string;
}, leaderboardPercentile?: number): boolean {
  if (bot.status === "pro") return false; // Already pro
  if (bot.pnl >= MIGRATION_RETURN && bot.trades >= MIGRATION_MIN_TRADES) return true;
  if (leaderboardPercentile !== undefined && leaderboardPercentile <= 0.10 && bot.trades >= MIGRATION_MIN_TRADES) return true;
  return false;
}

/** "rising" is the middle tier - good progress, not yet pro. */
export function qualifiesForRising(bot: {
  pnl: number;
  trades: number;
  status: string;
}): boolean {
  if (bot.status !== "new") return false; // Only new → rising
  return bot.pnl >= RISING_RETURN && bot.trades >= RISING_MIN_TRADES;
}

/**
 * Promote a bot to pro. Side effects:
 *   - bot.status = "pro", migratedAt = now
 *   - Create empty BotInvestmentPool row
 *   - Create FeedEvent ("⚡ Bot Promoted")
 *   - Notify owner
 */
export async function promoteToPro(botId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const bot = await tx.bot.findUnique({ where: { id: botId } });
    if (!bot || bot.status === "pro") return;

    await tx.bot.update({
      where: { id: botId },
      data: { status: "pro", migratedAt: new Date() },
    });

    await tx.botInvestmentPool.upsert({
      where: { botId },
      create: { botId, totalPrincipal: 0, totalValue: 0, totalShares: 0, investorCount: 0 },
      update: {},
    });

    await tx.feedEvent.create({
      data: {
        type: "promotion",
        botId: bot.id,
        botName: bot.name,
        botEmoji: bot.emoji,
        botStrategy: bot.strategy,
      },
    });

    if (bot.ownerId) {
      await tx.notification.create({
        data: {
          userId: bot.ownerId,
          kind: "promotion",
          title: `⚡ ${bot.name} is now PRO`,
          body: `Track record qualified. Real investment unlocked.`,
          botId: bot.id,
          botName: bot.name,
          botEmoji: bot.emoji,
        },
      });
    }
  });
}

export async function markRising(botId: string): Promise<void> {
  await prisma.bot.update({
    where: { id: botId, status: "new" },
    data: { status: "rising" },
  }).catch(() => {}); // No-op if status already moved
}

// ------------------ Investing ------------------

export interface InvestResult {
  investmentId: string;
  principal: number;
  entryFee: number;
  shares: number;
}

/**
 * User invests `grossAmount` in a pro bot.
 *
 * Steps (all in one transaction):
 *   1. Verify bot is pro
 *   2. Verify user has available balance
 *   3. Compute entry fee + principal
 *   4. Compute shares issued based on pool's current NAV per share
 *   5. Debit user balance
 *   6. Upsert pool, increment counters
 *   7. Create BotInvestment
 *   8. Record platform revenue
 *   9. Create notification
 */
export async function investInBot(
  userId: string,
  botId: string,
  grossAmount: number
): Promise<InvestResult> {
  if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
    throw new Error("Amount must be positive");
  }

  return prisma.$transaction(async (tx) => {
    const bot = await tx.bot.findUnique({ where: { id: botId } });
    if (!bot) throw new Error("Bot not found");
    if (bot.status !== "pro") throw new Error("Bot is not investable yet");

    const balance = await tx.userBalance.findUnique({ where: { userId } });
    if (!balance || balance.available < grossAmount) {
      throw new Error("Insufficient balance");
    }

    const entryFee = grossAmount * ENTRY_FEE_PCT;
    const principal = grossAmount - entryFee;

    // Compute shares. On an empty pool, 1 share = $1.
    const pool = await tx.botInvestmentPool.upsert({
      where: { botId },
      create: { botId, totalPrincipal: 0, totalValue: 0, totalShares: 0, investorCount: 0 },
      update: {},
    });

    const navPerShare =
      pool.totalShares > 0 && pool.totalValue > 0
        ? pool.totalValue / pool.totalShares
        : 1;
    const shares = principal / navPerShare;

    // Debit user balance
    const newAvailable = balance.available - grossAmount;
    const newInvested = balance.invested + principal;
    await tx.userBalance.update({
      where: { userId },
      data: { available: newAvailable, invested: newInvested },
    });
    await tx.userBalanceLedger.create({
      data: {
        userId,
        kind: "invest",
        amount: -grossAmount,
        balanceAfter: newAvailable,
        refType: "investment",
        note: `Invested in ${bot.name}`,
      },
    });

    // Create the investment
    const investment = await tx.botInvestment.create({
      data: {
        userId,
        botId,
        principal,
        entryFeePaid: entryFee,
        sharesIssued: shares,
        currentValue: principal,
        status: "open",
      },
    });

    // Update pool aggregates
    await tx.botInvestmentPool.update({
      where: { botId },
      data: {
        totalPrincipal: pool.totalPrincipal + principal,
        totalValue: pool.totalValue + principal,
        totalShares: pool.totalShares + shares,
        investorCount: pool.investorCount + 1,
      },
    });

    // Platform revenue
    if (entryFee > 0) {
      await tx.platformRevenue.create({
        data: {
          source: "entry_fee",
          amount: entryFee,
          userId,
          botId,
          refType: "investment",
          refId: investment.id,
        },
      });
    }

    // Notification
    await tx.notification.create({
      data: {
        userId,
        kind: "back_confirmed",
        title: `Invested in ${bot.name}`,
        body: `$${principal.toFixed(2)} principal · $${entryFee.toFixed(2)} fee`,
        botId: bot.id,
        botName: bot.name,
        botEmoji: bot.emoji,
      },
    });

    return {
      investmentId: investment.id,
      principal,
      entryFee,
      shares,
    };
  });
}

/**
 * User divests (exits) an open investment at current mark-to-market.
 * Applies exit fee. Net proceeds credited to user balance.
 */
export async function divestBot(
  userId: string,
  investmentId: string
): Promise<{ grossProceeds: number; exitFee: number; netProceeds: number; pnl: number }> {
  return prisma.$transaction(async (tx) => {
    const inv = await tx.botInvestment.findUnique({
      where: { id: investmentId },
      include: { bot: true },
    });
    if (!inv) throw new Error("Investment not found");
    if (inv.userId !== userId) throw new Error("Not your investment");
    if (inv.status !== "open") throw new Error("Investment already closed");

    const pool = await tx.botInvestmentPool.findUnique({ where: { botId: inv.botId } });
    if (!pool) throw new Error("Pool missing");

    const navPerShare = pool.totalShares > 0 ? pool.totalValue / pool.totalShares : 1;
    const grossProceeds = inv.sharesIssued * navPerShare;
    const exitFee = grossProceeds * EXIT_FEE_PCT;
    const netProceeds = grossProceeds - exitFee;
    const pnl = netProceeds - inv.principal;

    const balance = await tx.userBalance.findUnique({ where: { userId } });
    if (!balance) throw new Error("No balance row");

    const newAvailable = balance.available + netProceeds;
    const newInvested = Math.max(0, balance.invested - inv.principal);

    await tx.userBalance.update({
      where: { userId },
      data: { available: newAvailable, invested: newInvested },
    });
    await tx.userBalanceLedger.create({
      data: {
        userId,
        kind: "divest",
        amount: netProceeds,
        balanceAfter: newAvailable,
        refType: "investment",
        refId: inv.id,
        note: `Divested from ${inv.bot.name}`,
      },
    });

    await tx.botInvestment.update({
      where: { id: investmentId },
      data: {
        status: "closed",
        closedAt: new Date(),
        currentValue: grossProceeds,
      },
    });

    await tx.botInvestmentPool.update({
      where: { botId: inv.botId },
      data: {
        totalPrincipal: Math.max(0, pool.totalPrincipal - inv.principal),
        totalValue: Math.max(0, pool.totalValue - grossProceeds),
        totalShares: Math.max(0, pool.totalShares - inv.sharesIssued),
        investorCount: Math.max(0, pool.investorCount - 1),
      },
    });

    if (exitFee > 0) {
      await tx.platformRevenue.create({
        data: {
          source: "exit_fee",
          amount: exitFee,
          userId,
          botId: inv.botId,
          refType: "investment",
          refId: inv.id,
        },
      });
    }

    return { grossProceeds, exitFee, netProceeds, pnl };
  });
}

// ------------------ Mark to market ------------------

/**
 * Update the investment pool value for a bot based on the bot's pnl change.
 * Called by the cron tick after the bot's simulated pnl is updated.
 *
 * The mechanic: if the bot's pnl changed by +2% this tick, the pool's
 * totalValue grows by 2% (proportional to invested capital).
 *
 * We track deltas, not absolute: newValue = oldValue * (1 + pnl_delta).
 */
export async function markPoolToMarket(
  botId: string,
  pnlDelta: number,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const client = tx ?? prisma;
  const pool = await client.botInvestmentPool.findUnique({ where: { botId } });
  if (!pool || pool.totalValue === 0) return;

  const newValue = pool.totalValue * (1 + pnlDelta);
  await client.botInvestmentPool.update({
    where: { botId },
    data: { totalValue: newValue },
  });

  // Also update each open investment's currentValue.
  // For large pools this could be expensive but is fine for launch scale.
  const shareRatio = pool.totalShares > 0 ? newValue / pool.totalShares : 1;
  await client.botInvestment.updateMany({
    where: { botId, status: "open" },
    data: {}, // Can't set based on another column easily; do per-row below if needed
  });

  // Fallback: update each row individually for accurate per-user values
  const openInvestments = await client.botInvestment.findMany({
    where: { botId, status: "open" },
  });
  for (const inv of openInvestments) {
    await client.botInvestment.update({
      where: { id: inv.id },
      data: { currentValue: inv.sharesIssued * shareRatio },
    });
  }
}
