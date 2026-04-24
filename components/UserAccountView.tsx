"use client";

// ============================================================
// UserAccountView — logged-in user's dashboard.
// Shows bots created, bots backed, portfolio value, activity.
// ============================================================

import React, { useMemo } from "react";
import { Bot as BotIcon, Flame, TrendingUp, TrendingDown, DollarSign, Rocket, Users, LogIn } from "lucide-react";
import { useAppState } from "./AppStateContext";
import { useMe } from "./api";

const fmt = (n: number): string => {
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return n.toFixed(0);
};
const fmtPct = (n: number) => (n >= 0 ? "+" : "") + (n * 100).toFixed(1) + "%";
const gradFromSeed = (seed: string): string => {
  const s = String(seed || "default");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return `linear-gradient(135deg, hsl(${h}, 85%, 55%), hsl(${(h + 60) % 360}, 90%, 50%))`;
};
const timeAgo = (t: number) => {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return s + "s";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  return Math.floor(s / 86400) + "d";
};

interface UserAccountViewProps {
  bots: any[];
  authed: boolean;
  displayName: string;
  walletAddr?: string;
  email?: string;
  onLogin: () => void;
  onOpenBot: (bot: any) => void;
  onCreateBot: () => void;
  onOpenBack: (bot: any) => void;
}

export function UserAccountView({
  bots, authed, displayName, walletAddr, email,
  onLogin, onOpenBot, onCreateBot, onOpenBack,
}: UserAccountViewProps) {
  const { notifications } = useAppState();
  const { me, loading } = useMe();

  // API gives us: me.myBots (bots I own), me.backings (bots I'm backing), me.portfolio (totals)
  const myBots = me?.myBots ?? [];
  const backedBots = (me?.backings ?? []).map((b: any) => b.bot);
  const backings: Record<string, { amount: number; backedAt: number }> = useMemo(() => {
    const m: Record<string, { amount: number; backedAt: number }> = {};
    (me?.backings ?? []).forEach((b: any) => {
      m[b.botId] = { amount: b.amount, backedAt: b.backedAt };
    });
    return m;
  }, [me]);

  const totalBackedCapital = me?.portfolio?.totalBackedCapital ?? 0;
  const portfolioValue = me?.portfolio?.portfolioValue ?? 0;
  const portfolioPnl = me?.portfolio?.portfolioPnl ?? 0;
  const portfolioPct = me?.portfolio?.portfolioPct ?? 0;

  if (!authed) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 mb-5">
          <LogIn className="w-7 h-7 text-lime-400" />
        </div>
        <h2 className="font-display text-3xl mb-2">Log in to your account</h2>
        <p className="text-sm text-zinc-400 mb-6 max-w-md mx-auto leading-relaxed">
          Track your bots, see everything you've backed, and watch your simulated portfolio grow.
        </p>
        <button
          onClick={onLogin}
          className="px-6 py-3 rounded-lg bg-lime-400 hover:bg-lime-300 text-black font-bold text-sm inline-flex items-center gap-2 transition-all hover:scale-[1.01]"
        >
          <LogIn className="w-4 h-4" strokeWidth={2.5} />
          Log in / Sign up
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-3xl font-bold text-white">
          {displayName.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <h1 className="font-display text-3xl">{displayName}</h1>
          <div className="text-xs font-mono text-zinc-500">{email}</div>
          {walletAddr && <div className="text-[10px] font-mono text-zinc-600 mt-0.5">{walletAddr}</div>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard label="Bots Created" value={myBots.length} icon={BotIcon} accent="lime" />
        <StatCard label="Bots Backed" value={backedBots.length} icon={Flame} accent="rose" />
        <StatCard label="Capital Deployed" value={`$${fmt(totalBackedCapital)}`} icon={DollarSign} accent="amber" />
        <StatCard
          label="Portfolio Value"
          value={`$${fmt(portfolioValue)}`}
          sub={totalBackedCapital > 0 ? fmtPct(portfolioPct) : undefined}
          subColor={portfolioPnl >= 0 ? "lime" : "rose"}
          icon={TrendingUp}
          accent="violet"
        />
      </div>

      {/* My Bots */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl">My Bots</h2>
          <button
            onClick={onCreateBot}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-lime-400 hover:bg-lime-300 text-black text-xs font-bold"
          >
            <Rocket className="w-3.5 h-3.5" strokeWidth={2.5} />
            Launch Bot
          </button>
        </div>
        {myBots.length === 0 ? (
          <EmptyState
            emoji="🤖"
            title="You haven't launched a bot yet"
            body="Spin up your first trading bot in 20 seconds. Pick a strategy, give it a name, and watch it compete."
            cta="Launch My First Bot"
            onCta={onCreateBot}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {myBots.map(b => <MiniBotCard key={b.id} bot={b} onOpen={() => onOpenBot(b)} />)}
          </div>
        )}
      </section>

      {/* Backed Bots */}
      <section className="mb-8">
        <h2 className="font-display text-xl mb-3">Bots You're Backing</h2>
        {backedBots.length === 0 ? (
          <EmptyState
            emoji="🔥"
            title="You haven't backed any bots yet"
            body="Find a winner on the leaderboard and back them with virtual capital. Their gains become yours."
            cta="Browse Leaderboard"
            onCta={() => { /* handled by parent */ }}
          />
        ) : (
          <div className="space-y-2">
            {backedBots.map(b => b && (
              <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700">
                <button onClick={() => onOpenBot(b)} className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0" style={{ background: gradFromSeed(b.id) }}>
                  {b.emoji}
                </button>
                <button onClick={() => onOpenBot(b)} className="flex-1 text-left min-w-0">
                  <div className="text-sm font-semibold truncate">{b.name}</div>
                  <div className="text-[10px] font-mono text-zinc-500">
                    backed <span className="text-zinc-300">${fmt(backings[b.id].amount)}</span> · {timeAgo(backings[b.id].backedAt)} ago
                  </div>
                </button>
                <div className="text-right">
                  <div className={`text-sm font-mono font-bold ${b.pnl >= 0 ? "text-lime-400" : "text-rose-400"}`}>
                    {fmtPct(b.pnl)}
                  </div>
                  <div className="text-[10px] font-mono text-zinc-500">
                    ≈ ${fmt(backings[b.id].amount * (1 + b.pnl))}
                  </div>
                </div>
                <button
                  onClick={() => onOpenBack(b)}
                  className="px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-lime-400/15 text-lime-300 hover:bg-lime-400/25"
                >
                  Top up
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent Activity */}
      <section>
        <h2 className="font-display text-xl mb-3">Recent Activity</h2>
        {notifications.length === 0 ? (
          <div className="text-xs text-zinc-500 font-mono py-6 text-center border border-zinc-800 rounded-lg bg-zinc-900/40">
            No activity yet. Launch a bot or back one to see updates here.
          </div>
        ) : (
          <div className="space-y-1.5">
            {notifications.slice(0, 8).map(n => (
              <div key={n.id} className="flex items-center gap-3 p-2 rounded-md bg-zinc-900/40 border border-zinc-800">
                {n.botEmoji && (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm" style={{ background: gradFromSeed(n.botId || "x") }}>
                    {n.botEmoji}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-zinc-200 truncate">{n.title}</div>
                  {n.body && <div className="text-[10px] text-zinc-500 truncate">{n.body}</div>}
                </div>
                <div className="text-[10px] font-mono text-zinc-500">{timeAgo(n.timestamp)}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ------------------ Subcomponents ------------------

function StatCard({ label, value, sub, subColor, icon: Icon, accent }: any) {
  const colors: Record<string, string> = {
    lime: "text-lime-400 border-lime-400/25 from-lime-400/10",
    rose: "text-rose-400 border-rose-400/25 from-rose-400/10",
    amber: "text-amber-400 border-amber-400/25 from-amber-400/10",
    violet: "text-violet-400 border-violet-400/25 from-violet-400/10",
  };
  return (
    <div className={`p-4 rounded-xl border bg-gradient-to-br ${colors[accent]} to-transparent`}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-[9px] uppercase font-mono tracking-widest text-zinc-400">{label}</div>
        <Icon className={`w-3.5 h-3.5 ${colors[accent].split(" ")[0]}`} />
      </div>
      <div className="font-display text-2xl font-bold tabular-nums">{value}</div>
      {sub && (
        <div className={`text-[10px] font-mono font-bold mt-0.5 ${subColor === "lime" ? "text-lime-400" : "text-rose-400"}`}>
          {sub}
        </div>
      )}
    </div>
  );
}

function MiniBotCard({ bot, onOpen }: { bot: any; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="text-left p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 hover:border-lime-400/40 transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-base" style={{ background: gradFromSeed(bot.id) }}>{bot.emoji}</div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">{bot.name}</div>
          <div className="text-[10px] font-mono text-zinc-500">LVL {bot.level} · {bot.trades} trades</div>
        </div>
      </div>
      <div className={`text-lg font-mono font-bold ${bot.pnl >= 0 ? "text-lime-400" : "text-rose-400"}`}>
        {fmtPct(bot.pnl)}
      </div>
    </button>
  );
}

function EmptyState({ emoji, title, body, cta, onCta }: any) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 p-8 text-center">
      <div className="text-4xl mb-2">{emoji}</div>
      <div className="font-display text-base mb-1">{title}</div>
      <p className="text-xs text-zinc-500 max-w-sm mx-auto mb-4">{body}</p>
      <button
        onClick={onCta}
        className="px-4 py-2 rounded-md bg-lime-400 hover:bg-lime-300 text-black text-xs font-bold"
      >
        {cta}
      </button>
    </div>
  );
}
