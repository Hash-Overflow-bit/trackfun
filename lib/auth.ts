// ============================================================
// Server-side auth helpers that bridge Privy <-> our User table.
//
// Use requireUser() in every authenticated API route.
// ============================================================

import { NextResponse } from "next/server";
import { verifyPrivyToken, getPrivyServerClient } from "@/lib/privy/server";
import { prisma } from "@/lib/db";

export interface AuthedUser {
  id: string;              // Privy DID
  email: string | null;
  walletAddr: string | null;
  isAdmin: boolean;
}

/**
 * Verify Privy token, upsert the User row, return the user.
 * Returns null if the token is missing/invalid.
 */
export async function getAuthedUser(req: Request): Promise<AuthedUser | null> {
  const claims = await verifyPrivyToken(req);
  if (!claims) return null;

  const privyId = claims.userId;

  // First check if we already have a row — common case, skip the
  // Privy API call.
  const existing = await prisma.user.findUnique({ where: { id: privyId } });
  if (existing) {
    // Touch lastSeenAt opportunistically (don't await to keep fast)
    prisma.user.update({
      where: { id: privyId },
      data: { lastSeenAt: new Date() },
    }).catch(() => {});
    return {
      id: existing.id,
      email: existing.email,
      walletAddr: existing.walletAddr,
      isAdmin: existing.isAdmin,
    };
  }

  // New user — fetch full details from Privy and upsert.
  let email: string | null = null;
  let walletAddr: string | null = null;
  let displayName: string | null = null;
  try {
    const client = getPrivyServerClient();
    const user = await client.getUser(privyId);
    email =
      (user?.email?.address as string | undefined) ??
      (user?.google?.email as string | undefined) ??
      null;
    walletAddr = (user?.wallet?.address as string | undefined) ?? null;
    displayName = email ? email.split("@")[0] : walletAddr ? walletAddr.slice(0, 8) : null;
  } catch {
    // If Privy lookup fails, still create a minimal user row — we have
    // their verified DID and that's enough to record ownership.
  }

  const created = await prisma.user.create({
    data: {
      id: privyId,
      email,
      walletAddr,
      displayName,
    },
  });

  return {
    id: created.id,
    email: created.email,
    walletAddr: created.walletAddr,
    isAdmin: created.isAdmin,
  };
}

/**
 * Wrap an API route handler: reject unauthenticated requests with 401.
 *
 * Usage:
 *   export const POST = withAuth(async (req, user) => { ... });
 */
export function withAuth<T>(
  handler: (req: Request, user: AuthedUser) => Promise<T>
): (req: Request) => Promise<T | NextResponse> {
  return async (req: Request) => {
    const user = await getAuthedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return handler(req, user);
  };
}

/**
 * Like withAuth but also requires isAdmin.
 */
export function withAdminAuth<T>(
  handler: (req: Request, user: AuthedUser) => Promise<T>
): (req: Request) => Promise<T | NextResponse> {
  return async (req: Request) => {
    const user = await getAuthedUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return handler(req, user);
  };
}
