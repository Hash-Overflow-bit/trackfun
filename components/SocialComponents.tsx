"use client";

// ============================================================
// Social components: BackModal, NotificationCenter, Onboarding, ToastStack.
// All shared via AppStateContext. Pure UI — logic lives in the context.
// ============================================================

import React, { useEffect, useState } from "react";
import {
  X, Flame, Rocket, Zap, Crown, Skull, Brain, Trophy, Users,
  Check, ChevronRight, Bell, Sparkles, AlertCircle, Bot as BotIcon
} from "lucide-react";
import { useAppState } from "./AppStateContext";
import { TrackFunLogo } from "./TrackFunLogo";

const fmt = (n: number): string => {
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return n.toFixed(0);
};

const gradFromSeed = (seed: string): string => {
  const s = String(seed || "default");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  const h2 = (h + 60) % 360;
  return `linear-gradient(135deg, hsl(${h}, 85%, 55%), hsl(${h2}, 90%, 50%))`;
};

const timeAgo = (t: number): string => {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return s + "s";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  return Math.floor(s / 86400) + "d";
};

// ============================================================
// BACK BOT MODAL
// ============================================================
interface BackModalProps {
  bot: any | null;
  onClose: () => void;
  authed?: boolean;
  onLogin?: () => void;
}
export function BackModal({ bot, onClose, authed = true, onLogin }: BackModalProps) {
  const { backBot, getMyBackedAmount } = useAppState();
  const [amount, setAmount] = useState<number>(100);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  if (!bot) return null;

  const existingBacked = getMyBackedAmount(bot.id);
  const quickAmounts = [50, 100, 500, 1000];

  const handleConfirm = async () => {
    setError(null);
    setConfirming(true);
    try {
      await backBot(bot.id, amount);
      setDone(true);
      setTimeout(onClose, 1400);
    } catch (err: any) {
      setError(err?.message ?? "Couldn't complete backing. Try again.");
      setConfirming(false);
    }
  };

  const pnlColor = bot.pnl >= 0 ? "text-lime-400" : "text-rose-400";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[440px] rounded-2xl bg-[#0f0f10] border border-zinc-800 shadow-2xl shadow-black/80 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "modal-pop 0.3s cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        {/* Header */}
        <div className="relative overflow-hidden border-b border-zinc-800">
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-lime-400/20 blur-3xl pointer-events-none"></div>
          <button onClick={onClose} className="absolute top-3 right-3 p-1 text-zinc-500 hover:text-zinc-200 z-10">
            <X className="w-4 h-4" />
          </button>
          <div className="relative p-5">
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-4 h-4 text-rose-400" />
              <span className="text-[10px] font-mono font-black uppercase tracking-widest text-rose-300">Back This Bot</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl ring-2 ring-zinc-900" style={{ background: gradFromSeed(bot.id) }}>
                {bot.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-xl leading-tight">{bot.name}</div>
                <div className="text-xs text-zinc-400 italic font-serif-i line-clamp-1">"{bot.bio}"</div>
                <div className="flex items-center gap-2 mt-1 text-[10px] font-mono">
                  <span className={`font-bold ${pnlColor}`}>
                    {bot.pnl >= 0 ? "+" : ""}{(bot.pnl * 100).toFixed(1)}% return
                  </span>
                  <span className="text-zinc-600">·</span>
                  <span className="text-zinc-400">LVL {bot.level}</span>
                  <span className="text-zinc-600">·</span>
                  <span className="text-zinc-400">{(bot.winRate * 100).toFixed(0)}% win rate</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {done ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-lime-400/20 flex items-center justify-center">
              <Check className="w-8 h-8 text-lime-400" strokeWidth={3} />
            </div>
            <div className="font-display text-xl">Backed!</div>
            <div className="text-xs text-zinc-500 mt-1">You're in with ${fmt(amount)} on {bot.name}.</div>
          </div>
        ) : !authed ? (
          <div className="p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-lime-400/10 border border-lime-400/30 mb-3">
              <Flame className="w-6 h-6 text-lime-400" />
            </div>
            <div className="font-display text-lg mb-1">Log in to back bots</div>
            <p className="text-xs text-zinc-400 mb-5">Takes 10 seconds. Email or Google works.</p>
            <button
              onClick={() => { onLogin?.(); onClose(); }}
              className="w-full py-3 rounded-lg bg-lime-400 hover:bg-lime-300 text-black text-sm font-bold"
            >
              Log in / Sign up
            </button>
          </div>
        ) : (
          <div className="p-5">
            {/* Amount selector */}
            <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 block mb-2">Backing Amount</label>
            <div className="relative mb-3">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-lg">$</span>
              <input
                type="number"
                min={10}
                value={amount}
                onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
                className="w-full bg-black/40 border border-zinc-800 rounded-lg pl-7 pr-4 py-3 text-2xl font-display font-bold focus:outline-none focus:border-lime-400/40"
              />
            </div>
            <div className="grid grid-cols-4 gap-2 mb-5">
              {quickAmounts.map(a => (
                <button
                  key={a}
                  onClick={() => setAmount(a)}
                  className={`py-1.5 rounded-md text-xs font-mono font-bold transition-all ${
                    amount === a ? "bg-lime-400 text-black" : "bg-zinc-900 hover:bg-zinc-800 text-zinc-300"
                  }`}
                >
                  ${a}
                </button>
              ))}
            </div>

            {/* Preview */}
            <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 mb-5 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Your allocation</span>
                <span className="font-mono font-bold text-zinc-100">${fmt(amount)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Mirrors {bot.name}'s trades</span>
                <span className="font-mono text-lime-400">1:1</span>
              </div>
              {existingBacked > 0 && (
                <div className="flex justify-between text-xs pt-1.5 border-t border-zinc-800">
                  <span className="text-zinc-500">Already backed</span>
                  <span className="font-mono text-zinc-300">${fmt(existingBacked)}</span>
                </div>
              )}
              {existingBacked > 0 && (
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-zinc-300">New total</span>
                  <span className="font-mono text-lime-400">${fmt(existingBacked + amount)}</span>
                </div>
              )}
            </div>

            {error && (
              <div className="mb-3 p-2.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                {error}
              </div>
            )}

            <button
              onClick={handleConfirm}
              disabled={amount < 10 || confirming}
              className={`w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                amount >= 10 && !confirming
                  ? "bg-lime-400 hover:bg-lime-300 text-black hover:scale-[1.01]"
                  : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
              }`}
            >
              {confirming ? (
                <><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Confirming…</>
              ) : (
                <><Flame className="w-4 h-4" /> Back with ${fmt(amount)}</>
              )}
            </button>

            <p className="text-[10px] text-zinc-600 text-center mt-3 leading-relaxed">
              Simulated backing. No real money. You can unback anytime.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// NOTIFICATION CENTER (dropdown)
// ============================================================
interface NotificationCenterProps {
  open: boolean;
  onClose: () => void;
  onOpenBot: (botName: string) => void;
}
export function NotificationCenter({ open, onClose, onOpenBot }: NotificationCenterProps) {
  const { notifications, markAllRead, clearNotifications } = useAppState();

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return;
      if (e.target.closest("[data-notif-dropdown]")) return;
      if (e.target.closest("[data-notif-trigger]")) return;
      onClose();
    };
    window.addEventListener("click", h);
    return () => window.removeEventListener("click", h);
  }, [open, onClose]);

  // Mark read when opened
  useEffect(() => {
    if (open) {
      const t = setTimeout(markAllRead, 800);
      return () => clearTimeout(t);
    }
  }, [open, markAllRead]);

  if (!open) return null;

  return (
    <div
      data-notif-dropdown
      className="absolute right-0 top-full mt-2 w-[380px] max-w-[92vw] rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl shadow-black/80 overflow-hidden z-50 animate-slide-in"
    >
      <div className="flex items-center justify-between p-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-lime-400" />
          <span className="font-display text-sm">Notifications</span>
          {notifications.length > 0 && (
            <span className="text-[10px] font-mono text-zinc-500">{notifications.length}</span>
          )}
        </div>
        {notifications.length > 0 && (
          <button onClick={clearNotifications} className="text-[10px] font-mono text-zinc-500 hover:text-rose-400 uppercase tracking-wider">Clear all</button>
        )}
      </div>

      <div className="max-h-[440px] overflow-y-auto scrollbar-thin">
        {notifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="w-8 h-8 mx-auto mb-2 text-zinc-700" />
            <div className="text-sm text-zinc-400 font-medium">All caught up</div>
            <div className="text-xs text-zinc-600 mt-1">Launch a bot or back one to get started.</div>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {notifications.map(n => <NotificationRow key={n.id} n={n} onOpenBot={onOpenBot} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function NotificationRow({ n, onOpenBot }: { n: any; onOpenBot: (name: string) => void }) {
  const kindConfig: Record<string, { icon: any; color: string; accent: string }> = {
    bot_launched: { icon: Rocket, color: "text-lime-400", accent: "border-l-lime-400" },
    promotion: { icon: Zap, color: "text-amber-400", accent: "border-l-amber-400" },
    big_win: { icon: Flame, color: "text-rose-400", accent: "border-l-rose-400" },
    big_loss: { icon: Skull, color: "text-rose-500", accent: "border-l-rose-500" },
    arena_starting: { icon: Trophy, color: "text-violet-400", accent: "border-l-violet-400" },
    follower_milestone: { icon: Users, color: "text-sky-400", accent: "border-l-sky-400" },
    back_confirmed: { icon: Check, color: "text-lime-400", accent: "border-l-lime-400" },
  };
  const cfg = kindConfig[n.kind] ?? kindConfig.bot_launched;
  const Icon = cfg.icon;

  return (
    <button
      onClick={() => n.botName && onOpenBot(n.botName)}
      className={`w-full text-left p-3 hover:bg-zinc-800/40 transition-colors border-l-2 ${cfg.accent} ${n.read ? "opacity-75" : ""}`}
    >
      <div className="flex items-start gap-2.5">
        {n.botEmoji ? (
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0" style={{ background: gradFromSeed(n.botId || n.botName || "x") }}>
            {n.botEmoji}
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
            <Icon className={`w-4 h-4 ${cfg.color}`} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs font-semibold text-zinc-100 leading-snug">{n.title}</div>
            <span className="text-[10px] font-mono text-zinc-600 shrink-0">{timeAgo(n.timestamp)}</span>
          </div>
          {n.body && <div className="text-[11px] text-zinc-500 mt-0.5 leading-snug">{n.body}</div>}
        </div>
        {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-lime-400 mt-1.5 shrink-0"></div>}
      </div>
    </button>
  );
}

// ============================================================
// TOAST STACK
// ============================================================
export function ToastStack() {
  const { toasts, dismissToast } = useAppState();

  return (
    <div className="fixed bottom-4 right-4 z-[90] flex flex-col gap-2 max-w-sm">
      {toasts.map(t => {
        const kindConfig: Record<string, { icon: any; color: string; bg: string }> = {
          bot_launched: { icon: Rocket, color: "text-lime-300", bg: "from-lime-500/15" },
          promotion: { icon: Zap, color: "text-amber-300", bg: "from-amber-500/15" },
          big_win: { icon: Flame, color: "text-rose-300", bg: "from-rose-500/15" },
          big_loss: { icon: Skull, color: "text-rose-400", bg: "from-rose-500/20" },
          arena_starting: { icon: Trophy, color: "text-violet-300", bg: "from-violet-500/15" },
          follower_milestone: { icon: Users, color: "text-sky-300", bg: "from-sky-500/15" },
          back_confirmed: { icon: Check, color: "text-lime-300", bg: "from-lime-500/15" },
        };
        const cfg = kindConfig[t.kind] ?? kindConfig.bot_launched;
        const Icon = cfg.icon;
        return (
          <div
            key={t.id}
            className={`relative overflow-hidden rounded-xl border border-zinc-700 bg-gradient-to-br ${cfg.bg} to-zinc-900 backdrop-blur-xl shadow-xl shadow-black/40 animate-slide-in`}
            style={{ animation: "toast-in 0.35s cubic-bezier(0.22, 1, 0.36, 1)" }}
          >
            <div className="flex items-start gap-2.5 p-3 pr-8">
              {t.botEmoji ? (
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0 bg-black/40">
                  {t.botEmoji}
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center shrink-0">
                  <Icon className={`w-4 h-4 ${cfg.color}`} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-zinc-100 leading-snug">{t.title}</div>
                {t.body && <div className="text-[11px] text-zinc-400 mt-0.5 leading-snug">{t.body}</div>}
              </div>
            </div>
            <button onClick={() => dismissToast(t.id)} className="absolute top-2 right-2 p-1 text-zinc-600 hover:text-zinc-300">
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// ONBOARDING
// ============================================================
interface OnboardingProps {
  onLaunchBot: () => void;
}
export function Onboarding({ onLaunchBot }: OnboardingProps) {
  const { hasOnboarded, setHasOnboarded } = useAppState();
  const [step, setStep] = useState(0);

  if (hasOnboarded) return null;

  const steps = [
    {
      icon: BotIcon,
      emoji: "🤖",
      title: "Welcome to Track.fun",
      body: "Train AI bots to predict real-world events. Compete on leaderboards. Back the bots you believe in.",
      cta: "Get started",
    },
    {
      icon: Rocket,
      emoji: "🚀",
      title: "1. Launch a bot in 20 seconds",
      body: "Name it, pick a strategy, send it. Your bot starts trading immediately on live Polymarket odds.",
      cta: "Next",
    },
    {
      icon: Brain,
      emoji: "🧠",
      title: "2. Bots trade automatically",
      body: "Your bot scans markets 24/7. Every trade is paper-traded — no real money, all competitive glory.",
      cta: "Next",
    },
    {
      icon: Flame,
      emoji: "🔥",
      title: "3. Back top bots & climb",
      body: "Follow winners, back them with virtual capital, and watch them tear up the leaderboard.",
      cta: "Launch My First Bot",
    },
  ];
  const s = steps[step];
  const isLast = step === steps.length - 1;

  const finish = () => {
    setHasOnboarded(true);
    if (isLast) onLaunchBot();
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
      <div
        className="relative w-full max-w-[460px] rounded-2xl bg-[#0f0f10] border border-zinc-800 shadow-2xl shadow-black/80 overflow-hidden"
        style={{ animation: "modal-pop 0.35s cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        <div className="absolute -inset-1 rounded-2xl pointer-events-none" style={{
          background: "radial-gradient(ellipse at top, rgba(190, 255, 0, 0.15) 0%, transparent 50%)",
        }}></div>
        <button onClick={() => setHasOnboarded(true)} className="absolute top-3 right-3 text-[10px] font-mono uppercase tracking-wider text-zinc-600 hover:text-zinc-300 z-10">Skip</button>

        <div className="relative p-8 text-center">
          {/* Progress dots */}
          <div className="flex justify-center gap-1.5 mb-6">
            {steps.map((_, i) => (
              <div key={i} className={`h-1 rounded-full transition-all ${
                i === step ? "w-8 bg-lime-400" : i < step ? "w-4 bg-lime-400/50" : "w-4 bg-zinc-700"
              }`}></div>
            ))}
          </div>

          {step === 0 ? (
            <div className="mb-6 flex justify-center">
              <TrackFunLogo variant="full" height={96} />
            </div>
          ) : (
            <div className="text-6xl mb-4" style={{ animation: "pulse-dot 2s ease-in-out infinite" }}>{s.emoji}</div>
          )}
          <h2 className="font-display text-2xl mb-2">{s.title}</h2>
          <p className="text-sm text-zinc-400 leading-relaxed mb-6">{s.body}</p>

          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm font-semibold"
              >
                Back
              </button>
            )}
            <button
              onClick={isLast ? finish : () => setStep(step + 1)}
              className="flex-1 py-2.5 rounded-lg bg-lime-400 hover:bg-lime-300 text-black text-sm font-bold flex items-center justify-center gap-1.5 transition-all hover:scale-[1.01]"
            >
              {isLast ? <Rocket className="w-4 h-4" strokeWidth={2.5} /> : null}
              {s.cta}
              {!isLast && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// BOT MILESTONES (for profile page)
// ============================================================
export function BotMilestones({ bot }: { bot: any }) {
  // Derive milestones from bot state. In production this comes from a DB.
  const milestones: Array<{ icon: string; label: string; when: string; unlocked: boolean }> = [
    { icon: "🌱", label: "Launched", when: timeAgo(bot.createdAt) + " ago", unlocked: true },
    { icon: "🎯", label: "First profitable trade", when: "2d ago", unlocked: bot.trades > 3 },
    { icon: "💎", label: "Hit +10% return", when: timeAgo(bot.createdAt - 86400000 * 2) + " ago", unlocked: bot.pnl > 0.1 },
    { icon: "⚡", label: "Promoted to Pro", when: "1d ago", unlocked: bot.pnl > 0.5 },
    { icon: "🚀", label: "Hit +100% return", when: "today", unlocked: bot.pnl > 1 },
    { icon: "👑", label: "Top 1% of all bots", when: "locked", unlocked: bot.pnl > 1.5 },
  ];

  return (
    <div className="space-y-2">
      {milestones.map((m, i) => (
        <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg ${
          m.unlocked ? "bg-zinc-900/60 border border-zinc-800" : "bg-zinc-900/20 border border-zinc-800/50 opacity-40"
        }`}>
          <div className="text-xl">{m.icon}</div>
          <div className="flex-1">
            <div className="text-sm font-medium text-zinc-200">{m.label}</div>
            <div className="text-[10px] font-mono text-zinc-500">{m.when}</div>
          </div>
          {m.unlocked ? (
            <Check className="w-4 h-4 text-lime-400" strokeWidth={2.5} />
          ) : (
            <div className="text-[10px] font-mono text-zinc-600">🔒</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// BOT STATUS BADGE
// ============================================================
export function BotStatusBadge({ bot }: { bot: any }) {
  // Prefer the DB status field; fall back to pnl-derived for older data.
  let status: { label: string; emoji: string; color: string } | null = null;
  if (bot.status === "pro" || bot.pnl > 1.5) {
    status = bot.pnl > 1.5
      ? { label: "Elite", emoji: "👑", color: "bg-gradient-to-r from-amber-400 to-rose-400 text-black" }
      : { label: "Pro", emoji: "⚡", color: "bg-gradient-to-r from-amber-400 to-orange-500 text-black" };
  } else if (bot.status === "rising" || bot.pnl > 0.3) {
    status = { label: "Rising", emoji: "📈", color: "bg-amber-500/15 text-amber-300 border border-amber-500/40" };
  } else if (bot.pnl < -0.15) {
    status = { label: "Struggling", emoji: "📉", color: "bg-zinc-800 text-zinc-400 border border-zinc-700" };
  }

  if (!status) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${status.color}`}>
      <span>{status.emoji}</span>
      {status.label}
    </span>
  );
}

// ============================================================
// BACKED CAPITAL DISPLAY (for bot cards and profile)
// ============================================================
export function BackedCapital({ botId, variant = "inline" }: { botId: string; variant?: "inline" | "big" }) {
  const { getPlatformBackedAmount, getBackerCount } = useAppState();
  const total = getPlatformBackedAmount(botId);
  const count = getBackerCount(botId);

  if (total === 0) return null;

  if (variant === "big") {
    return (
      <div className="p-3 rounded-lg bg-black/30 border border-zinc-800">
        <div className="text-[9px] uppercase font-mono tracking-widest text-zinc-500">Total Backed</div>
        <div className="font-mono font-bold text-2xl text-lime-300">${fmt(total)}</div>
        <div className="text-[10px] font-mono text-zinc-500 mt-0.5">{fmt(count)} backers</div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-[10px] font-mono">
      <Flame className="w-2.5 h-2.5 text-rose-400" />
      <span className="text-rose-300 font-bold">${fmt(total)}</span>
      <span className="text-zinc-500">· {fmt(count)} backing</span>
    </div>
  );
}
