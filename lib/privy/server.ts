// ============================================================
// Privy server-side helpers.
//
// Use these in API route handlers to verify that a request is
// coming from an authenticated user.
//
// Requires env vars:
//   NEXT_PUBLIC_PRIVY_APP_ID
//   PRIVY_APP_SECRET
// ============================================================

import { PrivyClient } from "@privy-io/server-auth";

let cached: PrivyClient | null = null;

/**
 * Get a memoized Privy server client.
 * Throws at request-time (not build-time) if env vars are missing,
 * so the build doesn't fail when secrets haven't been set yet.
 */
export function getPrivyServerClient(): PrivyClient {
  if (cached) return cached;

  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error(
      "Privy server client not configured. Set NEXT_PUBLIC_PRIVY_APP_ID and PRIVY_APP_SECRET in .env.local."
    );
  }

  cached = new PrivyClient(appId, appSecret);
  return cached;
}

/**
 * Verify a Privy access token from an incoming request.
 * Returns the verified user claims, or null if the token is missing/invalid.
 *
 * Usage:
 *   const claims = await verifyPrivyToken(req);
 *   if (!claims) return new Response("Unauthorized", { status: 401 });
 */
export async function verifyPrivyToken(
  req: Request
): Promise<{ userId: string } | null> {
  try {
    const auth = req.headers.get("authorization");
    if (!auth || !auth.startsWith("Bearer ")) return null;
    const token = auth.slice("Bearer ".length);
    const client = getPrivyServerClient();
    const verified = await client.verifyAuthToken(token);
    return { userId: verified.userId };
  } catch {
    return null;
  }
}
