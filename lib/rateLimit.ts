// ============================================================
// Postgres-backed rate limiter.
//
// Simple fixed-window counter. Not as fast as Redis but sufficient
// for launch scale (Supabase free tier handles this fine up to ~
// a few hundred req/s).
//
// Usage:
//   const allowed = await checkRateLimit(`execute:${user.id}`, 60, 60);
//   if (!allowed) return NextResponse.json({error: "Rate limit"}, {status: 429});
// ============================================================

import { prisma } from "./db";

/**
 * @param key           Unique identifier for the bucket (e.g. "execute:user123")
 * @param maxRequests   Max requests allowed per window
 * @param windowSeconds Length of the window in seconds
 * @returns true if the request is allowed, false if rate-limited
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<boolean> {
  const now = new Date();

  try {
    const bucket = await prisma.rateLimitBucket.findUnique({ where: { key } });

    if (!bucket || bucket.resetAt < now) {
      // New window
      await prisma.rateLimitBucket.upsert({
        where: { key },
        create: {
          key,
          count: 1,
          resetAt: new Date(now.getTime() + windowSeconds * 1000),
        },
        update: {
          count: 1,
          resetAt: new Date(now.getTime() + windowSeconds * 1000),
        },
      });
      return true;
    }

    if (bucket.count >= maxRequests) {
      return false;
    }

    await prisma.rateLimitBucket.update({
      where: { key },
      data: { count: { increment: 1 } },
    });
    return true;
  } catch (err) {
    // If the rate limiter itself fails, fail open — better to serve
    // than to 429 a legitimate user because our DB hiccuped.
    console.error("Rate limiter error:", err);
    return true;
  }
}

/**
 * Clean up expired buckets. Called from the cron tick.
 */
export async function cleanupExpiredBuckets(): Promise<number> {
  const result = await prisma.rateLimitBucket.deleteMany({
    where: { resetAt: { lt: new Date() } },
  });
  return result.count;
}
