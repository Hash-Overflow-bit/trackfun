"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  TrendingUp, TrendingDown, Zap, Trophy, Users, Activity, Plus, Search,
  Flame, Crown, Target, Sparkles, ArrowUp, ArrowDown, Play, Pause,
  ChevronRight, Settings, Bell, Eye, GitBranch, Award, Radio, BarChart3,
  Bot, Skull, Rocket, Brain, DollarSign, Hash, Clock, X, Check,
  Shield, Swords, Filter, ArrowUpRight, Copy, Star, CircleDot,
  LogIn, LogOut, Loader2, AlertCircle, Wallet, Mail, ArrowLeft, CheckCircle2,
  User as UserIcon, Circle
} from "lucide-react";
import { useAuth } from "@/lib/privy";
import { useMarkets } from "./useMarkets";
import { executeFill } from "./executeFill";
import { BOT_ARCHETYPES, REASONING_TEMPLATES, TOURNAMENTS_SEED } from "./seeds";
import { AppStateProvider, useAppState } from "./AppStateContext";
import { TrackFunLogoHorizontal, TrackFunLogo } from "./TrackFunLogo";
import { useBots, useFeed, useActions, useBalance } from "./api";
import { InvestModal, DepositModal } from "./InvestModal";
import {
  BackModal, NotificationCenter, ToastStack, Onboarding,
  BotMilestones, BotStatusBadge, BackedCapital
} from "./SocialComponents";
import { UserAccountView } from "./UserAccountView";


// ============================================================
// UTILITIES
// ============================================================
const fmt = (n) => {
  const val = Number(n || 0);
  if (Math.abs(val) >= 1e6) return (val / 1e6).toFixed(2) + "M";
  if (Math.abs(val) >= 1e3) return (val / 1e3).toFixed(1) + "k";
  return val.toFixed(0);
};
const fmtPct = (n) => {
  const val = Number(n || 0);
  return (val >= 0 ? "+" : "") + (val * 100).toFixed(1) + "%";
};
const fmtPrice = (n) => {
  const val = Number(n || 0);
  return (val * 100).toFixed(0) + "¢";
};
const rid = () => Math.random().toString(36).slice(2, 10);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randBetween = (a, b) => a + Math.random() * (b - a);

const timeAgo = (t) => {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return s + "s";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  return Math.floor(s / 86400) + "d";
};

// Deterministic avatar gradient from seed
const gradFromSeed = (seed) => {
  const s = String(seed || "default");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  const h2 = (h + 60) % 360;
  return `linear-gradient(135deg, hsl(${h}, 85%, 55%), hsl(${h2}, 90%, 50%))`;
};

// Build an initial bot
const makeBot = (archetype, owner = "system") => {
  const perf = archetype.risk >= 4 ? randBetween(-0.35, 1.8) : randBetween(-0.15, 0.9);
  const winRate = Math.max(0.3, Math.min(0.85, 0.5 + (perf * 0.15) + randBetween(-0.1, 0.1)));
  const trades = Math.floor(randBetween(20, 340));
  return {
    id: rid(),
    name: archetype.name,
    emoji: archetype.emoji,
    bio: archetype.bio,
    strategy: archetype.strategy,
    strategyText: getStrategyDescription(archetype.strategy),
    risk: archetype.risk,
    owner,
    bankroll: 10000 * (1 + perf),
    startBankroll: 10000,
    pnl: perf,
    winRate,
    trades,
    streak: Math.floor(randBetween(-4, 12)),
    followers: Math.floor(randBetween(0, 4200) * Math.max(0.1, perf + 0.5)),
    createdAt: Date.now() - Math.floor(randBetween(1, 40)) * 86400000,
    level: Math.floor(randBetween(1, 24)),
    xp: Math.floor(randBetween(0, 100)),
    badges: generateBadges(perf, winRate, trades),
    positions: [],
    tradeLog: [],
    reasoningFeed: [],
    perfHistory: generatePerfHistory(perf),
    active: true,
  };
};

const getStrategyDescription = (s) => {
  const map = {
    "macro-fade": "Trades macroeconomic events against crowd positioning",
    "yolo": "Maximum conviction, minimum diversification, pure aggression",
    "underdog": "Systematically bets on low-probability outcomes",
    "trend": "Follows momentum until reversal signals trigger",
    "news": "Reacts to breaking news and sentiment shifts",
    "arbitrage": "Exploits mispricings across correlated markets",
    "contrarian": "Fades consensus when crowd confidence exceeds threshold",
    "value": "Enters only when perceived fair value differs significantly",
    "quant": "Statistical models drive every decision",
    "copy": "Mirrors positions of top-ranked bots",
    "random": "Pure stochastic entry. Control group for the arena.",
    "night": "Only active during overnight low-liquidity windows",
    "conservative": "Small position sizes, high-probability setups only",
  };
  return map[s] || "Custom strategy logic";
};

const generateBadges = (perf, wr, trades) => {
  const b = [];
  if (perf > 1) b.push({ icon: "🚀", label: "100% Returns" });
  if (perf > 0.5) b.push({ icon: "💎", label: "Diamond Hands" });
  if (wr > 0.7) b.push({ icon: "🎯", label: "Sharp Shooter" });
  if (trades > 200) b.push({ icon: "⚡", label: "High Volume" });
  if (perf < -0.2) b.push({ icon: "🔥", label: "On Fire (literally)" });
  if (wr > 0.6 && trades > 100) b.push({ icon: "🧠", label: "Galaxy Brain" });
  return b;
};

const generatePerfHistory = (finalPnl) => {
  const points = 30;
  const arr = [];
  let val = 0;
  for (let i = 0; i < points; i++) {
    const target = (finalPnl * i) / (points - 1);
    val = target + (Math.random() - 0.5) * 0.2;
    arr.push(val);
  }
  arr[arr.length - 1] = finalPnl;
  return arr;
};

// ============================================================
// MAIN APP
// ============================================================
export function TrackFun() {
  return <TrackFunWithData />;
}

function TrackFunWithData() {
  // Live bots from DB
  const { bots: apiBots, loading: botsLoading, refetch: refetchBots } = useBots("pnl", 150);
  // Live feed from DB
  const { events: apiFeed } = useFeed("all", 60);

  return (
    <AppStateProvider bots={apiBots}>
      <TrackFunInner apiBots={apiBots} apiFeed={apiFeed} botsLoading={botsLoading} refetchBots={refetchBots} />
    </AppStateProvider>
  );
}

function TrackFunInner({ apiBots, apiFeed, botsLoading, refetchBots }: any) {
  const [view, setView] = useState("feed");
  const [selectedBot, setSelectedBot] = useState(null);
  const [selectedMarket, setSelectedMarket] = useState(null);
  const { pushToast, refetchAll, isAdmin } = useAppState();
  const { createBot: createBotApi } = useActions();

  // Live market data from Polymarket (with seed fallback)
  const {
    markets: liveMarkets,
    loading: marketsLoading,
    error: marketsError,
    usingFallback: marketsUsingFallback,
  } = useMarkets({ limit: 30, orderBy: "volume" });

  const [markets, setMarkets] = useState(liveMarkets);
  useEffect(() => { setMarkets(liveMarkets); }, [liveMarkets]);

  const mapBot = useCallback((b: any) => ({
    ...b,
    createdAt: b.createdAt,
    badges: b.badges ?? [],
    perfHistory: b.perfHistory ?? Array.from({ length: 30 }, (_, i) => (b.pnl ?? 0) * (i + 1) / 30 + (Math.random() - 0.5) * 0.05),
  }), []);

  // Bots come from API now. Map them into the shape the existing UI expects.
  const bots = useMemo(() => (apiBots ?? []).map(mapBot), [apiBots, mapBot]);

  // Feed events come from API. Map into activity items the UI expects.
  const activity = useMemo(() => (apiFeed ?? []).map((e: any) => ({
    id: e.id,
    type: e.type,
    botId: e.botId,
    botName: e.botName,
    botEmoji: e.botEmoji,
    botStrategy: e.botStrategy,
    marketTitle: e.marketTitle,
    marketCategory: null,
    side: e.side,
    price: e.price,
    size: e.size,
    pnl: e.pnl,
    pnlImpact: e.pnlImpact,
    confidence: e.confidence,
    drama: e.drama,
    timestamp: e.timestamp,
  })), [apiFeed]);

  const setBots = useCallback((_fn: any) => { /* no-op — server is source of truth */ refetchBots(); }, [refetchBots]);
  const setActivity = useCallback((_fn: any) => { /* no-op */ }, []);

  const [tournaments] = useState(TOURNAMENTS_SEED);
  const [following, setFollowing] = useState(new Set());
  const [liveMode, setLiveMode] = useState(true);
  const [backModalBot, setBackModalBot] = useState<any | null>(null);
  const [investModalBot, setInvestModalBot] = useState<any | null>(null);
  const [depositOpen, setDepositOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  // Generate initial activity stream
  function generateInitialActivity() {
    const items = [];
    const now = Date.now();
    const archs = BOT_ARCHETYPES;
    // Seed a dense stream - 90 events
    for (let i = 0; i < 90; i++) {
      const bot = pick(archs);
      const mkt = pick(liveMarkets.length > 0 ? liveMarkets : [{ title: "Market loading...", category: "General" }]);
      const roll = Math.random();
      const type = roll < 0.55 ? "trade"
                  : roll < 0.70 ? "milestone"
                  : roll < 0.80 ? "promotion"
                  : roll < 0.90 ? "launch"
                  : "follow";
      // Tighter timestamps early (last few minutes), widening out
      const offset = Math.pow(i, 1.6) * 800 + Math.random() * 15000;
      const t = now - offset;
      items.push(makeActivityItem(type, bot, mkt, t));
    }
    return items.sort((a, b) => b.timestamp - a.timestamp);
  }

  function makeActivityItem(type, bot, mkt, timestamp = Date.now()) {
    const side = Math.random() > 0.5 ? "YES" : "NO";
    const price = Math.floor(randBetween(20, 85));
    const size = Math.floor(randBetween(50, 2400));
    const pnlImpact = randBetween(-0.35, 0.45);
    const confidence = pick(["HIGH", "HIGH", "MED", "MED", "LOW", "MAX"]);
    // Drama indicator emoji
    let drama = null;
    if (pnlImpact > 0.25) drama = "🔥";
    else if (pnlImpact > 0.12) drama = "🧠";
    else if (pnlImpact < -0.18) drama = "⚠️";
    else if (size > 1800) drama = "💰";
    else if (confidence === "MAX") drama = "⚡";
    return {
      id: rid(),
      type,
      botId: bot.id,
      botName: bot.name,
      botEmoji: bot.emoji,
      botStrategy: bot.strategy,
      marketTitle: mkt?.title,
      marketCategory: mkt?.category,
      side,
      price,
      size,
      pnl: randBetween(-0.3, 1.5),
      pnlImpact,
      confidence,
      drama,
      timestamp,
    };
  }

  // Client-side tick: only drifts the DISPLAYED market prices slightly
  // for a "alive" feel between server refreshes. All bot/feed state
  // comes from the server now.
  useEffect(() => {
    if (!liveMode) return;
    const interval = setInterval(() => {
      setMarkets(ms => ms.map(m => {
        const drift = (Math.random() - 0.5) * 0.008;
        const newPrice = Math.max(0.02, Math.min(0.98, m.yesPrice + drift));
        return { ...m, yesPrice: newPrice };
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, [liveMode]);

  const openBot = (bot) => {
    setSelectedBot(bot);
    setView("profile");
  };

  const toggleFollow = (botId) => {
    setFollowing(f => {
      const n = new Set(f);
      if (n.has(botId)) n.delete(botId); else n.add(botId);
      return n;
    });
    setBots(bs => bs.map(b => b.id === botId ? { ...b, followers: b.followers + (following.has(botId) ? -1 : 1) } : b));
  };

  const createBot = async (data: any) => {
    try {
      const res = await createBotApi({
        name: data.name,
        emoji: data.emoji || "🤖",
        bio: data.bio || "A fresh contender in the arena.",
        strategy: data.strategy || "custom",
        risk: data.risk ?? 0.5,
        strategyText: data.strategyPrompt || "",
      });
      pushToast({
        kind: "bot_launched" as any,
        title: `${res.bot.name} is live`,
        body: "Your bot entered the arena",
        botEmoji: res.bot.emoji,
      });
      refetchBots();
      refetchAll();
      return res.bot;
    } catch (err: any) {
      pushToast({
        kind: "big_loss" as any,
        title: "Couldn't create bot",
        body: err?.message ?? "Try again",
      });
      throw err;
    }
  };

  return (
    <div className="min-h-screen text-zinc-100 font-body overflow-x-hidden">
      <TopBar
        view={view}
        setView={setView}
        notifOpen={notifOpen}
        setNotifOpen={setNotifOpen}
        liveMode={liveMode}
        setLiveMode={setLiveMode}
        onOpenDeposit={() => setDepositOpen(true)}
      />

      {/* Live-data banner: shown when API fails and we're on fallback */}
      {marketsUsingFallback && !marketsLoading && (
        <DataStatusBanner error={marketsError} />
      )}

      <TickerBar markets={markets} />

      <main className="max-w-[1600px] mx-auto px-6 py-6">
        {view === "feed" && <FeedView activity={activity} bots={bots} markets={markets} onOpenBot={openBot} onCreateBot={() => setView("create")} toggleFollow={toggleFollow} following={following} setView={setView} onOpenBack={setBackModalBot} />}
        {view === "markets" && <MarketsView markets={markets} bots={bots} onSelectMarket={setSelectedMarket} selectedMarket={selectedMarket} />}
        {view === "leaderboard" && <LeaderboardView bots={bots} onOpenBot={openBot} following={following} toggleFollow={toggleFollow} onOpenBack={setBackModalBot} />}
        {view === "tournaments" && <TournamentsView tournaments={tournaments} bots={bots} onOpenBot={openBot} />}
        {view === "profile" && selectedBot && <BotProfileView bot={bots.find((b:any)=>b.id===selectedBot.id) ?? mapBot(selectedBot)} bots={bots} onBack={() => setView("feed")} toggleFollow={toggleFollow} following={following} activity={activity} markets={markets} onOpenBack={setBackModalBot} onOpenInvest={setInvestModalBot} />}
        {view === "create" && <CreateBotView onCreate={createBot} onDone={(bot) => { setSelectedBot(bot); setView("profile"); }} onCancel={() => setView("feed")} />}
        {view === "me" && <MeView bots={bots} onOpenBot={openBot} onCreateBot={() => setView("create")} onOpenBack={setBackModalBot} setView={setView} />}
        {view === "admin" && isAdmin && <AdminView bots={bots} markets={markets} setBots={setBots} setMarkets={setMarkets} />}
      </main>

      {/* Global overlays */}
      <BackModalWithAuth bot={backModalBot} onClose={() => setBackModalBot(null)} />
      <InvestModalWithAuth bot={investModalBot} onClose={() => setInvestModalBot(null)} onDeposit={() => setDepositOpen(true)} />
      <DepositModal open={depositOpen} onClose={() => setDepositOpen(false)} />
      <Onboarding onLaunchBot={() => setView("create")} />
      <ToastStack />

      {/* Notification center mounted next to bell */}
      {notifOpen && (
        <div className="fixed top-14 right-4 lg:right-6 z-50">
          <NotificationCenter
            open={notifOpen}
            onClose={() => setNotifOpen(false)}
            onOpenBot={(name: string) => {
              const b = bots.find((x: any) => x.name === name);
              if (b) openBot(b);
              setNotifOpen(false);
            }}
          />
        </div>
      )}

      <footer className="border-t border-zinc-800/60 mt-16 py-8 text-center text-xs text-zinc-500 font-mono">
        <span className="text-lime-400/60">Track<span className="text-lime-400">.</span>fun</span> · fantasy prediction markets · zero real money · v0.4.0 ·
        <span className="text-zinc-600"> built for virality, not vice</span>
      </footer>
    </div>
  );
}

// ============================================================
// ME VIEW — thin wrapper that injects auth state into UserAccountView
// ============================================================
// Auth-aware wrapper around BackModal
function BackModalWithAuth({ bot, onClose }: { bot: any; onClose: () => void }) {
  const auth = useAuth();
  return (
    <BackModal
      bot={bot}
      onClose={onClose}
      authed={auth.authenticated}
      onLogin={auth.login}
    />
  );
}

// Auth-aware wrapper around InvestModal
function InvestModalWithAuth({ bot, onClose, onDeposit }: { bot: any; onClose: () => void; onDeposit: () => void }) {
  const auth = useAuth();
  return (
    <InvestModal
      bot={bot}
      authed={auth.authenticated}
      onLogin={auth.login}
      onClose={onClose}
      onDepositClick={onDeposit}
    />
  );
}

function MeView({ bots, onOpenBot, onCreateBot, onOpenBack, setView }: any) {
  const auth = useAuth();
  return (
    <UserAccountView
      bots={bots}
      authed={auth.authenticated}
      displayName={auth.displayName}
      walletAddr={auth.user?.wallet?.address}
      email={auth.user?.email?.address || auth.user?.google?.email}
      onLogin={auth.login}
      onOpenBot={onOpenBot}
      onCreateBot={onCreateBot}
      onOpenBack={onOpenBack}
    />
  );
}

// ============================================================
// TOP BAR
// ============================================================
function TopBar({ view, setView, notifOpen, setNotifOpen, liveMode, setLiveMode, onOpenDeposit }: any) {
  const navItems = [
    { key: "feed", label: "Feed", icon: Activity },
    { key: "markets", label: "Markets", icon: BarChart3 },
    { key: "leaderboard", label: "Leaderboard", icon: Trophy },
    { key: "tournaments", label: "Arenas", icon: Swords },
    { key: "me", label: "Me", icon: UserIcon },
    { key: "admin", label: "Admin", icon: Settings, adminOnly: true },
  ];
  const { isAdmin } = useAppState();
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-black/60 border-b border-zinc-800/60">
      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 h-16 flex items-center gap-3 lg:gap-5">
        <button onClick={() => setView("feed")} className="flex items-center shrink-0 group">
          <TrackFunLogoHorizontal height={28} className="group-hover:opacity-80 transition-opacity" />
        </button>

        <nav className="flex items-center gap-1 shrink-0">
          {navItems.filter(item => !item.adminOnly || isAdmin).map(item => {
            const Icon = item.icon;
            const active = view === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                className={`px-2.5 lg:px-3.5 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-all whitespace-nowrap ${
                  active ? "bg-lime-400/10 text-lime-300 ring-1 ring-lime-400/30" : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden md:inline">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex-1 min-w-0 max-w-md mx-auto hidden lg:block">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input placeholder="search bots, markets, tags..."
              className="w-full bg-zinc-900/60 border border-zinc-800 rounded-md pl-9 pr-3 py-1.5 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-lime-400/40 font-mono" />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <button
            onClick={() => setLiveMode(!liveMode)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-mono font-medium whitespace-nowrap ${
              liveMode ? "bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/30" : "bg-zinc-800 text-zinc-400"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${liveMode ? "bg-rose-400 animate-pulse-dot" : "bg-zinc-500"}`}></span>
            {liveMode ? "LIVE" : "PAUSED"}
          </button>
          <NotificationBellButton notifOpen={notifOpen} setNotifOpen={setNotifOpen} />
          <DepositButton onOpen={onOpenDeposit} />
          <button onClick={() => setView("create")} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-lime-400 hover:bg-lime-300 text-black text-sm font-semibold shadow-lg shadow-lime-500/20 transition-all hover:scale-[1.02] shrink-0 whitespace-nowrap">
            <Plus className="w-3.5 h-3.5 shrink-0" strokeWidth={3} />
            New Bot
          </button>
          <AuthButton />
        </div>
      </div>
    </header>
  );
}

function DepositButton({ onOpen }: { onOpen: () => void }) {
  const auth = useAuth();
  const { balance } = useBalance();
  if (!auth.authenticated) return null;
  const available = balance?.available ?? 0;
  return (
    <button
      onClick={onOpen}
      className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-mono font-bold shrink-0 transition-colors group"
      title="Deposit USDC"
    >
      <ArrowDown className="w-3.5 h-3.5 text-lime-400 group-hover:animate-bounce" strokeWidth={3} />
      <span className="text-zinc-300">Deposit</span>
      <span className="text-zinc-500">·</span>
      <span className="text-lime-300">${available.toFixed(0)}</span>
    </button>
  );
}

function NotificationBellButton({ notifOpen, setNotifOpen }: any) {
  const { unreadCount } = useAppState();
  return (
    <div className="relative">
      <button
        data-notif-trigger
        onClick={() => setNotifOpen(!notifOpen)}
        className={`relative p-1.5 transition-colors shrink-0 ${notifOpen ? "text-lime-400" : "text-zinc-400 hover:text-zinc-100"}`}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-[9px] font-bold flex items-center justify-center text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}

// ============================================================
// AUTH BUTTON — login/logout control in top bar
// ============================================================
function AuthButton() {
  const { ready, authenticated, displayName, login, logout, configured, user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = () => setMenuOpen(false);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [menuOpen]);

  if (!configured) {
    return (
      <div className="relative shrink-0" title="Privy not configured. Set NEXT_PUBLIC_PRIVY_APP_ID in .env.local.">
        <button
          disabled
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-800/80 text-zinc-500 text-xs font-mono font-semibold cursor-not-allowed"
        >
          <AlertCircle className="w-3.5 h-3.5" />
          Auth not configured
        </button>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-900 text-zinc-500 text-xs font-mono shrink-0">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span className="hidden sm:inline">Loading</span>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <button
        onClick={login}
        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm font-semibold transition-colors shrink-0 whitespace-nowrap"
      >
        <LogIn className="w-3.5 h-3.5" />
        Log in
      </button>
    );
  }

  // Authenticated — show user pill + menu
  const walletAddr = user?.wallet?.address;

  return (
    <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors"
      >
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-xs font-bold text-white">
          {displayName.slice(0, 1).toUpperCase()}
        </div>
        <span className="text-xs font-mono text-zinc-200 hidden sm:inline max-w-[120px] truncate">{displayName}</span>
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-lg bg-zinc-900 border border-zinc-800 shadow-2xl shadow-black/50 overflow-hidden z-50 animate-slide-in">
          <div className="p-3 border-b border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-sm font-bold text-white">
                {displayName.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-zinc-100 truncate">{displayName}</div>
                <div className="text-[10px] font-mono text-zinc-500 truncate">
                  {user?.email?.address || user?.google?.email || "Privy account"}
                </div>
              </div>
            </div>
          </div>
          {walletAddr && (
            <div className="p-3 border-b border-zinc-800">
              <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-500 mb-1">Embedded Wallet</div>
              <div className="text-[11px] font-mono text-zinc-300 break-all">{walletAddr}</div>
            </div>
          )}
          <button
            onClick={async () => { setMenuOpen(false); await logout(); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-rose-300 hover:bg-rose-500/10 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// DATA STATUS BANNER — shown when Polymarket API fails
// ============================================================
function DataStatusBanner({ error }: any) {
  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10">
      <div className="max-w-[1600px] mx-auto px-6 py-2 flex items-center gap-2 text-xs">
        <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="text-amber-300 font-mono">
          {error ? "Polymarket API unavailable. Showing seed data." : "Loading live market data..."}
        </span>
        {error && (
          <span className="text-amber-500/70 font-mono text-[10px] ml-auto truncate">{error}</span>
        )}
      </div>
    </div>
  );
}
// END_AUTH_BUTTON_BLOCK

// ============================================================
// TICKER BAR - scrolling price tape
// ============================================================
function TickerBar({ markets }: any) {
  const items = [...markets, ...markets];
  return (
    <div className="border-b border-zinc-800/60 bg-zinc-950/50 overflow-hidden">
      <div className="flex items-center py-2 font-mono text-xs whitespace-nowrap" style={{ animation: "ticker 80s linear infinite" }}>
        {items.map((m, i) => {
          const up = m.change24h >= 0;
          return (
            <div key={i} className="flex items-center gap-2 px-6 shrink-0">
              <span className="text-zinc-500">{m.category.toUpperCase()}</span>
              <span className="text-zinc-300 truncate max-w-[220px]">{m.title}</span>
              <span className="text-zinc-100 font-semibold">{fmtPrice(m.yesPrice)}</span>
              <span className={`flex items-center gap-0.5 ${up ? "text-lime-400" : "text-rose-400"}`}>
                {up ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                {Math.abs(m.change24h * 100).toFixed(1)}%
              </span>
              <span className="text-zinc-600">|</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// FEED VIEW — the pump.fun-style core
// ============================================================
function FeedView({ activity, bots, markets, onOpenBot, onCreateBot, toggleFollow, following, setView, onOpenBack }: any) {
  const topBots = [...bots].sort((a, b) => b.pnl - a.pnl).slice(0, 5);
  const trendingMarkets = [...markets].sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h)).slice(0, 3);
  // "Trending bots": high followers + positive pnl
  const trendingBots = useMemo(() => {
    return [...bots]
      .map(b => ({ ...b, trendScore: b.followers * (1 + b.pnl * 2) + (b.streak > 0 ? b.streak * 50 : 0) }))
      .sort((a, b) => b.trendScore - a.trendScore)
      .slice(0, 6);
  }, [bots]);
  const [filter, setFilter] = useState("all"); // all | trades | launches | wins

  const filteredActivity = useMemo(() => {
    if (filter === "all") return activity;
    const map = { trades: "trade", launches: "launch", wins: "milestone", promotions: "promotion" };
    return activity.filter(a => a.type === map[filter]);
  }, [activity, filter]);

  return (
    <div className="grid grid-cols-12 gap-5">
      {/* LEFT: Feed (dominant 65%) */}
      <section className="col-span-8">
        {/* Live counters bar */}
        <LiveCountersBar bots={bots} activity={activity} />

        {/* Aggressive CTA */}
        <AggressiveCTA onCreateBot={onCreateBot} botCount={bots.length} />

        {/* Feed header */}
        <div className="flex items-center justify-between mb-3 mt-5">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-2xl">Live <span className="text-lime-400">Feed</span></h2>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse-dot"></span>
              <span className="text-[10px] font-mono font-bold text-rose-300 tracking-widest">STREAMING</span>
            </div>
          </div>
          <div className="flex gap-1">
            {[
              { k: "all", l: "All" },
              { k: "trades", l: "Trades" },
              { k: "wins", l: "Wins" },
              { k: "promotions", l: "Promotions" },
              { k: "launches", l: "Launches" },
            ].map(f => (
              <button key={f.k} onClick={() => setFilter(f.k)}
                className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold transition-all ${
                  filter === f.k ? "bg-lime-400 text-black" : "bg-zinc-900/60 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                }`}>
                {f.l}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 max-h-[calc(100vh-100px)] overflow-y-auto scrollbar-thin pr-2">
          {filteredActivity.slice(0, 60).map((a) => <ActivityRow key={a.id} a={a} onOpenBot={(name) => {
            const bot = bots.find(b => b.name === name);
            if (bot) onOpenBot(bot);
          }} onBack={(botId) => {
            const bot = bots.find(b => b.id === botId);
            if (bot) onOpenBack(bot);
          }} isFollowing={following.has(a.botId)} />)}
        </div>
      </section>

      {/* RIGHT: Slim rail (35%) */}
      <aside className="col-span-4 space-y-4">
        <TrendingBotsPanel bots={trendingBots} onOpenBot={onOpenBot} toggleFollow={toggleFollow} following={following} onOpenBack={onOpenBack} />

        <RailCard title="Top Movers" icon={Flame} accent="rose">
          <div className="space-y-1.5">
            {topBots.map((b, i) => (
              <button key={b.id} onClick={() => onOpenBot(b)} className="w-full flex items-center gap-2 px-1.5 py-1 rounded hover:bg-zinc-800/50 transition-colors group">
                <div className="w-5 text-center font-mono text-[10px] text-zinc-500 font-bold">{String(i + 1).padStart(2, "0")}</div>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0" style={{ background: gradFromSeed(b.id) }}>{b.emoji}</div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-xs font-medium truncate group-hover:text-lime-300">{b.name}</div>
                  <div className="text-[9px] text-zinc-500 font-mono">LVL {b.level} · {b.strategy}</div>
                </div>
                <div className={`text-xs font-mono font-bold ${b.pnl >= 0 ? "text-lime-400" : "text-rose-400"}`}>{fmtPct(b.pnl)}</div>
              </button>
            ))}
          </div>
        </RailCard>

        <RailCard title="Trending Markets" icon={Zap} accent="lime" action={<button onClick={() => setView("markets")} className="text-[10px] text-zinc-500 hover:text-lime-400 font-mono">all →</button>}>
          <div className="space-y-2.5">
            {trendingMarkets.map(m => (
              <div key={m.id} className="space-y-1">
                <div className="text-[11px] text-zinc-400 leading-tight line-clamp-2">{m.title}</div>
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-zinc-500">{m.category}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-100 font-semibold">{fmtPrice(m.yesPrice)}</span>
                    <span className={m.change24h >= 0 ? "text-lime-400" : "text-rose-400"}>{fmtPct(m.change24h)}</span>
                  </div>
                </div>
                <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-lime-500 to-lime-300" style={{ width: `${m.yesPrice * 100}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </RailCard>

        <RailCard title="Arenas Live" icon={Swords} accent="violet" action={<button onClick={() => setView("tournaments")} className="text-[10px] text-zinc-500 hover:text-violet-400 font-mono">all →</button>}>
          <div className="space-y-1.5">
            {TOURNAMENTS_SEED.filter(t => t.status === "live").slice(0, 2).map(t => (
              <div key={t.id} className="p-2 rounded-md bg-zinc-900/70 border border-zinc-800">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[11px] font-semibold truncate">{t.name}</div>
                  <span className="text-[8px] font-mono bg-rose-500/20 text-rose-300 px-1 py-0.5 rounded">LIVE</span>
                </div>
                <div className="flex items-center justify-between text-[9px] font-mono text-zinc-500">
                  <span>{fmt(t.participants)} bots</span>
                  <span>ends {t.endsIn}</span>
                </div>
              </div>
            ))}
          </div>
        </RailCard>
      </aside>
    </div>
  );
}

// ============================================================
// LIVE COUNTERS BAR — animated counts
// ============================================================
function useAnimatedNumber(target, duration = 1200) {
  const [v, setV] = useState(target * 0.4);
  useEffect(() => {
    const start = Date.now();
    const from = v;
    let raf;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setV(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return v;
}

function LiveCountersBar({ bots, activity }: any) {
  // Derive "live" numbers and jitter them to feel alive
  const baseBots = 2341 + bots.length;
  const [botsLive, setBotsLive] = useState(baseBots);
  const [volume, setVolume] = useState(1247392);
  const [trades, setTrades] = useState(14203);

  useEffect(() => {
    const id = setInterval(() => {
      setBotsLive(v => v + (Math.random() < 0.3 ? 1 : 0));
      setVolume(v => v + Math.floor(randBetween(200, 3800)));
      setTrades(v => v + Math.floor(randBetween(1, 6)));
    }, 1100);
    return () => clearInterval(id);
  }, []);

  const animBots = useAnimatedNumber(botsLive, 600);
  const animVol = useAnimatedNumber(volume, 600);
  const animTrades = useAnimatedNumber(trades, 600);

  return (
    <div className="grid grid-cols-3 gap-3 mb-4">
      <CounterTile
        label="Bots Live"
        value={animBots}
        format={(n) => Math.floor(n).toLocaleString()}
        icon={Bot}
        accent="lime"
        pulse
      />
      <CounterTile
        label="Volume Today"
        value={animVol}
        format={(n) => "$" + fmt(n)}
        icon={DollarSign}
        accent="amber"
      />
      <CounterTile
        label="Trades Today"
        value={animTrades}
        format={(n) => Math.floor(n).toLocaleString()}
        icon={Activity}
        accent="violet"
      />
    </div>
  );
}

function CounterTile({ label, value, format, icon: Icon, accent, pulse }: any) {
  const colors = {
    lime: "text-lime-400 border-lime-400/25 from-lime-400/10",
    amber: "text-amber-400 border-amber-400/25 from-amber-400/10",
    violet: "text-violet-400 border-violet-400/25 from-violet-400/10",
  };
  return (
    <div className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${colors[accent]} to-transparent px-4 py-3 flex items-center gap-3`}>
      <div className={`w-9 h-9 rounded-lg bg-black/30 flex items-center justify-center ${colors[accent].split(' ')[0]}`}>
        <Icon className="w-4 h-4" strokeWidth={2.2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-400">{label}</span>
          {pulse && <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse-dot"></span>}
        </div>
        <div className="font-display text-xl font-bold tabular-nums">{format(value)}</div>
      </div>
    </div>
  );
}

// ============================================================
// AGGRESSIVE CTA — big, glowing, urgent
// ============================================================
function AggressiveCTA({ onCreateBot, botCount }: any) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-5 border border-lime-400/40"
      style={{
        background: "radial-gradient(ellipse at right, rgba(190, 255, 0, 0.18) 0%, rgba(10, 14, 20, 0.6) 55%), linear-gradient(135deg, rgba(34, 197, 94, 0.08), rgba(0,0,0,0) 70%)",
      }}>
      <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none"></div>
      <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-lime-400/20 blur-3xl pointer-events-none"></div>
      <div className="relative flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-lime-400/20 text-lime-300 text-[10px] font-mono font-bold mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse-dot"></span>
            {fmt(2000 + botCount)}+ BOTS ALREADY LIVE
          </div>
          <h3 className="font-display text-3xl leading-tight">Launch a bot. <span className="text-lime-400">Compete instantly.</span></h3>
          <p className="text-xs text-zinc-400 mt-1.5 leading-snug">Name it, write a strategy, send it. Your bot trades live in under 20 seconds.</p>
        </div>
        <button
          onClick={onCreateBot}
          className="relative shrink-0 px-6 py-4 rounded-xl bg-lime-400 hover:bg-lime-300 text-black font-bold flex items-center gap-2 transition-all hover:scale-[1.04] active:scale-95"
          style={{ animation: "glow 2.2s ease-in-out infinite", boxShadow: "0 0 40px rgba(190, 255, 0, 0.35), 0 8px 24px rgba(190, 255, 0, 0.2)" }}
        >
          <Rocket className="w-5 h-5" strokeWidth={2.6} />
          <span className="text-base">Build My Bot</span>
          <ArrowUpRight className="w-4 h-4" strokeWidth={2.6} />
        </button>
      </div>
    </div>
  );
}

// ============================================================
// TRENDING BOTS PANEL
// ============================================================
function TrendingBotsPanel({ bots, onOpenBot, toggleFollow, following, onOpenBack }: any) {
  return (
    <div className="rounded-xl bg-gradient-to-br from-rose-500/10 via-zinc-900/40 to-zinc-900/40 border border-rose-500/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Flame className="w-3.5 h-3.5 text-rose-400" />
          <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-200 font-semibold">Trending Bots</h3>
        </div>
        <span className="text-[9px] font-mono text-zinc-500">last 24h</span>
      </div>
      <div className="space-y-1.5">
        {bots.map((b, i) => (
          <div key={b.id} className="group flex items-center gap-2 p-1.5 rounded hover:bg-zinc-800/40">
            <div className="w-5 text-center font-mono text-[10px] text-zinc-500 font-bold">#{i + 1}</div>
            <button onClick={() => onOpenBot(b)} className="w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0 hover:ring-2 hover:ring-rose-400/50 transition-all" style={{ background: gradFromSeed(b.id) }}>{b.emoji}</button>
            <button onClick={() => onOpenBot(b)} className="flex-1 min-w-0 text-left">
              <div className="text-xs font-medium truncate group-hover:text-rose-300 transition-colors">{b.name}</div>
              <div className="flex items-center gap-1.5 text-[9px] font-mono text-zinc-500">
                <span className={b.pnl >= 0 ? "text-lime-400" : "text-rose-400"}>{fmtPct(b.pnl)}</span>
                <span>·</span>
                <span>{fmt(b.followers)} followers</span>
              </div>
            </button>
            <button
              onClick={() => onOpenBack?.(b)}
              className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-1 rounded transition-colors bg-rose-500/15 text-rose-300 hover:bg-rose-500 hover:text-black"
            >
              🔥 Back
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function RailCard({ title, icon: Icon, accent = "lime", children, action }: any) {
  const accentColors = {
    lime: "text-lime-400", rose: "text-rose-400", amber: "text-amber-400", violet: "text-violet-400"
  };
  return (
    <div className="rounded-xl bg-zinc-900/40 border border-zinc-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={`w-3.5 h-3.5 ${accentColors[accent]}`} />
          <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-300 font-semibold">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ============================================================
// ACTIVITY ROW
// ============================================================
const STRATEGY_TAGS = {
  "macro-fade": { label: "Macro", color: "violet" },
  "yolo": { label: "Chaos", color: "rose" },
  "underdog": { label: "Underdog", color: "amber" },
  "trend": { label: "Momentum", color: "lime" },
  "news": { label: "News", color: "sky" },
  "arbitrage": { label: "Arbitrage", color: "cyan" },
  "contrarian": { label: "Contrarian", color: "fuchsia" },
  "value": { label: "Value", color: "emerald" },
  "quant": { label: "Quant", color: "blue" },
  "copy": { label: "Copy", color: "zinc" },
  "random": { label: "Random", color: "zinc" },
  "night": { label: "Night", color: "indigo" },
  "conservative": { label: "Safe", color: "teal" },
  "custom": { label: "Custom", color: "lime" },
};

function StrategyTag({ strategy, size = "sm" }: any) {
  const tag = STRATEGY_TAGS[strategy] || STRATEGY_TAGS.custom;
  const colorMap = {
    violet: "bg-violet-500/15 text-violet-300 border-violet-500/30",
    rose: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    amber: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    lime: "bg-lime-400/15 text-lime-300 border-lime-400/30",
    sky: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    cyan: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    fuchsia: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
    emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    blue: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    zinc: "bg-zinc-700/50 text-zinc-300 border-zinc-600",
    indigo: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    teal: "bg-teal-500/15 text-teal-300 border-teal-500/30",
  };
  const sizeCls = size === "xs" ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2 py-0.5";
  return <span className={`font-mono font-bold uppercase tracking-wider rounded border ${sizeCls} ${colorMap[tag.color]}`}>{tag.label}</span>;
}

function ConfidenceTag({ level }: any) {
  const cfg = {
    MAX: { color: "text-rose-300 bg-rose-500/15 border-rose-500/30", label: "Max Conviction" },
    HIGH: { color: "text-lime-300 bg-lime-400/15 border-lime-400/30", label: "High Confidence" },
    MED: { color: "text-amber-300 bg-amber-500/15 border-amber-500/30", label: "Medium" },
    LOW: { color: "text-zinc-400 bg-zinc-800/60 border-zinc-700", label: "Probing" },
  }[level] || { color: "text-zinc-400 bg-zinc-800", label: level };
  return (
    <span className={`flex items-center gap-0.5 font-mono text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${cfg.color}`}>
      <Target className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  );
}

function ActivityRow({ a, onOpenBot, onBack, isFollowing }: any) {
  const [isNew, setIsNew] = useState(true);
  useEffect(() => { const t = setTimeout(() => setIsNew(false), 500); return () => clearTimeout(t); }, []);

  // NEW BOT LAUNCH — special card
  if (a.type === "launch") {
    return (
      <div className={`relative group overflow-hidden rounded-xl border border-lime-400/40 p-3.5 transition-all hover:border-lime-400/60 ${isNew ? "animate-launch-glow" : ""}`}
        style={{
          background: "radial-gradient(ellipse at left, rgba(190, 255, 0, 0.12) 0%, rgba(10, 14, 20, 0.4) 60%), linear-gradient(90deg, rgba(34, 197, 94, 0.04), transparent)",
        }}>
        <div className="absolute -left-4 -top-4 w-24 h-24 rounded-full bg-lime-400/30 blur-2xl pointer-events-none"></div>
        <div className="relative flex items-start gap-3">
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl ring-2 ring-lime-400/30" style={{ background: gradFromSeed(a.botName) }}>{a.botEmoji}</div>
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-lime-400 flex items-center justify-center text-[10px]">
              <Rocket className="w-3 h-3 text-black" strokeWidth={3} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[9px] font-mono font-black uppercase tracking-widest text-lime-400">🚀 NEW BOT</span>
              <span className="text-[9px] text-zinc-600 font-mono">·</span>
              <span className="text-[9px] font-mono text-zinc-500">just spawned</span>
            </div>
            <button onClick={() => onOpenBot(a.botName)} className="font-display text-lg leading-tight hover:text-lime-300 transition-colors">{a.botName}</button>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {a.botStrategy && <StrategyTag strategy={a.botStrategy} />}
              <span className="text-[10px] font-mono text-zinc-500">bankroll</span>
              <span className="text-[10px] font-mono text-lime-300 font-bold">$10,000</span>
              <span className="text-[10px] font-mono text-zinc-500">·</span>
              <span className="text-[10px] font-mono text-zinc-500">0 trades yet</span>
            </div>
          </div>
          <div className="flex flex-col gap-1 items-end shrink-0">
            <div className="text-[10px] font-mono text-zinc-500">{timeAgo(a.timestamp)}</div>
            <button onClick={() => onBack(a.botId)} className={`text-[10px] font-mono font-black uppercase tracking-wider px-2.5 py-1 rounded ${
              isFollowing ? "bg-zinc-800 text-zinc-400" : "bg-lime-400 text-black hover:bg-lime-300"
            }`}>
              {isFollowing ? "✓ Backed" : "🔥 Back"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // PROMOTION / MIGRATION EVENT
  if (a.type === "promotion") {
    const promotionTier = a.pnl > 1 ? { label: "ELITE BOT", color: "rose", icon: "👑", desc: "Top 1% performer" } :
                          a.pnl > 0.5 ? { label: "PRO BOT", color: "amber", icon: "⚡", desc: "+50% return unlocked" } :
                          { label: "VERIFIED", color: "violet", icon: "✓", desc: "1,000 followers hit" };
    const colors = {
      rose: { bg: "from-rose-500/20 via-fuchsia-500/10", border: "border-rose-500/50", text: "text-rose-300", blur: "bg-rose-500/30" },
      amber: { bg: "from-amber-500/20 via-orange-500/10", border: "border-amber-500/50", text: "text-amber-300", blur: "bg-amber-500/30" },
      violet: { bg: "from-violet-500/20 via-fuchsia-500/10", border: "border-violet-500/50", text: "text-violet-300", blur: "bg-violet-500/30" },
    }[promotionTier.color];

    return (
      <div className={`relative group overflow-hidden rounded-xl bg-gradient-to-r ${colors.bg} to-transparent border ${colors.border} p-3.5 transition-all hover:scale-[1.005] ${isNew ? "animate-slide-in" : ""}`}>
        <div className={`absolute -right-8 -top-8 w-36 h-36 rounded-full ${colors.blur} blur-3xl pointer-events-none opacity-50`}></div>
        <div className="relative flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl ring-2 ring-black/40" style={{ background: gradFromSeed(a.botId || a.botName) }}>{a.botEmoji}</div>
            <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-amber-300 to-rose-500 flex items-center justify-center text-sm ring-2 ring-black shadow-lg`}>
              {promotionTier.icon}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className={`text-[9px] font-mono font-black uppercase tracking-widest ${colors.text}`}>⚡ PROMOTED</span>
              <span className="text-[9px] text-zinc-600">·</span>
              <span className={`text-[9px] font-mono font-bold ${colors.text} uppercase tracking-widest`}>{promotionTier.label}</span>
            </div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <button onClick={() => onOpenBot(a.botName)} className="font-display text-lg leading-tight hover:text-lime-300 transition-colors">{a.botName}</button>
              <span className="text-xs text-zinc-400">— {promotionTier.desc}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className="text-[10px] font-mono text-zinc-500">unlocks:</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/30 border border-zinc-700 text-zinc-300">Back Bot</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/30 border border-zinc-700 text-zinc-300">Copy Trades</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/30 border border-zinc-700 text-zinc-300">Priority Feed</span>
            </div>
          </div>
          <div className="flex flex-col gap-1 items-end shrink-0">
            <div className="text-[10px] font-mono text-zinc-500">{timeAgo(a.timestamp)}</div>
            <button onClick={() => onBack(a.botId)} className={`text-[10px] font-mono font-black uppercase tracking-wider px-2.5 py-1 rounded ${
              isFollowing ? "bg-zinc-800 text-zinc-400" : `bg-gradient-to-r from-amber-400 to-rose-400 text-black hover:brightness-110`
            }`}>
              {isFollowing ? "✓ Backed" : "🔥 Back Bot"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // MILESTONE (big PnL moment)
  if (a.type === "milestone") {
    const big = a.pnl > 0.5;
    return (
      <div className={`group flex items-center gap-3 p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:border-lime-400/40 transition-all ${isNew ? "animate-slide-in" : ""}`}>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 relative ring-1 ring-zinc-700" style={{ background: gradFromSeed(a.botId || a.botName) }}>
          {a.botEmoji}
          {big && <div className="absolute -top-1 -right-1 text-base drop-shadow-[0_0_6px_rgba(255,100,100,0.8)]">🔥</div>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <button onClick={() => onOpenBot(a.botName)} className="font-semibold text-sm hover:text-lime-300">{a.botName}</button>
            <span className="text-xs text-zinc-400">hit</span>
            <span className="text-base font-mono font-black text-lime-400 tabular-nums">{fmtPct(a.pnl)}</span>
            <span className="text-xs text-zinc-400">today</span>
            {big && <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">ON FIRE</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] font-mono text-zinc-500">+{Math.floor(Math.random() * 40) + 10} XP earned</span>
            <span className="text-[10px] text-zinc-700">·</span>
            <span className="text-[10px] font-mono text-zinc-500">{Math.floor(randBetween(3, 12))} winning trades in a row</span>
          </div>
        </div>
        <div className="flex flex-col gap-1 items-end shrink-0">
          <div className="text-[10px] font-mono text-zinc-500">{timeAgo(a.timestamp)}</div>
          <button onClick={() => onBack(a.botId)} className={`text-[10px] font-mono font-black uppercase tracking-wider px-2.5 py-1 rounded transition-colors ${
            isFollowing ? "bg-zinc-800 text-zinc-400" : "bg-lime-400/15 text-lime-300 hover:bg-lime-400/25"
          }`}>
            {isFollowing ? "✓ Backed" : "🔥 Back"}
          </button>
        </div>
      </div>
    );
  }

  // FOLLOW event — compact
  if (a.type === "follow") {
    return (
      <div className={`flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-900/40 transition-colors ${isNew ? "animate-slide-in" : ""}`}>
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 opacity-80" style={{ background: gradFromSeed(a.botId || a.botName) }}>{a.botEmoji}</div>
        <div className="flex-1 text-xs text-zinc-400">
          <Users className="w-3 h-3 inline text-zinc-500 mr-1" />
          <button onClick={() => onOpenBot(a.botName)} className="text-zinc-200 hover:text-lime-300 font-medium">{a.botName}</button>
          <span> gained {Math.floor(Math.random() * 15) + 3} new followers</span>
        </div>
        <div className="text-[10px] font-mono text-zinc-600 shrink-0">{timeAgo(a.timestamp)}</div>
      </div>
    );
  }

  // DEFAULT: TRADE event — the most common, upgraded with drama
  const isYes = a.side === "YES";
  const pnlUp = a.pnlImpact >= 0;
  return (
    <div className={`group relative flex items-start gap-3 p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900/80 transition-all ${isNew ? "animate-slide-in" : ""}`}>
      {/* Drama accent bar on left */}
      {a.drama && (
        <div className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-full ${
          a.drama === "🔥" ? "bg-rose-500" :
          a.drama === "🧠" ? "bg-lime-400" :
          a.drama === "⚠️" ? "bg-amber-500" :
          a.drama === "💰" ? "bg-emerald-500" :
          "bg-violet-500"
        }`}></div>
      )}
      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-lg shrink-0 ring-1 ring-zinc-700 relative" style={{ background: gradFromSeed(a.botId || a.botName) }}>
        {a.botEmoji}
        {a.drama && <div className="absolute -top-1.5 -right-1.5 text-sm drop-shadow-[0_0_4px_rgba(255,100,100,0.6)]">{a.drama}</div>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap mb-1">
          <button onClick={() => onOpenBot(a.botName)} className="font-semibold text-sm hover:text-lime-300 transition-colors">{a.botName}</button>
          {a.botStrategy && <StrategyTag strategy={a.botStrategy} size="xs" />}
          <span className="text-xs text-zinc-500">entered</span>
          <span className={`text-xs font-mono font-black px-1.5 py-0.5 rounded ${isYes ? "bg-lime-400/20 text-lime-300" : "bg-rose-400/20 text-rose-300"}`}>
            {a.side} @ {a.price}¢
          </span>
          <span className="text-xs font-mono text-zinc-400">${fmt(a.size)}</span>
        </div>
        <div className="text-xs text-zinc-300 truncate mb-1.5">{a.marketTitle}</div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <ConfidenceTag level={a.confidence} />
          <div className={`flex items-center gap-0.5 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
            pnlUp ? "text-lime-300 bg-lime-400/10 border-lime-400/30" : "text-rose-300 bg-rose-400/10 border-rose-400/30"
          }`}>
            {pnlUp ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
            {fmtPct(a.pnlImpact)} on position
          </div>
          {a.marketCategory && (
            <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">{a.marketCategory}</span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1 items-end shrink-0">
        <div className="text-[10px] font-mono text-zinc-500">{timeAgo(a.timestamp)}</div>
        <div className="flex gap-1">
          <button onClick={() => onOpenBot(a.botName)} className="text-[10px] font-mono text-zinc-400 hover:text-zinc-100 px-2 py-1 rounded hover:bg-zinc-800 transition-colors">
            View
          </button>
          <button onClick={() => onBack(a.botId)} className={`text-[10px] font-mono font-black uppercase tracking-wider px-2.5 py-1 rounded transition-colors ${
            isFollowing ? "bg-zinc-800 text-zinc-400" : "bg-lime-400/15 text-lime-300 hover:bg-lime-400 hover:text-black"
          }`}>
            {isFollowing ? "✓" : "🔥 Back"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MARKETS VIEW
// ============================================================
function MarketsView({ markets, bots, onSelectMarket, selectedMarket }: any) {
  const [cat, setCat] = useState("all");
  const cats: string[] = ["all", ...new Set<string>(markets.map((m: any) => m.category as string))];
  const filtered = cat === "all" ? markets : markets.filter((m: any) => m.category === cat);

  if (selectedMarket) return <MarketDetailView market={selectedMarket} bots={bots} onBack={() => onSelectMarket(null)} />;

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="font-display text-4xl">All <span className="text-lime-400">Markets</span></h2>
          <p className="text-sm text-zinc-500 mt-1">Paper-trade anything. Train bots on real-world probability.</p>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <Stat label="Markets" value={markets.length} />
          <Stat label="24h Volume" value={"$" + fmt(markets.reduce((s: number, m: any) => s + m.vol, 0))} />
          <Stat label="Liquidity" value={"$" + fmt(markets.reduce((s: number, m: any) => s + m.liquidity, 0))} />
        </div>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-thin pb-1">
        {cats.map((c: string) => (
          <button key={c} onClick={() => setCat(c)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              cat === c ? "bg-lime-400 text-black" : "bg-zinc-800/60 text-zinc-400 hover:text-zinc-100"
            }`}>
            {c === "all" ? "All" : c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {filtered.map(m => <MarketCard key={m.id} market={m} onClick={() => onSelectMarket(m)} />)}
      </div>
    </div>
  );
}

function Stat({ label, value }: any) {
  return (
    <div className="text-right">
      <div className="text-[10px] uppercase text-zinc-500 tracking-widest">{label}</div>
      <div className="text-sm text-zinc-100 font-semibold">{value}</div>
    </div>
  );
}

function MarketCard({ market, onClick }: any) {
  const up = market.change24h >= 0;
  return (
    <button onClick={onClick} className="text-left p-5 rounded-xl bg-zinc-900/40 border border-zinc-800 hover:border-lime-400/40 hover:bg-zinc-900/70 transition-all group">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 bg-zinc-800/60 px-2 py-0.5 rounded">{market.category}</span>
        <span className={`text-xs font-mono font-semibold ${up ? "text-lime-400" : "text-rose-400"} flex items-center gap-0.5`}>
          {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {fmtPct(market.change24h)}
        </span>
      </div>
      <div className="text-sm font-medium leading-tight mb-4 line-clamp-2 min-h-[2.5rem] group-hover:text-lime-300 transition-colors">{market.title}</div>
      <div className="flex gap-2 mb-3">
        <div className="flex-1 bg-lime-400/10 border border-lime-400/30 rounded px-2.5 py-1.5">
          <div className="text-[10px] font-mono text-lime-400/80 uppercase">Yes</div>
          <div className="text-lg font-bold font-mono text-lime-300">{fmtPrice(market.yesPrice)}</div>
        </div>
        <div className="flex-1 bg-rose-400/10 border border-rose-400/30 rounded px-2.5 py-1.5">
          <div className="text-[10px] font-mono text-rose-400/80 uppercase">No</div>
          <div className="text-lg font-bold font-mono text-rose-300">{fmtPrice(1 - market.yesPrice)}</div>
        </div>
      </div>
      <div className="flex justify-between text-[10px] font-mono text-zinc-500">
        <span>Vol ${fmt(market.vol)}</span>
        <span>Liq ${fmt(market.liquidity)}</span>
      </div>
    </button>
  );
}

function MarketDetailView({ market, bots, onBack }: any) {
  // Fake depth from bots trading this market
  const activeBots = bots.slice(0, 8).map(b => ({
    ...b, side: Math.random() > 0.5 ? "YES" : "NO", size: Math.floor(randBetween(100, 2500)),
    entry: Math.floor(randBetween(20, 80)),
  }));
  const up = market.change24h >= 0;

  return (
    <div>
      <button onClick={onBack} className="text-xs font-mono text-zinc-500 hover:text-lime-400 mb-4 flex items-center gap-1">← back to markets</button>
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8">
          <div className="p-6 rounded-xl bg-zinc-900/40 border border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 bg-zinc-800/60 px-2 py-0.5 rounded">{market.category}</span>
              <span className={`text-xs font-mono ${up ? "text-lime-400" : "text-rose-400"}`}>{fmtPct(market.change24h)} 24h</span>
            </div>
            <h1 className="font-display text-3xl mb-6 leading-tight">{market.title}</h1>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-5 rounded-lg bg-lime-400/10 border border-lime-400/30">
                <div className="text-xs font-mono text-lime-400/80 mb-1">YES</div>
                <div className="text-4xl font-bold font-mono text-lime-300">{fmtPrice(market.yesPrice)}</div>
                <div className="text-[11px] text-zinc-500 mt-1">implied probability</div>
              </div>
              <div className="p-5 rounded-lg bg-rose-400/10 border border-rose-400/30">
                <div className="text-xs font-mono text-rose-400/80 mb-1">NO</div>
                <div className="text-4xl font-bold font-mono text-rose-300">{fmtPrice(1 - market.yesPrice)}</div>
                <div className="text-[11px] text-zinc-500 mt-1">implied probability</div>
              </div>
            </div>
            <PriceChart yesPrice={market.yesPrice} />
            <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-zinc-800">
              <MiniStat label="Total Volume" value={"$" + fmt(market.vol)} />
              <MiniStat label="Liquidity" value={"$" + fmt(market.liquidity)} />
              <MiniStat label="Bots Active" value={activeBots.length} />
            </div>
          </div>
        </div>
        <div className="col-span-4">
          <RailCard title="Bot Positions" icon={Bot} accent="lime">
            <div className="space-y-2">
              {activeBots.map(b => (
                <div key={b.id} className="flex items-center gap-2 p-2 rounded-md bg-zinc-900/60">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm" style={{ background: gradFromSeed(b.id) }}>{b.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{b.name}</div>
                    <div className="text-[10px] font-mono text-zinc-500">{b.entry}¢ · ${fmt(b.size)}</div>
                  </div>
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${b.side === "YES" ? "bg-lime-400/15 text-lime-300" : "bg-rose-400/15 text-rose-300"}`}>{b.side}</span>
                </div>
              ))}
            </div>
          </RailCard>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: any) {
  return (
    <div>
      <div className="text-[10px] uppercase text-zinc-500 tracking-widest font-mono">{label}</div>
      <div className="text-base text-zinc-100 font-semibold font-mono">{value}</div>
    </div>
  );
}

// Simple sparkline / price chart
function PriceChart({ yesPrice, history = null }: any) {
  const points = useMemo(() => {
    if (history) return history;
    const n = 40, arr = [];
    let v = yesPrice + (Math.random() - 0.5) * 0.3;
    for (let i = 0; i < n; i++) {
      v += (Math.random() - 0.5) * 0.05;
      v = Math.max(0.05, Math.min(0.95, v));
      arr.push(v);
    }
    arr[arr.length - 1] = yesPrice;
    return arr;
  }, [yesPrice, history]);

  const W = 700, H = 160, pad = 8;
  const min = Math.min(...points), max = Math.max(...points);
  const range = Math.max(0.02, max - min);
  const toXY = (v, i) => {
    const x = pad + (i / (points.length - 1)) * (W - pad * 2);
    const y = pad + (1 - (v - min) / range) * (H - pad * 2);
    return [x, y];
  };
  const path = points.map((v, i) => { const [x, y] = toXY(v, i); return (i === 0 ? "M" : "L") + x + "," + y; }).join(" ");
  const area = path + ` L${pad + (W - pad * 2)},${H - pad} L${pad},${H - pad} Z`;

  return (
    <div className="rounded-lg bg-black/40 border border-zinc-800 p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-40">
        <defs>
          <linearGradient id="gradArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#bef264" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#bef264" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#gradArea)" />
        <path d={path} fill="none" stroke="#bef264" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// ============================================================
// LEADERBOARD
// ============================================================
function LeaderboardView({ bots, onOpenBot, following, toggleFollow, onOpenBack }: any) {
  const [sortBy, setSortBy] = useState("pnl"); // pnl | winRate | streak | followers | backed
  const [timeRange, setTimeRange] = useState("all"); // 24h | 7d | 30d | all
  const [styleFilter, setStyleFilter] = useState("all"); // all | specific strategy
  const { getPlatformBackedAmount, getBackerCount } = useAppState();

  // Available strategy filters
  const availableStrategies = useMemo(() => {
    const set = new Set<string>();
    bots.forEach((b: any) => b.strategy && set.add(b.strategy));
    return Array.from(set).sort();
  }, [bots]);

  // Time-range adjustment: scale pnl by a time-window factor for display variety.
  // (Real app would query historical snapshots — this keeps the UI meaningful.)
  const scaleFactor: Record<string, number> = { "24h": 0.1, "7d": 0.35, "30d": 0.7, "all": 1 };

  const filtered = useMemo(() => {
    let arr = [...bots];
    if (styleFilter !== "all") arr = arr.filter((b: any) => b.strategy === styleFilter);
    const factor = scaleFactor[timeRange] ?? 1;
    return arr.map((b: any) => ({ ...b, _displayPnl: b.pnl * factor }));
  }, [bots, styleFilter, timeRange]);

  const sorters: Record<string, (a: any, b: any) => number> = {
    pnl: (a, b) => b._displayPnl - a._displayPnl,
    winRate: (a, b) => b.winRate - a.winRate,
    streak: (a, b) => b.streak - a.streak,
    followers: (a, b) => b.followers - a.followers,
    backed: (a, b) => getPlatformBackedAmount(b.id) - getPlatformBackedAmount(a.id),
  };
  const sorted = [...filtered].sort(sorters[sortBy] ?? sorters.pnl);

  return (
    <div>
      <div className="flex items-end justify-between mb-4 flex-wrap gap-4">
        <div>
          <h2 className="font-display text-4xl">The <span className="text-lime-400">Leaderboard</span></h2>
          <p className="text-sm text-zinc-500 mt-1">Only the sharpest bots survive. Everyone else gets rebuilt.</p>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-wrap gap-2 mb-4">
        {/* Time range */}
        <div className="flex gap-0.5 p-0.5 bg-zinc-900/60 border border-zinc-800 rounded-lg">
          {[
            { k: "24h", l: "24h" },
            { k: "7d", l: "7d" },
            { k: "30d", l: "30d" },
            { k: "all", l: "All" },
          ].map(o => (
            <button key={o.k} onClick={() => setTimeRange(o.k)}
              className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold transition ${
                timeRange === o.k ? "bg-lime-400 text-black" : "text-zinc-400 hover:text-zinc-100"
              }`}>{o.l}</button>
          ))}
        </div>

        {/* Sort by */}
        <div className="flex gap-0.5 p-0.5 bg-zinc-900/60 border border-zinc-800 rounded-lg">
          {[
            { k: "pnl", l: "Return" },
            { k: "winRate", l: "Win %" },
            { k: "streak", l: "Streak" },
            { k: "followers", l: "Followers" },
            { k: "backed", l: "Backed $" },
          ].map(o => (
            <button key={o.k} onClick={() => setSortBy(o.k)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                sortBy === o.k ? "bg-zinc-100 text-black" : "text-zinc-400 hover:text-zinc-100"
              }`}>{o.l}</button>
          ))}
        </div>

        {/* Style */}
        <select
          value={styleFilter}
          onChange={(e) => setStyleFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800 text-[11px] font-mono text-zinc-200 focus:outline-none focus:border-lime-400/40"
        >
          <option value="all">All styles</option>
          {availableStrategies.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <div className="ml-auto text-xs font-mono text-zinc-500 self-center">
          {sorted.length} bot{sorted.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Empty state */}
      {sorted.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-900/20">
          <div className="text-4xl mb-2">🔍</div>
          <div className="font-display text-base mb-1">No bots match these filters</div>
          <div className="text-xs text-zinc-500">Try widening your time range or picking a different style.</div>
        </div>
      ) : (
        <>
          {/* Podium */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {sorted.slice(0, 3).map((b: any, i) => <PodiumCard key={b.id} bot={b} rank={i + 1} onClick={() => onOpenBot(b)} />)}
          </div>

          {/* Table */}
          <div className="rounded-xl bg-zinc-900/40 border border-zinc-800 overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-zinc-800 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
              <div className="col-span-1">Rank</div>
              <div className="col-span-3">Bot</div>
              <div className="col-span-2 text-right">Return</div>
              <div className="col-span-1 text-right">Bankroll</div>
              <div className="col-span-1 text-right">Followers</div>
              <div className="col-span-2 text-right">Backed</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>
            {sorted.map((b: any, i) => {
              const backed = getPlatformBackedAmount(b.id);
              const backers = getBackerCount(b.id);
              return (
                <div key={b.id} className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30 transition-colors items-center">
                  <div className="col-span-1 font-mono font-bold text-sm">
                    {i < 3 ? <span className="text-xl">{["🥇", "🥈", "🥉"][i]}</span> : <span className="text-zinc-500">#{i + 1}</span>}
                  </div>
                  <button onClick={() => onOpenBot(b)} className="col-span-3 flex items-center gap-2.5 text-left">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0" style={{ background: gradFromSeed(b.id) }}>{b.emoji}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <div className="text-sm font-semibold truncate">{b.name}</div>
                        <BotStatusBadge bot={b} />
                      </div>
                      <div className="text-[10px] font-mono text-zinc-500 truncate">LVL {b.level} · {b.strategy}</div>
                    </div>
                  </button>
                  <div className={`col-span-2 text-right font-mono font-bold ${b._displayPnl >= 0 ? "text-lime-400" : "text-rose-400"}`}>{fmtPct(b._displayPnl)}</div>
                  <div className="col-span-1 text-right text-sm font-mono text-zinc-300">${fmt(b.bankroll)}</div>
                  <div className="col-span-1 text-right text-sm font-mono text-zinc-400">{fmt(b.followers)}</div>
                  <div className="col-span-2 text-right">
                    {backed > 0 ? (
                      <>
                        <div className="text-sm font-mono font-bold text-rose-300">${fmt(backed)}</div>
                        <div className="text-[9px] font-mono text-zinc-500">{fmt(backers)} backing</div>
                      </>
                    ) : (
                      <span className="text-xs font-mono text-zinc-600">—</span>
                    )}
                  </div>
                  <div className="col-span-2 text-right flex gap-1 justify-end">
                    <button onClick={() => onOpenBot(b)} className="text-[10px] font-mono text-zinc-400 hover:text-zinc-100 px-2 py-1 rounded hover:bg-zinc-800">
                      View
                    </button>
                    <button onClick={() => onOpenBack?.(b)} className="text-[10px] font-mono font-black uppercase tracking-wider px-2.5 py-1 rounded bg-lime-400/15 text-lime-300 hover:bg-lime-400 hover:text-black transition-colors">
                      🔥 Back
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function PodiumCard({ bot, rank, onClick }: any) {
  const medals = ["🥇", "🥈", "🥉"];
  const gradients = [
    "from-amber-400/20 to-transparent border-amber-400/40",
    "from-zinc-300/20 to-transparent border-zinc-300/40",
    "from-orange-400/20 to-transparent border-orange-400/40",
  ];
  return (
    <button onClick={onClick} className={`relative text-left p-5 rounded-xl bg-gradient-to-br ${gradients[rank - 1]} border backdrop-blur hover:scale-[1.02] transition-transform`}>
      <div className="absolute top-3 right-3 text-3xl">{medals[rank - 1]}</div>
      <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl mb-3 ring-2 ring-zinc-900/60" style={{ background: gradFromSeed(bot.id) }}>{bot.emoji}</div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 mb-1">#{rank} · {bot.strategy}</div>
      <div className="font-display text-xl mb-1">{bot.name}</div>
      <div className="text-xs text-zinc-500 line-clamp-1 mb-3">{bot.bio}</div>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-bold font-mono ${bot.pnl >= 0 ? "text-lime-400" : "text-rose-400"}`}>{fmtPct(bot.pnl)}</span>
        <span className="text-[10px] font-mono text-zinc-500">total return</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-zinc-800/60">
        <MiniStat label="Win" value={(bot.winRate * 100).toFixed(0) + "%"} />
        <MiniStat label="Trades" value={bot.trades} />
        <MiniStat label="Follow" value={fmt(bot.followers)} />
      </div>
    </button>
  );
}

// ============================================================
// BOT PROFILE
// ============================================================
function BotProfileView({ bot, bots, onBack, toggleFollow, following, activity, markets, onOpenBack, onOpenInvest }: any) {
  const isFollowing = following.has(bot.id);
  const rank = [...bots].sort((a, b) => b.pnl - a.pnl).findIndex(b => b.id === bot.id) + 1;
  const botActivity = activity.filter(a => a.botName === bot.name).slice(0, 15);
  const { getPlatformBackedAmount, getBackerCount, getMyBackedAmount } = useAppState();
  const platformBacked = getPlatformBackedAmount(bot.id);
  const backers = getBackerCount(bot.id);
  const myBacked = getMyBackedAmount(bot.id);

  // Fake positions
  const positions = useMemo(() => markets.slice(0, 4).map(m => ({
    market: m, side: Math.random() > 0.5 ? "YES" : "NO",
    entry: Math.floor(randBetween(25, 75)), size: Math.floor(randBetween(200, 1800)),
    pnl: randBetween(-0.25, 0.8),
  })), [bot.id, markets]);

  // Fake reasoning feed
  const reasoningFeed = useMemo(() => Array.from({ length: 8 }, (_, i) => ({
    id: rid(),
    text: pick(REASONING_TEMPLATES)
      .replace("{p}", Math.floor(randBetween(25, 75)))
      .replace("{fv}", Math.floor(randBetween(25, 75)))
      .replace("{pnl}", (randBetween(5, 45)).toFixed(1)),
    timestamp: Date.now() - i * 1800000 - Math.random() * 1000000,
    market: pick(markets).title,
  })), [bot.id, markets]);

  // Daily % change (derived)
  const dayChange = bot.pnl * 0.15 + (Math.random() - 0.5) * 0.05;
  const bestTrade = Math.max(0.15, Math.abs(bot.pnl) * 0.6 + Math.random() * 0.3);

  return (
    <div>
      <button onClick={onBack} className="text-xs font-mono text-zinc-500 hover:text-lime-400 mb-4 flex items-center gap-1">← back</button>

      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-800 p-8 mb-6" style={{
        background: `linear-gradient(135deg, ${gradFromSeed(bot.id).replace('linear-gradient(135deg, ', '').replace(')', '')} 0%, transparent 60%), #0a0a0a`
      }}>
        <div className="absolute inset-0 grid-bg opacity-30"></div>
        <div className="relative grid grid-cols-12 gap-6 items-start">
          <div className="col-span-12 lg:col-span-8 flex gap-5">
            <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-5xl shrink-0 ring-4 ring-black/40" style={{ background: gradFromSeed(bot.id) }}>
              {bot.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 bg-black/40 px-2 py-0.5 rounded">#{rank} · LVL {bot.level}</span>
                <span className="text-[10px] font-mono uppercase tracking-widest text-lime-300 bg-lime-400/10 px-2 py-0.5 rounded">{bot.strategy}</span>
                <BotStatusBadge bot={bot} />
              </div>
              <h1 className="font-display text-4xl mb-1">{bot.name}</h1>
              <p className="text-sm text-zinc-300 italic font-serif-i mb-3">"{bot.bio}"</p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {(bot.badges ?? []).map((bd, i) => (
                  <span key={i} className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/40 border border-zinc-700">
                    <span>{bd.icon}</span>{bd.label}
                  </span>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap">
                {bot.status === "pro" && (
                  <button
                    onClick={() => onOpenInvest?.(bot)}
                    className="px-5 py-2 rounded-md bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-black text-sm font-bold flex items-center gap-1.5 transition-all hover:scale-[1.02] shadow-lg shadow-amber-500/30"
                  >
                    <DollarSign className="w-4 h-4" strokeWidth={2.5} />
                    🔥 Invest in this Bot
                  </button>
                )}
                <button
                  onClick={() => onOpenBack?.(bot)}
                  className={`px-5 py-2 rounded-md ${bot.status === "pro" ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-100" : "bg-lime-400 hover:bg-lime-300 text-black shadow-lg shadow-lime-500/20"} text-sm font-bold flex items-center gap-1.5 transition-all hover:scale-[1.02]`}
                >
                  <Flame className="w-4 h-4" strokeWidth={2.5} />
                  {myBacked > 0 ? `Backed $${fmt(myBacked)} · Top up` : "🔥 Back"}
                </button>
                <button onClick={() => toggleFollow(bot.id)} className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
                  isFollowing ? "bg-zinc-800 text-zinc-300" : "bg-black/40 hover:bg-black/60 border border-zinc-700 text-zinc-100"
                }`}>
                  {isFollowing ? <><Check className="w-3.5 h-3.5 inline mr-1" /> Following</> : "Follow"}
                </button>
                <button className="px-4 py-2 rounded-md bg-black/40 hover:bg-black/60 border border-zinc-700 text-sm font-semibold flex items-center gap-1.5">
                  <Copy className="w-3.5 h-3.5" /> Clone & Run
                </button>
              </div>
            </div>
          </div>
          <div className="col-span-12 lg:col-span-4 grid grid-cols-2 gap-3">
            <StatBox label="Total Return" value={fmtPct(bot.pnl)} accent={bot.pnl >= 0 ? "lime" : "rose"} big />
            <StatBox label="24h Change" value={fmtPct(dayChange)} accent={dayChange >= 0 ? "lime" : "rose"} />
            <StatBox label="Win Rate" value={(bot.winRate * 100).toFixed(0) + "%"} />
            <StatBox label="Best Trade" value={"+" + (bestTrade * 100).toFixed(0) + "%"} />
          </div>
        </div>
      </div>

      {/* Track Record strip — always shown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="p-3 rounded-lg bg-black/30 border border-zinc-800">
          <div className="text-[9px] uppercase font-mono tracking-widest text-zinc-500">Track Record</div>
          <div className={`font-mono font-bold text-2xl ${bot.pnl >= 0 ? "text-lime-400" : "text-rose-400"}`}>
            {fmtPct(bot.pnl)}
          </div>
          <div className="text-[10px] font-mono text-zinc-500 mt-0.5">from $10,000 simulation</div>
        </div>
        <div className="p-3 rounded-lg bg-black/30 border border-zinc-800">
          <div className="text-[9px] uppercase font-mono tracking-widest text-zinc-500">Sim Bankroll</div>
          <div className="font-mono font-bold text-2xl text-zinc-100">${fmt(bot.simBankroll ?? 1000)}</div>
          <div className="text-[10px] font-mono text-zinc-500 mt-0.5">{bot.trades ?? 0} trades</div>
        </div>
        {bot.status === "pro" ? (
          <>
            <div className="p-3 rounded-lg bg-gradient-to-br from-amber-400/10 to-transparent border border-amber-400/30">
              <div className="text-[9px] uppercase font-mono tracking-widest text-amber-300">Total Invested</div>
              <div className="font-mono font-bold text-2xl text-amber-300">${fmt(bot.totalInvested ?? 0)}</div>
              <div className="text-[10px] font-mono text-amber-300/70 mt-0.5">real capital</div>
            </div>
            <div className="p-3 rounded-lg bg-gradient-to-br from-amber-400/10 to-transparent border border-amber-400/30">
              <div className="text-[9px] uppercase font-mono tracking-widest text-amber-300">Investors</div>
              <div className="font-mono font-bold text-2xl text-amber-300">{fmt(bot.investorCount ?? 0)}</div>
              <div className="text-[10px] font-mono text-amber-300/70 mt-0.5">active</div>
            </div>
          </>
        ) : (
          <>
            <div className="p-3 rounded-lg bg-black/30 border border-zinc-800 opacity-50">
              <div className="text-[9px] uppercase font-mono tracking-widest text-zinc-500">Investment</div>
              <div className="font-mono font-bold text-2xl text-zinc-500">🔒</div>
              <div className="text-[10px] font-mono text-zinc-500 mt-0.5">locked until PRO</div>
            </div>
            <div className="p-3 rounded-lg bg-black/30 border border-zinc-800">
              <div className="text-[9px] uppercase font-mono tracking-widest text-zinc-500">Status</div>
              <div className="font-display font-bold text-xl uppercase">
                <span className={bot.status === "rising" ? "text-amber-300" : "text-zinc-400"}>
                  {bot.status ?? "new"}
                </span>
              </div>
              <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
                {bot.status === "rising" ? "approaching PRO" : "trading simulation"}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Social proof strip */}
      {(platformBacked > 0 || bot.followers > 500) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          {platformBacked > 0 && <BackedCapital botId={bot.id} variant="big" />}
          <div className="p-3 rounded-lg bg-black/30 border border-zinc-800">
            <div className="text-[9px] uppercase font-mono tracking-widest text-zinc-500">Win Streak</div>
            <div className="font-mono font-bold text-2xl text-zinc-100">
              {bot.streak > 0 ? (
                <span className="text-lime-400">W{bot.streak}</span>
              ) : bot.streak < 0 ? (
                <span className="text-rose-400">L{Math.abs(bot.streak)}</span>
              ) : (
                <span className="text-zinc-500">—</span>
              )}
            </div>
            <div className="text-[10px] font-mono text-zinc-500 mt-0.5">current run</div>
          </div>
          <div className="p-3 rounded-lg bg-black/30 border border-zinc-800">
            <div className="text-[9px] uppercase font-mono tracking-widest text-zinc-500">Followers</div>
            <div className="font-mono font-bold text-2xl text-zinc-100">{fmt(bot.followers)}</div>
            <div className="flex items-center gap-0.5 mt-1">
              {/* Synthetic follower avatars */}
              {Array.from({ length: Math.min(5, Math.ceil(bot.followers / 500)) }).map((_, i) => (
                <div key={i} className="w-5 h-5 rounded-full ring-2 ring-black"
                  style={{ background: gradFromSeed(bot.id + "_f" + i), marginLeft: i > 0 ? -6 : 0 }}></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* XP bar */}
      <div className="mb-6 p-4 rounded-xl bg-zinc-900/40 border border-zinc-800">
        <div className="flex items-center justify-between mb-1.5 text-xs font-mono">
          <span className="text-zinc-400">LEVEL {bot.level} <span className="text-zinc-600">→</span> LEVEL {bot.level + 1}</span>
          <span className="text-lime-400">{bot.xp}/100 XP</span>
        </div>
        <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-lime-500 to-lime-300" style={{ width: `${bot.xp}%` }}></div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8 space-y-6">
          {/* Performance chart */}
          <div className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg">Performance</h3>
              <div className="flex gap-1 text-[10px] font-mono">
                {["1D", "1W", "1M", "ALL"].map(r => (
                  <button key={r} className={`px-2 py-1 rounded ${r === "ALL" ? "bg-lime-400/15 text-lime-300" : "text-zinc-500 hover:text-zinc-200"}`}>{r}</button>
                ))}
              </div>
            </div>
            <PriceChart history={(bot.perfHistory ?? []).map(p => p + 1).map(p => p / 2 + 0.25)} yesPrice={bot.pnl} />
          </div>

          {/* Reasoning feed */}
          <div className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-4 h-4 text-violet-400" />
              <h3 className="font-display text-lg">Reasoning Feed</h3>
              <span className="text-[10px] font-mono text-zinc-500 ml-auto">how the bot thinks</span>
            </div>
            <div className="space-y-3">
              {reasoningFeed.map(r => (
                <div key={r.id} className="p-3 rounded-lg bg-black/30 border-l-2 border-violet-500/40">
                  <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 mb-1">
                    <Clock className="w-3 h-3" />
                    <span>{timeAgo(r.timestamp)} ago</span>
                    <span className="text-zinc-700">·</span>
                    <span className="truncate">{r.market}</span>
                  </div>
                  <p className="text-sm text-zinc-200 font-mono">{r.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Trade history */}
          <div className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800">
            <h3 className="font-display text-lg mb-4">Trade History</h3>
            <div className="space-y-2">
              {botActivity.length === 0 ? (
                <div className="text-xs text-zinc-500 font-mono py-4 text-center">No trades logged yet. Sit tight — the bot is scanning markets.</div>
              ) : botActivity.map(a => (
                <div key={a.id} className="grid grid-cols-12 gap-3 items-center text-xs py-2 border-b border-zinc-800/50 last:border-0">
                  <div className="col-span-1 font-mono text-zinc-500">{timeAgo(a.timestamp)}</div>
                  <div className="col-span-6 text-zinc-300 truncate">{a.marketTitle}</div>
                  <div className="col-span-2">
                    <span className={`font-mono font-bold px-1.5 py-0.5 rounded ${a.side === "YES" ? "bg-lime-400/15 text-lime-300" : "bg-rose-400/15 text-rose-300"}`}>{a.side} @ {a.price}¢</span>
                  </div>
                  <div className="col-span-2 text-right font-mono text-zinc-400">${fmt(a.size)}</div>
                  <div className={`col-span-1 text-right font-mono ${a.pnl >= 0 ? "text-lime-400" : "text-rose-400"}`}>{fmtPct(a.pnl)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-4 space-y-4">
          <RailCard title="Active Positions" icon={CircleDot} accent="lime">
            <div className="space-y-2">
              {positions.map((p, i) => (
                <div key={i} className="p-2.5 rounded-md bg-black/30 border border-zinc-800">
                  <div className="text-xs text-zinc-300 line-clamp-2 mb-1.5">{p.market.title}</div>
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className={`px-1.5 py-0.5 rounded font-bold ${p.side === "YES" ? "bg-lime-400/15 text-lime-300" : "bg-rose-400/15 text-rose-300"}`}>{p.side} @ {p.entry}¢</span>
                    <span className="text-zinc-400">${fmt(p.size)}</span>
                    <span className={p.pnl >= 0 ? "text-lime-400" : "text-rose-400"}>{fmtPct(p.pnl)}</span>
                  </div>
                </div>
              ))}
            </div>
          </RailCard>

          <RailCard title="Strategy" icon={Target} accent="amber">
            <div className="text-xs text-zinc-300 leading-relaxed">{bot.strategyText}</div>
            <div className="mt-3 pt-3 border-t border-zinc-800">
              <div className="flex items-center justify-between text-[10px] font-mono mb-1.5">
                <span className="text-zinc-500">RISK LEVEL</span>
                <span className="text-amber-400">{bot.risk}/5</span>
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <div key={n} className={`flex-1 h-1.5 rounded-full ${n <= bot.risk ? "bg-gradient-to-r from-lime-500 via-amber-400 to-rose-500" : "bg-zinc-800"}`}
                    style={{ opacity: n <= bot.risk ? 0.2 + n * 0.16 : 1 }}></div>
                ))}
              </div>
            </div>
          </RailCard>

          <RailCard title="Achievements" icon={Award} accent="violet">
            <div className="grid grid-cols-3 gap-2">
              {[...bot.badges, { icon: "🔒", label: "Locked" }, { icon: "🔒", label: "Locked" }].slice(0, 6).map((b, i) => (
                <div key={i} className={`aspect-square rounded-lg flex flex-col items-center justify-center p-2 ${
                  b.label === "Locked" ? "bg-zinc-900/40 opacity-30" : "bg-gradient-to-br from-violet-500/10 to-transparent border border-violet-500/30"
                }`}>
                  <div className="text-2xl mb-1">{b.icon}</div>
                  <div className="text-[8px] font-mono uppercase tracking-wider text-zinc-400 text-center leading-tight">{b.label}</div>
                </div>
              ))}
            </div>
          </RailCard>

          <RailCard title="Milestones" icon={Sparkles} accent="amber">
            <BotMilestones bot={bot} />
          </RailCard>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, accent = "zinc", big }: any) {
  const colors = { zinc: "text-zinc-100", lime: "text-lime-400", rose: "text-rose-400" };
  return (
    <div className="p-3 rounded-lg bg-black/30 border border-zinc-800 backdrop-blur">
      <div className="text-[9px] uppercase font-mono tracking-widest text-zinc-500">{label}</div>
      <div className={`font-mono font-bold ${big ? "text-2xl" : "text-lg"} ${colors[accent]}`}>{value}</div>
    </div>
  );
}

// ============================================================
// TOURNAMENTS
// ============================================================
function TournamentsView({ tournaments, bots, onOpenBot }: any) {
  const [selected, setSelected] = useState(null);

  if (selected) {
    const contenders = [...bots].sort((a, b) => b.pnl - a.pnl).slice(0, 12);
    return (
      <div>
        <button onClick={() => setSelected(null)} className="text-xs font-mono text-zinc-500 hover:text-lime-400 mb-4 flex items-center gap-1">← all arenas</button>
        <div className="relative overflow-hidden rounded-2xl p-8 mb-6 bg-gradient-to-br from-violet-500/20 via-fuchsia-500/10 to-transparent border border-violet-500/30">
          <div className="absolute inset-0 grid-bg opacity-30"></div>
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded ${selected.status === "live" ? "bg-rose-500/20 text-rose-300" : "bg-zinc-800 text-zinc-400"}`}>
                {selected.status === "live" ? "● LIVE" : "UPCOMING"}
              </span>
              <span className="text-xs font-mono text-zinc-400">{fmt(selected.participants)} bots competing</span>
              <span className="text-xs font-mono text-zinc-400">· ends {selected.endsIn}</span>
            </div>
            <h1 className="font-display text-5xl mb-2">{selected.name}</h1>
            <p className="text-sm text-zinc-400 mb-4">Top bots battle across all markets. Winner takes the {selected.prize}.</p>
            <button className="px-4 py-2 rounded-md bg-violet-500 hover:bg-violet-400 text-white text-sm font-semibold">Enter My Bot</button>
          </div>
        </div>

        <h3 className="font-display text-xl mb-3">Live Rankings</h3>
        <div className="rounded-xl bg-zinc-900/40 border border-zinc-800 overflow-hidden">
          {contenders.map((b, i) => (
            <button key={b.id} onClick={() => onOpenBot(b)} className="w-full grid grid-cols-12 gap-3 px-5 py-3 border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30 text-left items-center">
              <div className="col-span-1 font-mono font-bold">{i < 3 ? ["🥇", "🥈", "🥉"][i] : <span className="text-zinc-500">#{i + 1}</span>}</div>
              <div className="col-span-5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg" style={{ background: gradFromSeed(b.id) }}>{b.emoji}</div>
                <div>
                  <div className="text-sm font-semibold">{b.name}</div>
                  <div className="text-[10px] font-mono text-zinc-500">LVL {b.level} · {b.strategy}</div>
                </div>
              </div>
              <div className="col-span-2 text-right font-mono text-xs text-zinc-400">{b.trades} trades</div>
              <div className="col-span-2 text-right font-mono text-xs text-zinc-400">{(b.winRate * 100).toFixed(0)}% win</div>
              <div className={`col-span-2 text-right font-mono font-bold ${b.pnl >= 0 ? "text-lime-400" : "text-rose-400"}`}>{fmtPct(b.pnl)}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="font-display text-4xl">The <span className="text-violet-400">Arenas</span></h2>
          <p className="text-sm text-zinc-500 mt-1">Weekly tournaments. Unlimited glory. Zero real money.</p>
        </div>
        <button className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-violet-500 hover:bg-violet-400 text-white text-sm font-semibold">
          <Plus className="w-3.5 h-3.5" /> New Arena
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {tournaments.map(t => (
          <button key={t.id} onClick={() => setSelected(t)} className="text-left p-6 rounded-xl bg-gradient-to-br from-zinc-900/60 to-zinc-900/20 border border-zinc-800 hover:border-violet-500/40 transition-all group">
            <div className="flex items-center justify-between mb-3">
              <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded ${
                t.status === "live" ? "bg-rose-500/20 text-rose-300" : "bg-zinc-800 text-zinc-400"
              }`}>
                {t.status === "live" ? "● LIVE" : "UPCOMING"}
              </span>
              <div className="text-xs font-mono text-zinc-500">{t.endsIn}</div>
            </div>
            <h3 className="font-display text-2xl mb-2 group-hover:text-violet-300 transition-colors">{t.name}</h3>
            <div className="text-sm text-zinc-400 mb-4">{t.prize}</div>
            <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {bots.slice(0, 4).map(b => (
                    <div key={b.id} className="w-6 h-6 rounded-full flex items-center justify-center text-xs ring-2 ring-zinc-900" style={{ background: gradFromSeed(b.id) }}>{b.emoji}</div>
                  ))}
                </div>
                <span className="text-xs font-mono text-zinc-400">{fmt(t.participants)} bots</span>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-violet-400 transition-colors" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// CREATE BOT — the money shot
// ============================================================
const STRATEGIES = [
  { key: "trend", label: "Trend Follower", emoji: "🌊", desc: "Ride momentum. Cut losers." },
  { key: "contrarian", label: "Contrarian", emoji: "🐈‍⬛", desc: "Fade the crowd." },
  { key: "news", label: "News Hunter", emoji: "📰", desc: "Trade the headlines." },
  { key: "underdog", label: "Underdog Scout", emoji: "🐕", desc: "Hunt mispriced long shots." },
  { key: "yolo", label: "Degen", emoji: "🔥", desc: "Size up. Send it." },
  { key: "quant", label: "Quant", emoji: "♟️", desc: "Statistical edge only." },
];

const EMOJIS = ["🤖", "🦾", "🧠", "👾", "🎯", "⚡", "🔮", "🦅", "🐉", "🦊", "🐺", "🦁", "🐯", "🦈", "🐙", "🚀", "💎", "🗡️", "🎭", "🎲"];

function CreateBotView({ onCreate, onDone, onCancel }: any) {
  const auth = useAuth();
  const [step, setStep] = useState(1); // 1=config, 2=generating, 3=done
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [strategy, setStrategy] = useState("trend");
  const [risk, setRisk] = useState(3);
  const [emoji, setEmoji] = useState("🤖");
  const [generatedBio, setGeneratedBio] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const createdRef = useRef(null);

  const canSubmit = name.trim().length >= 2;

  // Login gate — can't create a bot without being logged in.
  if (!auth.authenticated) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-lime-400/10 border border-lime-400/30 mb-5">
          <Rocket className="w-7 h-7 text-lime-400" />
        </div>
        <h2 className="font-display text-3xl mb-2">Log in to launch a bot</h2>
        <p className="text-sm text-zinc-400 mb-6 max-w-md mx-auto leading-relaxed">
          Creating a bot is free — just need an account so we know it's yours. Email or Google works.
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={auth.login} className="px-6 py-3 rounded-lg bg-lime-400 hover:bg-lime-300 text-black font-bold text-sm inline-flex items-center gap-2 transition-all hover:scale-[1.01]">
            <LogIn className="w-4 h-4" strokeWidth={2.5} />
            Log in / Sign up
          </button>
          <button onClick={onCancel} className="px-6 py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm font-semibold">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setStep(2);
    const bio = generateBio(prompt, strategy);
    setGeneratedBio(bio);

    // Real API call happens behind the animated progress bar.
    let p = 0;
    const interval = setInterval(() => {
      p += Math.random() * 15 + 5;
      setProgress(Math.min(95, p));  // Cap at 95 so we can "finish" when API returns
    }, 180);

    try {
      const bot = await onCreate({ name: name.trim(), bio, strategy, risk, emoji, strategyPrompt: prompt });
      clearInterval(interval);
      setProgress(100);
      createdRef.current = bot;
      setTimeout(() => setStep(3), 400);
    } catch (err: any) {
      clearInterval(interval);
      setError(err?.message ?? "Couldn't create bot. Try again.");
      setStep(1); // Back to form
    }
  };

  if (step === 2) {
    const stages = [
      { pct: 15, label: "Analyzing strategy prompt...", icon: Brain },
      { pct: 35, label: "Generating personality...", icon: Sparkles },
      { pct: 55, label: "Calibrating risk parameters...", icon: Target },
      { pct: 80, label: "Connecting to market feeds...", icon: Radio },
      { pct: 100, label: "Bot is live!", icon: Rocket },
    ];
    const current = stages.find(s => progress <= s.pct) || stages[stages.length - 1];
    const Icon = current.icon;

    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <div className="relative inline-block mb-8">
          <div className="w-32 h-32 rounded-3xl flex items-center justify-center text-7xl" style={{ background: gradFromSeed(name), animation: "glow 2s ease-in-out infinite" }}>
            {emoji}
          </div>
          <div className="absolute -inset-4 rounded-3xl border-2 border-lime-400/30 animate-pulse"></div>
        </div>
        <h2 className="font-display text-3xl mb-2">Spawning <span className="text-lime-400">{name}</span></h2>
        <div className="flex items-center justify-center gap-2 text-sm text-zinc-400 font-mono mb-6">
          <Icon className="w-4 h-4 text-lime-400" />
          <span>{current.label}</span>
        </div>
        <div className="max-w-sm mx-auto h-2 rounded-full bg-zinc-800 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-lime-500 via-emerald-400 to-lime-300 transition-all duration-200" style={{ width: progress + "%" }}></div>
        </div>
        <div className="mt-3 text-[10px] font-mono text-zinc-600">{progress.toFixed(0)}%</div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="font-display text-4xl mb-2">Your bot is <span className="text-lime-400">live</span>.</h2>
        <p className="text-zinc-400 mb-8">It's already scanning markets. Watch it work.</p>
        <div className="inline-block p-6 rounded-2xl bg-gradient-to-br from-lime-400/10 to-transparent border border-lime-400/30 mb-6">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-3" style={{ background: gradFromSeed(name) }}>
            {emoji}
          </div>
          <div className="font-display text-2xl">{name}</div>
          <div className="text-xs text-zinc-400 italic mt-1 max-w-xs">"{generatedBio}"</div>
        </div>
        <div>
          <button onClick={() => onDone(createdRef.current)} className="px-6 py-2.5 rounded-md bg-lime-400 hover:bg-lime-300 text-black font-bold">
            View Bot Profile →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="font-display text-4xl">Create a <span className="text-lime-400">Bot</span></h2>
          <p className="text-sm text-zinc-500 mt-1">Describe a strategy. We build the rest. Takes 20 seconds.</p>
        </div>
        <button onClick={onCancel} className="text-zinc-500 hover:text-zinc-100"><X className="w-5 h-5" /></button>
      </div>

      <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800 p-6 space-y-6">
        {/* Name + Avatar */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-8">
            <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 block mb-1.5">Bot Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. QuantumQuokka, DegenDecimal..." maxLength={24}
              className="w-full bg-black/40 border border-zinc-800 rounded-lg px-4 py-3 text-lg font-display focus:outline-none focus:border-lime-400/40" />
          </div>
          <div className="col-span-4">
            <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 block mb-1.5">Avatar</label>
            <div className="relative">
              <div className="w-full py-3 px-4 bg-black/40 border border-zinc-800 rounded-lg text-2xl text-center">{emoji}</div>
              <select value={emoji} onChange={e => setEmoji(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
                {EMOJIS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Strategy prompt */}
        <div>
          <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 block mb-1.5">Strategy Prompt <span className="text-zinc-600">(optional, natural language)</span></label>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
            placeholder='e.g. "Bet on underdogs in sports markets. Fade the public. Exit if drawdown exceeds 20%."'
            rows={3}
            className="w-full bg-black/40 border border-zinc-800 rounded-lg px-4 py-3 text-sm font-mono focus:outline-none focus:border-lime-400/40 resize-none" />
        </div>

        {/* Strategy templates */}
        <div>
          <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 block mb-2">Strategy Template</label>
          <div className="grid grid-cols-3 gap-2">
            {STRATEGIES.map(s => (
              <button key={s.key} onClick={() => setStrategy(s.key)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  strategy === s.key ? "bg-lime-400/10 border-lime-400/50 ring-1 ring-lime-400/30" : "bg-black/20 border-zinc-800 hover:border-zinc-700"
                }`}>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-lg">{s.emoji}</span>
                  <span className="text-sm font-semibold">{s.label}</span>
                </div>
                <div className="text-[11px] text-zinc-500">{s.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Risk slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Risk Level</label>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className={`font-bold ${risk <= 2 ? "text-lime-400" : risk <= 3 ? "text-amber-400" : "text-rose-400"}`}>
                {risk === 1 && "Conservative"}
                {risk === 2 && "Cautious"}
                {risk === 3 && "Balanced"}
                {risk === 4 && "Aggressive"}
                {risk === 5 && "Degen"}
              </span>
              <span className="text-zinc-500">· {risk}/5</span>
            </div>
          </div>
          <input type="range" min={1} max={5} value={risk} onChange={e => setRisk(Number(e.target.value))}
            className="w-full h-2 rounded-full bg-zinc-800 appearance-none cursor-pointer accent-lime-400" />
          <div className="flex justify-between mt-1 text-[9px] font-mono text-zinc-600">
            <span>tiny sizes</span><span>measured</span><span>balanced</span><span>bold</span><span>send it</span>
          </div>
        </div>

        {/* CTA */}
        {error && (
          <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 mb-3">
            {error}
          </div>
        )}
        <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
          <div className="text-xs text-zinc-500 font-mono flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-lime-400" />
            spawns in ~20s · $10k virtual bankroll
          </div>
          <button onClick={handleSubmit} disabled={!canSubmit}
            className={`px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
              canSubmit ? "bg-lime-400 hover:bg-lime-300 text-black hover:scale-[1.02]" : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
            }`}>
            <Rocket className="w-4 h-4" strokeWidth={2.5} />
            Launch Bot
          </button>
        </div>
      </div>
    </div>
  );
}

function generateBio(prompt, strategy) {
  if (prompt && prompt.length > 10) {
    const snippets = [
      "A disciplined operator with a nose for opportunity.",
      "Methodical. Slightly unhinged. Mostly correct.",
      "Reads markets like a bedtime story.",
      "Fast fingers, cold logic, warmer vibes.",
      "Finds edges where others find noise.",
      "Trained on chaos. Optimized for calm.",
    ];
    return pick(snippets);
  }
  return getStrategyDescription(strategy);
}

// ============================================================
// ADMIN
// ============================================================
function AdminView({ bots, markets, setBots, setMarkets }: any) {
  const [tab, setTab] = useState("overview");

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-display text-4xl">Admin <span className="text-amber-400">Panel</span></h2>
        <p className="text-sm text-zinc-500 mt-1">Manage markets, bots, and seasons.</p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-zinc-800">
        {[
          { k: "overview", l: "Overview" },
          { k: "markets", l: "Markets" },
          { k: "bots", l: "Bots" },
          { k: "seasons", l: "Seasons" },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              tab === t.k ? "border-amber-400 text-amber-300" : "border-transparent text-zinc-500 hover:text-zinc-100"
            }`}>{t.l}</button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-4 gap-4">
          <AdminStat label="Total Bots" value={bots.length} sub="active" />
          <AdminStat label="Active Markets" value={markets.length} sub="tradeable" />
          <AdminStat label="Total Followers" value={fmt(bots.reduce((s, b) => s + b.followers, 0))} sub="all bots" />
          <AdminStat label="Total Trades" value={fmt(bots.reduce((s, b) => s + b.trades, 0))} sub="lifetime" />
          <div className="col-span-4 mt-6 p-6 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <div className="flex items-start gap-4">
              <Shield className="w-6 h-6 text-amber-400 shrink-0 mt-1" />
              <div>
                <h3 className="font-display text-lg mb-1">Season Controls</h3>
                <p className="text-sm text-zinc-400 mb-3">Reset all bot performance to start a fresh competitive season. Existing bots persist but stats reset to zero.</p>
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold">Start New Season</button>
                  <button className="px-3 py-1.5 rounded-md bg-zinc-800 text-zinc-300 text-xs font-mono">Export Data</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "markets" && (
        <div className="rounded-xl bg-zinc-900/40 border border-zinc-800 overflow-hidden">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <span className="text-sm text-zinc-400 font-mono">{markets.length} markets</span>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 text-black text-xs font-bold">
              <Plus className="w-3 h-3" /> New Market
            </button>
          </div>
          {markets.map(m => (
            <div key={m.id} className="flex items-center gap-4 px-5 py-3 border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30">
              <div className="w-12 text-[10px] font-mono text-zinc-500 uppercase">{m.category}</div>
              <div className="flex-1 text-sm truncate">{m.title}</div>
              <div className="text-xs font-mono text-zinc-400">{fmtPrice(m.yesPrice)}</div>
              <div className="text-xs font-mono text-zinc-400 w-20 text-right">${fmt(m.vol)}</div>
              <button className="text-xs font-mono text-zinc-500 hover:text-amber-400">edit</button>
              <button className="text-xs font-mono text-zinc-500 hover:text-rose-400">resolve</button>
            </div>
          ))}
        </div>
      )}

      {tab === "bots" && (
        <div className="rounded-xl bg-zinc-900/40 border border-zinc-800 overflow-hidden">
          <div className="p-4 border-b border-zinc-800 text-sm text-zinc-400 font-mono">{bots.length} bots registered</div>
          {bots.slice(0, 20).map(b => (
            <div key={b.id} className="flex items-center gap-3 px-5 py-2.5 border-b border-zinc-800/50 last:border-0">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-base" style={{ background: gradFromSeed(b.id) }}>{b.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{b.name}</div>
                <div className="text-[10px] font-mono text-zinc-500">{b.strategy} · LVL {b.level}</div>
              </div>
              <span className={`text-xs font-mono font-bold ${b.pnl >= 0 ? "text-lime-400" : "text-rose-400"}`}>{fmtPct(b.pnl)}</span>
              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${b.active ? "bg-lime-400/15 text-lime-300" : "bg-zinc-800 text-zinc-400"}`}>{b.active ? "ACTIVE" : "PAUSED"}</span>
              <button className="text-xs font-mono text-zinc-500 hover:text-amber-400">edit</button>
              <button className="text-xs font-mono text-zinc-500 hover:text-rose-400">disable</button>
            </div>
          ))}
        </div>
      )}

      {tab === "seasons" && (
        <div className="p-6 rounded-xl bg-zinc-900/40 border border-zinc-800">
          <h3 className="font-display text-xl mb-2">Season 1: Genesis</h3>
          <p className="text-sm text-zinc-400 mb-4">Started 14 days ago · 847 participating bots · ends in 16 days</p>
          <div className="h-2 rounded-full bg-zinc-800 overflow-hidden mb-6">
            <div className="h-full bg-gradient-to-r from-amber-500 to-lime-400" style={{ width: "46%" }}></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <MiniStat label="Total Volume" value={"$" + fmt(Math.floor(randBetween(8000000, 15000000)))} />
            <MiniStat label="Resolved Markets" value="23" />
            <MiniStat label="Bots Leveled Up" value="340" />
          </div>
        </div>
      )}
    </div>
  );
}

function AdminStat({ label, value, sub }: any) {
  return (
    <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800">
      <div className="text-[10px] uppercase tracking-widest font-mono text-zinc-500">{label}</div>
      <div className="text-2xl font-display font-bold mt-1">{value}</div>
      <div className="text-[10px] font-mono text-zinc-600 mt-0.5">{sub}</div>
    </div>
  );
}
