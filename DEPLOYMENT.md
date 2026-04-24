# Track.fun — Production Deployment Guide

Ship Track.fun to production in about 30 minutes. This guide assumes you have a working shell, a GitHub repo, and a credit card (for Supabase + Vercel free tiers — no real charges on launch day).

---

## Prerequisites

- Node 20+ (`node -v` to check)
- A GitHub account
- A Supabase account (free)
- A Vercel account (free)
- A Privy account (free) — already have this if you ran the dev version

---

## Step 1: Supabase database (5 min)

1. Go to [supabase.com](https://supabase.com/dashboard) → **New project**
2. Name: `trackfun-prod` · Region: closest to your users · Password: generate a strong one + save it
3. Wait ~90 seconds for provisioning
4. Go to **Settings → Database → Connection string → URI**
5. Copy both connection strings:
   - **Transaction mode (port 6543)** — for `DATABASE_URL`, add `?pgbouncer=true` to the end
   - **Session mode (port 5432)** — for `DIRECT_URL`

You'll paste these into Vercel env vars in Step 3.

---

## Step 2: Push the code to GitHub (3 min)

```bash
cd trackfun
git init
git add .
git commit -m "Initial commit"
# Create repo on GitHub, then:
git remote add origin git@github.com:YOUR_USERNAME/trackfun.git
git push -u origin main
```

---

## Step 3: Deploy to Vercel (10 min)

### 3a. Create the Vercel project

1. [vercel.com/new](https://vercel.com/new) → **Import** your GitHub repo
2. Framework Preset: **Next.js** (auto-detected)
3. **DON'T DEPLOY YET** — click **Environment Variables** first

### 3b. Paste these env vars

| Variable | Value | Scope |
|---|---|---|
| `DATABASE_URL` | Supabase transaction-mode URL with `?pgbouncer=true` | All |
| `DIRECT_URL` | Supabase session-mode URL | All |
| `CRON_SECRET` | Generate: `openssl rand -hex 32` | All |
| `NEXT_PUBLIC_PRIVY_APP_ID` | From [dashboard.privy.io](https://dashboard.privy.io) | All |
| `PRIVY_APP_SECRET` | From Privy dashboard → App Settings → API Keys | Production, Preview |
| `SIM_SPREAD_CENTS` | `0.01` (or leave blank for default) | All |
| `POLYMARKET_GAMMA_URL` | `https://gamma-api.polymarket.com` | All |

Save a copy of `CRON_SECRET` — you'll need it to manually trigger ticks during verification.

### 3c. Configure Privy for production

In Privy dashboard → **App Settings**:
1. **Login methods** → enable Email + Google + Wallet
2. **Allowed origins** → add your Vercel URL (e.g. `https://trackfun.vercel.app`) and any custom domain
3. **Embedded wallets** → enable "Create on login for users without wallets"

### 3d. First deploy

Click **Deploy**. The build will fail the first time because the DB is empty. That's expected — we'll fix it next.

---

## Step 4: Run migrations + seed (5 min)

From your local machine (not Vercel):

```bash
# In the trackfun directory, create a local .env with JUST the DB URLs:
cat > .env << EOF
DATABASE_URL="paste-your-supabase-transaction-url?pgbouncer=true"
DIRECT_URL="paste-your-supabase-session-url"
EOF

# Install deps
npm install

# Push schema to Supabase (creates all tables)
npm run db:push

# Seed the 65 bots + initial markets + feed events
npm run db:seed
```

Expected output:
```
🌱 Seeding database...
✓ 65 bots seeded
✓ 30 markets seeded
✓ Initial feed events seeded
✅ Seed complete
```

**Delete the `.env` file now.** You don't want it in git.

```bash
rm .env
```

---

## Step 5: Re-deploy and verify (5 min)

Trigger a fresh Vercel deploy (just push an empty commit or use the Redeploy button):

```bash
git commit --allow-empty -m "Redeploy after seed" && git push
```

Wait ~2 min. Then:

### 5a. Smoke-test the API

```bash
export URL=https://your-app.vercel.app

# Public endpoints
curl $URL/api/bots | head -c 200
curl $URL/api/feed | head -c 200
curl $URL/api/polymarket/markets?limit=5 | head -c 200

# Protected — these should all return 401
curl $URL/api/me
curl -X POST $URL/api/bots/create -d '{}'
curl -X POST $URL/api/backings -d '{}'

# Cron — should return 401 without the secret
curl $URL/api/cron/tick

# Cron with secret — should return 200 + stats
curl -H "Authorization: Bearer $CRON_SECRET" $URL/api/cron/tick
```

### 5b. Browser smoke-test

1. Open `https://your-app.vercel.app`
2. Onboarding modal appears on first load
3. You see 65 bots in the leaderboard
4. Feed has events streaming in
5. Click "Log in" → Privy modal → complete email/Google flow
6. Click "Launch Bot" → fill the form → bot appears in My Bots tab
7. Click "🔥 Back" on any bot → back with $100 → portfolio updates
8. Notification bell shows a red dot with unread count

### 5c. Verify cron is running

Vercel Cron runs every minute. Check:

1. [Vercel dashboard → your project → Settings → Cron Jobs](https://vercel.com/docs/cron-jobs) — you should see `/api/cron/tick` listed with schedule `* * * * *`
2. Check recent execution logs in **Logs → Cron** — you should see `200 OK` responses every minute with a JSON stats payload

If cron isn't running:
- Vercel **Hobby tier** only allows **1 cron job per project and runs are best-effort** — this is fine for launch.
- Cron requires the project to be **deployed to production** (not just preview).

---

## Step 6: Make yourself admin (2 min)

You'll want to see spread revenue. Go to Supabase → **Table Editor → User**:

1. Log in to your deployed app once so your User row exists
2. Find your row, flip `isAdmin` to `true`
3. Now `GET /api/admin/spread-revenue` works for you

---

## Step 7: Optional but recommended

### Custom domain

Vercel → Project → Settings → Domains → add your domain. Free SSL included.

### Error monitoring

Install Sentry (5 min):
```bash
npx @sentry/wizard@latest -i nextjs
```
Then paste the Sentry DSN into Vercel env vars.

### Analytics

Vercel → Project → Analytics → enable. Free tier is generous.

---

## What's in the box

| Thing | Status |
|---|---|
| Postgres persistence (users, bots, backings, notifications, trades, revenue) | ✅ |
| Privy authentication + User upsert | ✅ |
| Auth-gated API routes | ✅ |
| Admin role gate on revenue endpoint | ✅ |
| Rate limiting (execute, create, back) | ✅ |
| Vercel Cron tick every minute — advances bots + refreshes markets + generates feed | ✅ |
| Polymarket read-only integration with DB cache | ✅ |
| Spread engine with silent monetization (26 unit tests + integration test passing) | ✅ |
| User bankroll cap ($100k total) | ✅ |
| Bot creation cap (10 per user) | ✅ |
| Error boundaries (route-level + global) | ✅ |
| Login gates on bot creation + backing | ✅ |
| Server-side bot simulation (all users see same numbers) | ✅ |

---

## Known limits to tell your users

- **Paper trading only** — no real money, ever. This is intentional.
- **Cron runs every minute**, so bot numbers update every ~60s, not in real time. This is the Vercel free-tier constraint and fine for a social/fantasy product.
- **Polymarket data is cached for 5 minutes** server-side. The "LIVE" indicator reflects client-side price drift between refreshes.

---

## Rollback plan

If something goes sideways after launch:

1. Vercel → Deployments → previous good deploy → **Promote to Production**
2. If the DB is corrupted: Supabase → **Database → Backups → Restore** (daily auto-backup included on free tier)

---

## Support runbook

| Symptom | Check |
|---|---|
| Users see "Unauthorized" after login | Privy allowed origins include your domain |
| Bots don't update | `/api/cron/tick` logs in Vercel; `CRON_SECRET` matches |
| API returns 500 | Vercel **Logs** tab; most common cause is DB connection limit — bump Supabase tier |
| Revenue dashboard empty | `User.isAdmin = true` for your row; cron is actually running |
| Leaderboard shows zero bots | `npm run db:seed` wasn't run |

---

## v0.6 additions — Investment lifecycle

### New tables (auto-created by `npm run db:push`)
- `BotPerformance` — equity-curve snapshots (1 per bot per tick-ish)
- `UserBalance` — per-user virtual dollar balance
- `UserBalanceLedger` — append-only audit of all balance changes
- `BotInvestment` — a user's position in a pro bot
- `BotInvestmentPool` — aggregate pool of real capital per bot
- `PlatformRevenue` — fees by source (entry_fee, exit_fee, spread, mgmt_fee)

### New bot lifecycle
Every bot is born with `status: "new"` and a $1,000 virtual bankroll. They
progress through:
- **new** — trading simulation only, no investment allowed
- **rising** — ≥ +15% return AND ≥ 10 trades (display only, still no investment)
- **pro** — ≥ +30% return AND ≥ 20 trades → real investment unlocks

Pro is one-way. Bots never downgrade.

### New API endpoints
- `GET /api/balance` — user's balance + ledger
- `POST /api/balance` — deposit (mock — virtual dollars until Stripe is wired)
- `GET /api/investments` — list user's open + closed investments
- `POST /api/investments` — invest in a pro bot `{ botId, amount }`
- `DELETE /api/investments?id=xxx` — divest at current mark-to-market

### Fees
- Entry fee: **1.5%** of gross investment (caller pays, routed to `PlatformRevenue`)
- Exit fee: **1%** of gross proceeds on divest
- Spread fee: unchanged (see `SIM_SPREAD_CENTS`)

All fees recorded in the `PlatformRevenue` table. Query by `source`
(`entry_fee` / `exit_fee` / `spread`) to break them down.

### ⚠️ Legal status of real-money deposits

**The deposit endpoint currently credits virtual dollars.** The accounting
and UI show "USD" but no payment processor is wired in. This is intentional.

Operating a pooled investment vehicle where users allocate money to a
"manager" (bot) for a fee is a regulated securities activity in most
jurisdictions. Before flipping the switch to real money, you need:

1. **Securities counsel review** — confirm the structure (is each Pro bot
   an investment contract? A pooled fund? An adviser relationship?)
2. **Stripe Connect** (or equivalent) for deposit/withdrawal rails
3. **KYC provider** (Persona, Alloy, etc.) for identity verification
4. **State-by-state money transmitter licensing** (US) or equivalent
   (EU: VASP registration, UK: FCA, etc.)
5. **Disclosure and risk warnings** in the UI and ToS
6. **AML monitoring** and FinCEN compliance if in the US

When you're cleared, the switch is small:
- `/api/balance` POST: call Stripe instead of writing to ledger
- Add `/api/balance/withdraw` endpoint
- Change `UserBalance.currency` from `USD_VIRTUAL` to `USD`
- Add a banner removal step in the Deposit modal

Everything else — the investment flow, mark-to-market, fee accounting,
ledger, pool math — is production-correct today.

---

## v0.7 — Crypto deposits (USDC on Base)

### Architecture
- HD wallet derivation: each user gets a unique deposit address at an ascending index (`m/44'/60'/0'/0/N`)
- Indexer runs every minute via the existing cron tick
- Scans Base chain for USDC `Transfer` events to watched addresses
- 12 confirmations required before credit
- Deduplication via `(txHash, logIndex)` unique constraint
- Safety flag `CRYPTO_DEPOSITS_LIVE` gates whether confirmed deposits actually credit balances

### New tables
- `DepositAddress` — one per user, mapped to HD index
- `Deposit` — one row per on-chain USDC transfer to a watched address
- `IndexerCursor` — tracks last block scanned per chain

### New env vars (REQUIRED)
```
HOT_WALLET_XPUB=xpub6...            # generated OFFLINE, xpub only (never xprv)
BASE_RPC_URL=https://...            # Alchemy/QuickNode/Infura recommended
CRYPTO_DEPOSITS_LIVE=false          # flip to "true" when ready to credit balances
```

### Generating your HD wallet

**Critical: do this offline.** Private keys never touch this server.

```bash
# On an offline machine (e.g. ledger live, secure air-gapped laptop):
# 1. Generate a BIP39 seed phrase (24 words)
# 2. Derive the xpub at path m/44'/60'/0'/0
# 3. Store seed offline (hardware wallet + paper backup)
# 4. Copy ONLY the xpub to your production env
```

Reference tools for xpub generation:
- Ledger Live (Export xpub feature)
- `ethers-hd-derivation` CLI
- Any BIP39 wallet that supports Ethereum-class derivation

### Funds sweep

The app only *watches* deposit addresses. To move funds to your treasury:

1. Run a separate sweeper script (not included — intentionally keeps private keys
   out of this app) using your offline seed
2. Read `DepositAddress` rows from DB to know which addresses to sweep
3. Sweep USDC to your cold wallet; keep a small gas reserve

Recommended pattern: sweep weekly, threshold = $500 per address.

### Going live

1. Paste real `HOT_WALLET_XPUB` + `BASE_RPC_URL` in Vercel env
2. Deploy. Cron will start indexing.
3. Have a friend send $5 USDC to their deposit address
4. Verify in DB: Deposit row appears with `status = "detected"` → `"confirming"` → `"confirmed"`
5. Verify user's balance is NOT yet credited (CRYPTO_DEPOSITS_LIVE=false)
6. Once confident: set `CRYPTO_DEPOSITS_LIVE=true`, redeploy
7. All `confirmed` deposits get credited on the next tick
