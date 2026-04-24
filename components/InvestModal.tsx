"use client";

// ============================================================
// InvestModal — real-capital investment flow (Pro bots only).
//
// Distinct from BackModal (which is fantasy/social).
// This flow:
//   - Requires auth + sufficient balance
//   - Shows entry fee breakdown
//   - Calls /api/investments
//   - Links to deposit flow if balance is low
// ============================================================

import React, { useEffect, useState } from "react";
import { X, Flame, Check, DollarSign, AlertCircle, TrendingUp, Plus } from "lucide-react";
import { useBalance, useInvestments } from "./api";

const ENTRY_FEE_PCT = 0.015;

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
  return `linear-gradient(135deg, hsl(${h}, 85%, 55%), hsl(${(h + 60) % 360}, 90%, 50%))`;
};

interface InvestModalProps {
  bot: any | null;
  authed: boolean;
  onLogin: () => void;
  onClose: () => void;
  onDepositClick: () => void;
}

export function InvestModal({ bot, authed, onLogin, onClose, onDepositClick }: InvestModalProps) {
  const { balance, refetch: refetchBalance } = useBalance();
  const { invest } = useInvestments();
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

  const entryFee = amount * ENTRY_FEE_PCT;
  const principal = amount - entryFee;
  const available = balance?.available ?? 0;
  const canAfford = authed && amount <= available && amount >= 10;

  const handleConfirm = async () => {
    setError(null);
    setConfirming(true);
    try {
      await invest(bot.id, amount);
      await refetchBalance();
      setDone(true);
      setTimeout(onClose, 1400);
    } catch (err: any) {
      setError(err?.message ?? "Investment failed");
      setConfirming(false);
    }
  };

  const quickAmounts = [100, 500, 1000, 5000];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[480px] rounded-2xl bg-[#0f0f10] border border-zinc-800 shadow-2xl shadow-black/80 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "modal-pop 0.3s cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        {/* Header */}
        <div className="relative overflow-hidden border-b border-zinc-800">
          <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-amber-400/20 blur-3xl pointer-events-none"></div>
          <button onClick={onClose} className="absolute top-3 right-3 p-1 text-zinc-500 hover:text-zinc-200 z-10">
            <X className="w-4 h-4" />
          </button>
          <div className="relative p-5">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4 text-amber-400" />
              <span className="text-[10px] font-mono font-black uppercase tracking-widest text-amber-300">
                Invest Real Capital · PRO Bot
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl ring-2 ring-zinc-900" style={{ background: gradFromSeed(bot.id) }}>
                {bot.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-xl leading-tight flex items-center gap-2">
                  {bot.name}
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gradient-to-r from-amber-400 to-orange-500 text-black">
                    PRO
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-[10px] font-mono">
                  <span className={`font-bold ${bot.pnl >= 0 ? "text-lime-400" : "text-rose-400"}`}>
                    {bot.pnl >= 0 ? "+" : ""}{(bot.pnl * 100).toFixed(1)}% track record
                  </span>
                  <span className="text-zinc-600">·</span>
                  <span className="text-zinc-400">{bot.trades ?? 0} trades</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {done ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-amber-400/20 flex items-center justify-center">
              <Check className="w-8 h-8 text-amber-400" strokeWidth={3} />
            </div>
            <div className="font-display text-xl">Invested!</div>
            <div className="text-xs text-zinc-500 mt-1">${fmt(principal)} is now working on {bot.name}.</div>
          </div>
        ) : !authed ? (
          <div className="p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-400/10 border border-amber-400/30 mb-3">
              <DollarSign className="w-6 h-6 text-amber-400" />
            </div>
            <div className="font-display text-lg mb-1">Log in to invest</div>
            <p className="text-xs text-zinc-400 mb-5">
              Investing requires an account so we can track your portfolio.
            </p>
            <button
              onClick={() => { onLogin(); onClose(); }}
              className="w-full py-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-black text-sm font-bold"
            >
              Log in / Sign up
            </button>
          </div>
        ) : (
          <div className="p-5">
            {/* Balance strip */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 mb-4">
              <div>
                <div className="text-[9px] uppercase font-mono tracking-widest text-zinc-500">Available</div>
                <div className="font-mono font-bold text-sm text-zinc-100">${fmt(available)}</div>
              </div>
              <button
                onClick={() => { onDepositClick(); onClose(); }}
                className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-lime-400/15 text-lime-300 hover:bg-lime-400/25 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add funds
              </button>
            </div>

            {/* Amount */}
            <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 block mb-2">Investment Amount</label>
            <div className="relative mb-3">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-lg">$</span>
              <input
                type="number"
                min={10}
                value={amount}
                onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
                className="w-full bg-black/40 border border-zinc-800 rounded-lg pl-7 pr-4 py-3 text-2xl font-display font-bold focus:outline-none focus:border-amber-400/40"
              />
            </div>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {quickAmounts.map(a => (
                <button
                  key={a}
                  onClick={() => setAmount(a)}
                  className={`py-1.5 rounded-md text-xs font-mono font-bold transition-all ${
                    amount === a ? "bg-amber-400 text-black" : "bg-zinc-900 hover:bg-zinc-800 text-zinc-300"
                  }`}
                >
                  ${fmt(a)}
                </button>
              ))}
            </div>

            {/* Breakdown */}
            <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 mb-4 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Your contribution</span>
                <span className="font-mono text-zinc-100">${fmt(amount)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Platform fee (1.5%)</span>
                <span className="font-mono text-rose-300">-${entryFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs pt-1.5 border-t border-zinc-800 font-bold">
                <span className="text-zinc-300">Principal invested</span>
                <span className="font-mono text-amber-300">${principal.toFixed(2)}</span>
              </div>
            </div>

            {amount > available && (
              <div className="mb-3 p-2.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Insufficient balance. Add funds to continue.
              </div>
            )}
            {error && (
              <div className="mb-3 p-2.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                {error}
              </div>
            )}

            <button
              onClick={handleConfirm}
              disabled={!canAfford || confirming}
              className={`w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                canAfford && !confirming
                  ? "bg-amber-400 hover:bg-amber-300 text-black hover:scale-[1.01]"
                  : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
              }`}
            >
              {confirming ? (
                <><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Investing…</>
              ) : (
                <><TrendingUp className="w-4 h-4" /> Invest ${fmt(amount)}</>
              )}
            </button>

            <p className="text-[10px] text-zinc-600 text-center mt-3 leading-relaxed">
              Simulated deposits · No real money until Stripe + KYC are enabled · 1% exit fee applies
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// DepositModal — crypto deposit (USDC on Base)
// ============================================================
import { useDepositAddress, useDeposits } from "./api";
import { Copy, ExternalLink, Loader2, QrCode, ArrowDown } from "lucide-react";

interface DepositModalProps {
  open: boolean;
  onClose: () => void;
}

export function DepositModal({ open, onClose }: DepositModalProps) {
  const { address, loading: addrLoading, error: addrError } = useDepositAddress();
  const { deposits } = useDeposits();
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  // Generate QR on the client (lazy-load qrcode lib)
  useEffect(() => {
    if (!address?.address) { setQrDataUrl(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const QRCode = (await import("qrcode")).default;
        // EIP-681 URI so mobile wallets auto-fill USDC transfer
        const contract = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"; // USDC on Base
        const uri = `ethereum:${contract}@${address.chainId}/transfer?address=${address.address}`;
        const url = await QRCode.toDataURL(uri, { width: 280, margin: 2, color: { dark: "#fafafa", light: "#0f0f10" } });
        if (!cancelled) setQrDataUrl(url);
      } catch {
        // Fall back to plain address QR
        try {
          const QRCode = (await import("qrcode")).default;
          const url = await QRCode.toDataURL(address.address, { width: 280, margin: 2, color: { dark: "#fafafa", light: "#0f0f10" } });
          if (!cancelled) setQrDataUrl(url);
        } catch { /* give up */ }
      }
    })();
    return () => { cancelled = true; };
  }, [address]);

  if (!open) return null;

  const handleCopy = async () => {
    if (!address?.address) return;
    try {
      await navigator.clipboard.writeText(address.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  // Show only recent (last 7 days) pending/confirmed deposits
  const recentDeposits = deposits.slice(0, 5);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[500px] rounded-2xl bg-[#0f0f10] border border-zinc-800 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "modal-pop 0.3s cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        <button onClick={onClose} className="absolute top-3 right-3 p-1 text-zinc-500 hover:text-zinc-200 z-10">
          <X className="w-4 h-4" />
        </button>

        <div className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDown className="w-5 h-5 text-lime-400" />
            <h2 className="font-display text-xl">Deposit USDC</h2>
          </div>
          <p className="text-xs text-zinc-500 mb-5">
            Send USDC on <span className="font-semibold text-zinc-300">Base</span> only.
            Other tokens or chains will be lost.
          </p>

          {addrLoading ? (
            <div className="py-12 text-center">
              <Loader2 className="w-6 h-6 mx-auto text-zinc-500 animate-spin mb-2" />
              <div className="text-xs text-zinc-500">Provisioning deposit address…</div>
            </div>
          ) : addrError ? (
            <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
              {addrError}
            </div>
          ) : address ? (
            <>
              {address.warning && (
                <div className="mb-4 p-3 rounded-md bg-amber-400/5 border border-amber-400/30 text-[11px] text-amber-200 leading-relaxed">
                  ⚠️ {address.warning}
                </div>
              )}

              {/* QR */}
              <div className="flex justify-center mb-4">
                <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="Deposit QR" width={240} height={240} style={{ width: 240, height: 240 }} />
                  ) : (
                    <div className="w-[240px] h-[240px] flex items-center justify-center">
                      <QrCode className="w-10 h-10 text-zinc-700" />
                    </div>
                  )}
                </div>
              </div>

              {/* Address */}
              <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 block mb-2">
                Your deposit address ({address.chainDisplayName})
              </label>
              <div className="flex gap-2 mb-4">
                <div className="flex-1 p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 font-mono text-xs text-zinc-200 break-all">
                  {address.address}
                </div>
                <button
                  onClick={handleCopy}
                  className={`px-3 rounded-lg text-xs font-bold transition ${
                    copied ? "bg-lime-400 text-black" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-100"
                  }`}
                >
                  {copied ? <>✓ Copied</> : <><Copy className="w-3.5 h-3.5 inline" /></>}
                </button>
              </div>

              {/* Instructions */}
              <div className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800 text-[11px] text-zinc-400 leading-relaxed mb-4">
                <div className="font-semibold text-zinc-300 mb-1.5">How to deposit</div>
                <ol className="space-y-1 list-decimal list-inside">
                  <li>Send USDC from any wallet or exchange</li>
                  <li>Use <span className="font-semibold text-zinc-200">{address.chainDisplayName}</span> network only</li>
                  <li>Wait ~{address.minConfirmations} confirmations (~30 seconds)</li>
                  <li>Balance credited automatically</li>
                </ol>
              </div>

              {/* Recent deposits */}
              {recentDeposits.length > 0 && (
                <>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">Recent deposits</div>
                  <div className="space-y-1.5">
                    {recentDeposits.map((d: any) => (
                      <div key={d.id} className="flex items-center gap-2 p-2 rounded-md bg-zinc-900/40 border border-zinc-800 text-xs">
                        <div className="flex-1 min-w-0">
                          <div className="font-mono font-bold">${d.amountUsd.toFixed(2)}</div>
                          <div className="text-[10px] text-zinc-500 truncate">
                            {d.status === "credited" ? "✅ credited" :
                             d.status === "confirmed" ? "⏳ crediting…" :
                             d.status === "confirming" ? `⏳ ${d.confirmations}/${d.minConfirmations} confirmations` :
                             "🔎 detected"}
                          </div>
                        </div>
                        <a
                          href={d.explorerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-zinc-500 hover:text-zinc-200"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
