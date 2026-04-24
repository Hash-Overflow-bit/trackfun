import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? 60)));
  const type = searchParams.get("type");

  const events = await prisma.feedEvent.findMany({
    where: type && type !== "all" ? { type } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({
    events: events.map(e => ({
      ...e,
      timestamp: e.createdAt.getTime(),
    })),
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
