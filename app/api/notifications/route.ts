import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, user) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const unread = notifications.filter(n => !n.read).length;
  return NextResponse.json({
    notifications: notifications.map(n => ({
      ...n,
      timestamp: n.createdAt.getTime(),
    })),
    unreadCount: unread,
  }, { headers: { "Cache-Control": "no-store" } });
});

export const POST = withAuth(async (req, user) => {
  const body = await req.json().catch(() => ({}));
  if (body.action === "mark_all_read") {
    await prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    });
    return NextResponse.json({ ok: true });
  }
  if (body.action === "clear") {
    await prisma.notification.deleteMany({ where: { userId: user.id } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
});
