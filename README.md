# Track.fun

A fantasy bot competition platform where users train AI bots to predict the
future on real-world prediction markets (Polymarket-backed, read-only),
with simulated paper trading, leaderboards, tournaments, and social backing.

---

## What's in v0.4

The engagement layer added on top of v0.3's feed + spread system:

- **Back Bot system**: Users back bots with virtual capital. Platform-wide
  backed totals, backer counts, user's personal portfolio, top-up flow.
- **Notification center** with bell icon, unread count, typed notifications:
  bot launched, promoted, big win, big loss, arena starting, follower
  milestone, back confirmed.
- **Toast notifications** — ephemeral bottom-right toasts auto-dismiss at 4s.
- **Onboarding** — 4-step intro shown once, stored in localStorage.
- **User account page** — "Me" tab: bots created, bots backed, capital
  deployed, mark-to-market portfolio value, activity feed.
- **Upgraded bot profile** — status badges (Rising/Hot/Pro/Elite), "Back
  This Bot" primary CTA, Milestones timeline, social-proof avatars,
  backed capital + win streak cards.
- **Upgraded leaderboard** — time range filter (24h/7d/30d/All), sort by
  return / win rate / streak / followers / backed $, style dropdown,
  inline "🔥 Back" action, empty state.

All state is in-memory (React context). Swap for Postgres when persisting.

---

## Stack

- **Framework**: Next.js 14 (App Router, TypeScript)
- **Styling**: Tailwind CSS
- **Auth**: [Privy](https://privy.io) (`@privy-io/react-auth`, `@privy-io/server-auth`)
- **Markets**: Polymarket Gamma API (public, read-only)
- **State**: React hooks (no external store yet)

---

## 1. Install

```bash
npm install
```

This installs:

| Package | Purpose |
|---|---|
| `next@14.2.15` | Framework |
| `react@18`, `react-dom@18` | UI runtime |
| `@privy-io/react-auth@^2.0.0` | Client-side auth SDK |
| `@privy-io/server-auth@^1.20.0` | Server-side token verification |
| `lucide-react` | Icons |
| `tailwindcss`, `postcss`, `autoprefixer` | Styling |
| `typescript`, `@types/*` | TS tooling |

No other secrets or API keys are needed — Polymarket's Gamma API is public.

---

## 2. Environment variables

Copy the template:

```bash
cp .env.example .env.local
```

Then open `.env.local` and fill in the Privy credentials. Get them from the
[Privy Dashboard](https://dashboard.privy.io/).

```dotenv
# === Privy ===
# Public. Safe to expose.
NEXT_PUBLIC_PRIVY_APP_ID=<PASTE_PRIVY_APP_ID_HERE>

# Optional. Only needed if your Privy app requires it.
NEXT_PUBLIC_PRIVY_CLIENT_ID=<PASTE_PRIVY_CLIENT_ID_HERE_OR_LEAVE_BLANK>

# SERVER-SIDE ONLY. Never commit, never expose.
PRIVY_APP_SECRET=<PASTE_PRIVY_APP_SECRET_HERE>

# === Polymarket ===
# Public API. You don't need to change this.
POLYMARKET_GAMMA_URL=https://gamma-api.polymarket.com

# Client-side polling interval in ms (default 30s).
NEXT_PUBLIC_POLYMARKET_REFRESH_MS=30000
```

**If you don't paste Privy credentials:** the app still renders, but login is
disabled and the header shows an "Auth not configured" badge. This is
intentional — devs can preview the UI before wiring up Privy.

**In the Privy Dashboard**, under your app's settings, make sure to enable:
- **Login methods**: Email, Google, Wallet (at minimum)
- **Embedded wallets**: enabled (the provider creates them for users without wallets)

---

## 3. Run

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

To verify Polymarket is wired up, hit the API route directly:

```bash
curl 'http://localhost:3000/api/polymarket/markets?limit=5' | jq
```

You should see an array of normalized markets with `id`, `title`, `category`,
`yesPrice`, `vol`, etc.

---

## 4. Architecture

### Directory layout

```
app/
├── layout.tsx                     # Wraps app in TrackFunPrivyProvider
├── page.tsx                       # Renders <TrackFun />
├── globals.css                    # Fonts, keyframes, utilities
└── api/polymarket/
    ├── markets/route.ts           # GET list of markets
    └── markets/[id]/route.ts      # GET single market by slug/conditionId

lib/
├── polymarket/
│   ├── types.ts                   # TrackFunMarket, GammaMarket types
│   ├── client.ts                  # fetchMarkets, fetchMarketById, normalizer
│   └── index.ts
└── privy/
    ├── Provider.tsx               # TrackFunPrivyProvider (wraps PrivyProvider)
    ├── useAuth.ts                 # useAuth() hook with graceful fallback
    ├── server.ts                  # getPrivyServerClient, verifyPrivyToken
    └── index.ts

components/
├── TrackFun.tsx                   # Main UI (feed, leaderboard, profiles, etc.)
├── seeds.ts                       # Fallback market data + bot archetypes
└── useMarkets.ts                  # Hook that polls /api/polymarket/markets
```

### Data flow

1. **Client** renders `<TrackFun />`, which calls `useMarkets()`.
2. **`useMarkets`** hits `/api/polymarket/markets` (our API route) and polls
   every `NEXT_PUBLIC_POLYMARKET_REFRESH_MS` ms (default 30s).
3. **API route** (`app/api/polymarket/markets/route.ts`) calls
   `fetchMarkets()` from `lib/polymarket/client.ts`, which fetches from
   `https://gamma-api.polymarket.com/markets` and normalizes the response
   into `TrackFunMarket` shape.
4. **Fallback**: if the API call fails, `useMarkets` keeps the seed data from
   `components/seeds.ts` visible so the UI never looks empty, and shows a
   `<DataStatusBanner>` at the top of the page.

### Bot simulation is separate from Polymarket

Bots are entirely simulated. They read Polymarket prices but trade against
those prices in-memory only. **No orders are ever placed on Polymarket.**
The integration is strictly read-only.

---

## 5. Where to paste credentials — quick reference

| Variable | Where | Example |
|---|---|---|
| `NEXT_PUBLIC_PRIVY_APP_ID` | `.env.local` | `cluv1abcd1234xyz` |
| `NEXT_PUBLIC_PRIVY_CLIENT_ID` | `.env.local` (optional) | `client-WY...` |
| `PRIVY_APP_SECRET` | `.env.local` (server-only) | `sk_...` |

After pasting, restart the dev server (`Ctrl+C` then `npm run dev` again) —
Next.js picks up env changes only on boot.

---

## 6. Deploying

Any platform that supports Next.js 14 (Vercel, Railway, Fly, self-hosted)
works. **Make sure to configure the same env vars in your deployment
environment.** Never commit `.env.local`.

For Vercel specifically:
```bash
vercel env add NEXT_PUBLIC_PRIVY_APP_ID
vercel env add NEXT_PUBLIC_PRIVY_CLIENT_ID
vercel env add PRIVY_APP_SECRET
```

---

## 7. Protecting API routes with Privy

If you add routes that should only be callable by logged-in users, use
`verifyPrivyToken` from `lib/privy/server.ts`:

```ts
// app/api/bots/create/route.ts
import { verifyPrivyToken } from "@/lib/privy/server";

export async function POST(req: Request) {
  const claims = await verifyPrivyToken(req);
  if (!claims) return new Response("Unauthorized", { status: 401 });

  // claims.userId is the Privy DID — use it as your user reference.
  // ...
}
```

On the client, get the token from `usePrivy().getAccessToken()` and pass it
as `Authorization: Bearer <token>`.

---

## 8. Known limits

- The bot-trading engine is entirely simulated. Wiring it to a Postgres
  database is the next logical step.
- The Polymarket integration only supports binary (YES/NO) markets today.
- The `POST` / write side of Polymarket's CLOB API is intentionally
  **not** implemented.

---

## 9. Simulated execution & spread revenue

Bots trade against the **reference prices** shown in the UI (pulled from
Polymarket) but their **actual fills** include a house spread. This is
invisible to end users and exists entirely on the server.

### Where it lives

```
lib/execution/
├── types.ts           # Trade, Position, ExecutionInput, ExecutionResult
├── pricing.ts         # calculateSpreadAdjustedPrice, getExecutionPrice, clampPrice
├── engine.ts          # recordExecution, markToMarket, realizedPnl
├── ledger.ts          # in-memory revenue accounting
├── execution.test.ts  # 26 unit tests — run `npm run test:execution`
└── index.ts           # barrel

app/api/admin/spread-revenue/route.ts   # auth-gated revenue endpoint
```

### How it works

Every fill flows through `recordExecution()`:

```ts
import { recordExecution } from "@/lib/execution";

const { trade, result } = recordExecution({
  yesReferencePrice: market.yesPrice, // from Polymarket
  side: "BUY",                         // or "SELL"
  outcome: "YES",                      // or "NO"
  size: 100,                           // virtual USD
  botId: bot.id,
  marketId: market.id,
});

// trade.executionPrice  — what the bot actually filled at
// trade.referencePrice  — what the UI shows (unchanged)
// trade.spreadAmount    — cents captured per unit
// result.spreadRevenue  — total house revenue on this fill
```

The spread is applied directionally:
- **BUY** → fill at `referencePrice + spread` (bot pays more)
- **SELL** → fill at `referencePrice - spread` (bot receives less)

Fills clamp to `[0.01, 0.99]` so bots never pay more than the max
payout of a binary token.

### Tuning

One env var:

```dotenv
SIM_SPREAD_CENTS=0.01   # default: 1 cent per side (~2c round-trip)
```

Valid range: `0` to `0.1`. The module hard-caps at 0.1 regardless of
what's set — a 10-cent spread is already well past the point where the
UX starts to feel broken. The env var is read at execution time, not at
boot, so you can tune by editing `.env.local` and restarting the server.

### Bot PnL

PnL calculations use **execution prices**, never reference prices.
The spread round-trip loss is automatically baked in — if a bot buys
and immediately sells at the same reference price, it eats `2 *
spreadCents * size` in losses, which is exactly the house revenue.

```ts
import { markToMarket, realizedPnl } from "@/lib/execution";

// Open position: mark-to-market against current reference
const unrealized = markToMarket(entryExecPrice, currentYesRef, outcome, size);

// Closed position: realized PnL is exit - entry, both executions
const pnl = realizedPnl(entryExec, exitExec, size);
```

### Revenue tracking

In-memory ledger with aggregates by bot, by market, and globally:

```ts
import {
  getGlobalSpreadRevenue,
  getSpreadRevenueByBot,
  getSpreadRevenueByMarket,
  getSpreadRevenueSummary,
} from "@/lib/execution";
```

Admin endpoint for the admin panel:

```
GET /api/admin/spread-revenue
```

Returns `{ global, byBot, byMarket, recent[] }`. Protected by Privy
token when Privy is configured; open in dev mode.

**Production TODO:** replace the in-memory `Map` in `ledger.ts` with a
Postgres table. The public interface (`recordSpreadRevenue`,
`getGlobalSpreadRevenue`, etc.) won't change — only the storage impl.

### Full client-to-ledger wiring

```
  TrackFun.tsx simulation tick
         │
         │  picks a "trade" event
         ▼
  components/executeFill.ts
         │  POST /api/bots/execute
         ▼
  app/api/bots/execute/route.ts
         │
         ▼
  lib/execution/engine.ts::recordExecution()
         │
         ├─→ lib/execution/pricing.ts::getExecutionPrice()
         │     applies SIM_SPREAD_CENTS, clamps to [0.01, 0.99]
         │
         └─→ lib/execution/ledger.ts::recordSpreadRevenue()
               updates global / byBot / byMarket totals
```

The client never sees the execution price — it only gets back a `Trade`
record with both `referencePrice` and `executionPrice`, and the UI
continues to display only the reference. If the network drops, the
client-side fallback in `executeFill.ts` synthesizes a trade with no
spread applied so the UI stays responsive (the ledger simply doesn't
record those fills).

### Verifying it works

```bash
npm run test:execution              # 26 unit tests
npm run test:execution:integration  # 500-fill integration test
```

Both pass. The integration test verifies that 500 simulated tick-fills
produce exactly the expected revenue, and that a bot's round-trip loss
equals the house's take to the penny.

### What is NOT changed in the UI

- Market prices in the ticker, market cards, and market detail page are
  the **raw Polymarket reference prices** — unchanged.
- Feed trade events display the reference price, not the execution price.
- No "fee" / "spread" / "cost" copy appears anywhere in the public UI.

Execution prices exist only in:
- The `Trade` records returned from `recordExecution()`
- The admin panel (`/api/admin/spread-revenue`)
- Server logs if you add them


---

## 10. Launch checklist

Before shipping to real users:

### Config
- [ ] Paste real `NEXT_PUBLIC_PRIVY_APP_ID` into `.env.local`
- [ ] Paste real `PRIVY_APP_SECRET` into `.env.local` (server-only, never commit)
- [ ] Enable email + Google login in Privy Dashboard
- [ ] Enable embedded wallets in Privy Dashboard
- [ ] (Optional) Tune `SIM_SPREAD_CENTS` — default 0.01 is fine to launch
- [ ] (Optional) Override `POLYMARKET_GAMMA_URL` if needed

### Smoke tests
- [ ] `npm run dev` boots without errors
- [ ] `npm run build` completes successfully
- [ ] `npm run test:execution` — 26/26 pass
- [ ] `npm run test:execution:integration` — passes
- [ ] `curl http://localhost:3000/api/polymarket/markets?limit=5` returns real Polymarket data
- [ ] Log in with email → OTP works → embedded wallet is created
- [ ] Log in with Google → embedded wallet is created
- [ ] Top-right user menu shows display name + wallet + logout
- [ ] Onboarding modal appears on first load, dismisses on "Launch My First Bot"
- [ ] Bot creation: 20-second flow, bot appears at top of feed, notification fires
- [ ] Click "🔥 Back This Bot" anywhere → BackModal opens with amount picker
- [ ] Confirm backing → toast appears, notification fires, "Me" page shows the bot
- [ ] Leaderboard filters (24h/7d/30d/All) change pnl display
- [ ] Leaderboard sort by "Backed $" ranks by platform backing
- [ ] Notification bell shows unread count, opens dropdown, marks read on open

### Production deployment
- [ ] Deploy to Vercel (or equivalent Next.js host)
- [ ] Configure env vars in deployment environment (not in code)
- [ ] Verify `/api/admin/spread-revenue` is auth-gated in production
- [ ] Set up monitoring for `/api/polymarket/markets` error rate
- [ ] Plan Postgres migration path for: bots, backings, notifications, spread ledger

### Known limits (document for team)
- User bots + backings reset on browser refresh (in-memory)
- Spread revenue ledger resets on server restart (in-memory)
- Polymarket integration is read-only — no order placement
- Only binary YES/NO markets supported
- Mobile responsive at lg breakpoint (1024px+); tighter screens are usable but not perfect

### Nice-to-haves for v0.5
- [ ] Persist bots + backings in Postgres
- [ ] Real-time updates via SSE/WebSocket instead of polling
- [ ] Arena entry flow (currently the Arenas tab is display-only)
- [ ] Bot profile "Clone & Run" action (currently a placeholder button)
- [ ] Categorical markets (non-binary) support
- [ ] Full mobile pass below 768px

