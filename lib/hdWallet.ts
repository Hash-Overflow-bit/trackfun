// ============================================================
// HD wallet derivation.
//
// We don't store private keys in the app. You configure:
//   HOT_WALLET_XPUB = the extended PUBLIC key for m/44'/60'/0'/0
//
// Each user gets a unique deposit address derived at an ascending
// index. The app NEVER signs transactions — it only watches the
// addresses. Funds are swept by a separate treasury process with
// access to the private keys (out of scope for this code).
//
// Security model:
//   - xpub is non-sensitive (public key tree). Safe to put in env.
//   - Master private key lives in cold storage / treasury service.
//   - Compromise of this server does NOT leak funds, only the
//     ability to derive addresses (which the attacker could do
//     anyway from the xpub).
// ============================================================

import { HDKey } from "viem/accounts";
import { publicKeyToAddress } from "viem/accounts";
import { prisma } from "./db";

let cachedHdKey: HDKey | null = null;

function getHdKey(): HDKey {
  if (cachedHdKey) return cachedHdKey;
  const xpub = process.env.HOT_WALLET_XPUB;
  if (!xpub) {
    throw new Error(
      "HOT_WALLET_XPUB not set. Generate an HD wallet offline, export its xpub, " +
      "and paste here. Never put the seed phrase or xprv in this env."
    );
  }
  try {
    cachedHdKey = HDKey.fromExtendedKey(xpub);
    return cachedHdKey;
  } catch (err) {
    throw new Error(`Invalid HOT_WALLET_XPUB: ${(err as Error).message}`);
  }
}

/**
 * Derive the EVM address at a given index.
 * Path: the xpub is assumed to be at m/44'/60'/0'/0, so we just need the leaf index.
 */
export function deriveAddressAtIndex(index: number): string {
  if (index < 0 || !Number.isInteger(index)) {
    throw new Error(`Invalid derivation index: ${index}`);
  }
  const hd = getHdKey().deriveChild(index);
  if (!hd.publicKey) throw new Error("HD derivation failed");
  // Convert the public key to an EVM address
  const addr = publicKeyToAddress(`0x${Buffer.from(hd.publicKey).toString("hex")}`);
  return addr.toLowerCase();
}

/**
 * Assign a deposit address to a user.
 *
 * Uses the User's row count at creation as the monotonic index.
 * Idempotent: returns the existing DepositAddress if one exists.
 */
export async function assignDepositAddress(userId: string): Promise<{ address: string; chain: string; token: string }> {
  const existing = await prisma.depositAddress.findUnique({ where: { userId } });
  if (existing) {
    return { address: existing.address, chain: existing.chain, token: existing.token };
  }

  // Atomically claim the next index. Use a count + retry loop to handle
  // the race where two users create addresses simultaneously.
  let attempts = 0;
  while (attempts < 5) {
    const count = await prisma.depositAddress.count();
    const index = count + 1; // index 0 is reserved as the treasury/hot wallet itself
    const address = deriveAddressAtIndex(index);

    try {
      await prisma.depositAddress.create({
        data: {
          userId,
          address,
          chain: "base",
          token: "USDC",
        },
      });
      return { address, chain: "base", token: "USDC" };
    } catch (err: any) {
      // Unique constraint violation — another request won the race.
      // Retry with a fresh count.
      if (err?.code === "P2002") {
        attempts++;
        continue;
      }
      throw err;
    }
  }
  throw new Error("Could not assign deposit address after 5 attempts");
}
