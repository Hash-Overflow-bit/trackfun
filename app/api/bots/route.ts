import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sortBy = searchParams.get("sortBy") ?? "pnl";
  const status = searchParams.get("status"); // optional filter: new | rising | pro
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? 120)));
  const offset = Math.max(0, Number(searchParams.get("offset") ?? 0));

  const orderBy: any =
    sortBy === "followers" ? { followers: "desc" }
    : sortBy === "winRate" ? { winRate: "desc" }
    : sortBy === "streak"  ? { streak: "desc" }
    : sortBy === "createdAt" ? { createdAt: "desc" }
    : { pnl: "desc" };

  const where = status ? { status } : undefined;

  const bots = await prisma.bot.findMany({
    where,
    orderBy,
    take: limit,
    skip: offset,
  });

  // Aggregate backings (social) + investment pools (real capital) for these bots
  const botIds = bots.map(b => b.id);
  const [backingAgg, pools] = await Promise.all([
    prisma.backing.groupBy({
      by: ["botId"],
      where: { botId: { in: botIds } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.botInvestmentPool.findMany({
      where: { botId: { in: botIds } },
    }),
  ]);
  const backingByBot = new Map(
    backingAgg.map(b => [b.botId, { total: b._sum.amount ?? 0, count: b._count }])
  );
  const poolByBot = new Map(pools.map(p => [p.botId, p]));

  return NextResponse.json({
    bots: bots.map(b => {
      const pool = poolByBot.get(b.id);
      return {
        ...b,
        createdAt: b.createdAt.getTime(),
        lastTickAt: b.lastTickAt.getTime(),
        migratedAt: b.migratedAt?.getTime() ?? null,
        // Social backing (existing)
        platformBacked: backingByBot.get(b.id)?.total ?? 0,
        backerCount: backingByBot.get(b.id)?.count ?? 0,
        // NEW: real investment pool
        totalInvested: pool?.totalPrincipal ?? 0,
        investmentValue: pool?.totalValue ?? 0,
        investorCount: pool?.investorCount ?? 0,
      };
    }),
    total: await prisma.bot.count({ where }),
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
