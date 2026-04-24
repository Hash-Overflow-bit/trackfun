// ============================================================
// Deposit indexer.
//
// Scans USDC Transfer events on Base chain, matches `to` addresses
// against our DepositAddress table, and credits confirmed deposits
// to user balances.
//
// Called by the cron tick. Idempotent:
//   - The (txHash, logIndex) unique constraint on Deposit prevents
//     double-inserting the same transfer.
//   - The status machine (detected → confirming → confirmed → credited)
//     prevents double-crediting even if the status is re-read.
//
// Safety flag:
//   CRYPTO_DEPOSITS_LIVE=false → deposits are detected and stored,
//   but NOT credited to user balance. Lets you verify the pipeline
//   on mainnet before flipping the switch.
// ============================================================

import { createPublicClient, http, parseAbiItem, decodeEventLog, getAddress, type Log } from "viem";
import { base } from "viem/chains";
import { prisma } from "./db";
import { BASE, cryptoDepositsLive } from "./chains";

// USDC contract ABI — just the Transfer event
const USDC_TRANSFER_ABI = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

function getClient() {
  return createPublicClient({
    chain: base,
    transport: http(BASE.rpcUrl),
  });
}

export interface IndexerResult {
  fromBlock: bigint;
  toBlock: bigint;
  transfersScanned: number;
  depositsInserted: number;
  depositsConfirmed: number;
  depositsCredited: number;
  errors: string[];
}

/**
 * Main indexer entry point. Call from cron.
 *
 * Three phases:
 *   1. Scan new blocks for USDC transfers to our watched addresses
 *   2. Update confirmation counts on pending deposits
 *   3. Credit any deposit that just crossed the confirmation threshold
 */
export async function runDepositIndexer(): Promise<IndexerResult> {
  const client = getClient();
  const errors: string[] = [];
  let transfersScanned = 0;
  let depositsInserted = 0;
  let depositsConfirmed = 0;
  let depositsCredited = 0;

  // ---- Phase 0: Load cursor + get current head ----
  const cursor = await prisma.indexerCursor.upsert({
    where: { chain: BASE.name },
    create: { chain: BASE.name, lastBlock: BigInt(0) },
    update: {},
  });

  const head = await client.getBlockNumber();

  // First run: start near head to avoid scanning all of Base history
  let fromBlock = cursor.lastBlock === BigInt(0)
    ? head - BigInt(100)
    : cursor.lastBlock + BigInt(1);
  if (fromBlock > head) fromBlock = head;

  let toBlock = head;
  const maxPerRun = BigInt(BASE.maxBlocksPerRun);
  if (toBlock - fromBlock > maxPerRun) {
    toBlock = fromBlock + maxPerRun;
  }

  // ---- Phase 1: Scan USDC Transfer logs ----
  // We fetch ALL transfers in range, then filter by `to` in code. For low
  // deposit volume this is fine; optimize by filtering server-side if needed.
  if (toBlock >= fromBlock) {
    try {
      // Get the set of watched addresses
      const watched = await prisma.depositAddress.findMany({
        where: { chain: BASE.name },
        select: { id: true, userId: true, address: true },
      });
      if (watched.length > 0) {
        const watchedSet = new Map(watched.map(w => [w.address.toLowerCase(), w]));

        const logs = await client.getLogs({
          address: BASE.usdcAddress as `0x${string}`,
          event: USDC_TRANSFER_ABI,
          fromBlock,
          toBlock,
        });
        transfersScanned = logs.length;

        for (const log of logs) {
          const decoded = decodeEventLog({
            abi: [USDC_TRANSFER_ABI],
            data: log.data,
            topics: log.topics,
          });
          const toAddr = (decoded.args.to as string).toLowerCase();

          const match = watchedSet.get(toAddr);
          if (!match) continue;

          const fromAddr = (decoded.args.from as string).toLowerCase();
          const amountRaw = (decoded.args.value as bigint).toString();
          const amountUsd = Number(decoded.args.value) / 10 ** BASE.usdcDecimals;

          // Zero-value transfers are spam; skip
          if (decoded.args.value === BigInt(0)) continue;

          // Get block timestamp
          let blockTimestamp = new Date();
          try {
            const block = await client.getBlock({ blockNumber: log.blockNumber! });
            blockTimestamp = new Date(Number(block.timestamp) * 1000);
          } catch { /* fall back to detected time */ }

          try {
            await prisma.deposit.create({
              data: {
                userId: match.userId,
                depositAddressId: match.id,
                txHash: log.transactionHash!,
                logIndex: Number(log.logIndex ?? 0),
                fromAddress: fromAddr,
                toAddress: toAddr,
                chain: BASE.name,
                token: "USDC",
                amountRaw,
                amountUsd,
                blockNumber: log.blockNumber!,
                blockTimestamp,
                confirmations: Number(head - log.blockNumber!),
                status: "detected",
              },
            });
            depositsInserted++;
          } catch (err: any) {
            // Unique constraint (txHash, logIndex) — already saved this
            if (err?.code !== "P2002") {
              errors.push(`insert: ${err?.message ?? err}`);
            }
          }
        }
      }

      // Advance cursor
      await prisma.indexerCursor.update({
        where: { chain: BASE.name },
        data: { lastBlock: toBlock },
      });
    } catch (err: any) {
      errors.push(`scan: ${err?.message ?? err}`);
    }
  }

  // ---- Phase 2: Update confirmations on pending deposits ----
  const pending = await prisma.deposit.findMany({
    where: { chain: BASE.name, status: { in: ["detected", "confirming"] } },
    take: 200,
  });
  for (const d of pending) {
    const confirmations = Number(head - d.blockNumber);
    const nextStatus = confirmations >= BASE.confirmations ? "confirmed" : "confirming";
    if (confirmations !== d.confirmations || nextStatus !== d.status) {
      await prisma.deposit.update({
        where: { id: d.id },
        data: { confirmations, status: nextStatus },
      });
      if (nextStatus === "confirmed" && d.status !== "confirmed") {
        depositsConfirmed++;
      }
    }
  }

  // ---- Phase 3: Credit confirmed deposits ----
  // CRYPTO_DEPOSITS_LIVE gates the actual balance credit. Without it,
  // deposits stay in "confirmed" state forever (safe for dry-run).
  if (cryptoDepositsLive()) {
    const toCredit = await prisma.deposit.findMany({
      where: { chain: BASE.name, status: "confirmed" },
      take: 100,
    });
    for (const d of toCredit) {
      try {
        await creditDeposit(d.id);
        depositsCredited++;
      } catch (err: any) {
        errors.push(`credit ${d.id}: ${err?.message ?? err}`);
      }
    }
  }

  return {
    fromBlock,
    toBlock,
    transfersScanned,
    depositsInserted,
    depositsConfirmed,
    depositsCredited,
    errors,
  };
}

/**
 * Credit a single confirmed deposit to the user's balance.
 * Transactional: deposit.status → "credited" and ledger entry
 * are written in one atomic operation.
 */
async function creditDeposit(depositId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Re-read under the transaction to avoid double-crediting
    const deposit = await tx.deposit.findUnique({ where: { id: depositId } });
    if (!deposit) return;
    if (deposit.status !== "confirmed") return; // already credited or rejected

    // Ensure balance row exists
    const balance = await tx.userBalance.upsert({
      where: { userId: deposit.userId },
      create: { userId: deposit.userId, available: 0, invested: 0 },
      update: {},
    });

    const newAvailable = balance.available + deposit.amountUsd;

    await tx.userBalance.update({
      where: { userId: deposit.userId },
      data: {
        available: newAvailable,
        totalDeposited: balance.totalDeposited + deposit.amountUsd,
      },
    });

    const ledger = await tx.userBalanceLedger.create({
      data: {
        userId: deposit.userId,
        kind: "deposit",
        amount: deposit.amountUsd,
        balanceAfter: newAvailable,
        refType: "deposit",
        refId: deposit.id,
        note: `USDC deposit · ${deposit.txHash.slice(0, 10)}…`,
      },
    });

    await tx.deposit.update({
      where: { id: depositId },
      data: {
        status: "credited",
        creditedAt: new Date(),
        ledgerRefId: ledger.id.toString(),
      },
    });

    await tx.notification.create({
      data: {
        userId: deposit.userId,
        kind: "back_confirmed",
        title: `Deposit credited`,
        body: `$${deposit.amountUsd.toFixed(2)} USDC credited to your balance`,
      },
    });
  });
}
