"use client";

// ============================================================
// AppStateContext — API-backed (v0.5).
//
// Keeps the same public interface as the old in-memory version
// so the rest of the UI doesn't need to change.
// ============================================================

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useMe, useNotifications, useActions } from "./api";

export type NotificationKind =
  | "bot_launched" | "promotion" | "big_win" | "big_loss"
  | "arena_starting" | "follower_milestone" | "back_confirmed";

export interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  botId?: string;
  botName?: string;
  botEmoji?: string;
  timestamp: number;
  read: boolean;
}

export interface Toast {
  id: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  botEmoji?: string;
}

interface AppState {
  getMyBackedAmount: (botId: string) => number;
  getPlatformBackedAmount: (botId: string) => number;
  getBackerCount: (botId: string) => number;
  backBot: (botId: string, amount: number) => Promise<void>;

  notifications: Notification[];
  unreadCount: number;
  markAllRead: () => void;
  clearNotifications: () => void;

  toasts: Toast[];
  dismissToast: (id: string) => void;
  pushToast: (t: Omit<Toast, "id">) => void;

  hasOnboarded: boolean;
  setHasOnboarded: (v: boolean) => void;

  myBotIds: Set<string>;
  addMyBot: (botId: string) => void;

  platformBackedByBot: Record<string, number>;
  backerCountByBot: Record<string, number>;

  refetchAll: () => void;
  isAdmin: boolean;
}

const AppStateContext = createContext<AppState | null>(null);
const rid = () => Math.random().toString(36).slice(2, 10);

export function AppStateProvider({
  children,
  bots = [],
}: {
  children: React.ReactNode;
  bots?: Array<{ id: string; platformBacked?: number; backerCount?: number }>;
}) {
  const { me, refetch: refetchMe } = useMe();
  const { notifications, unreadCount, markAllRead, clear, refetch: refetchNotifs } = useNotifications();
  const { backBot: backBotApi } = useActions();

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [hasOnboarded, setHasOnboardedState] = useState<boolean>(true);

  useEffect(() => {
    try {
      const seen = window.localStorage.getItem("trackfun.onboarded");
      if (!seen) setHasOnboardedState(false);
    } catch {
      setHasOnboardedState(false);
    }
  }, []);

  const setHasOnboarded = useCallback((v: boolean) => {
    setHasOnboardedState(v);
    if (v) try { window.localStorage.setItem("trackfun.onboarded", "1"); } catch {}
  }, []);

  const platformBackedByBot = useMemo(() => {
    const o: Record<string, number> = {};
    for (const b of bots) o[b.id] = b.platformBacked ?? 0;
    return o;
  }, [bots]);
  const backerCountByBot = useMemo(() => {
    const o: Record<string, number> = {};
    for (const b of bots) o[b.id] = b.backerCount ?? 0;
    return o;
  }, [bots]);

  const myBackings = useMemo(() => {
    const m: Record<string, number> = {};
    (me?.backings ?? []).forEach((b: any) => { m[b.botId] = b.amount; });
    return m;
  }, [me]);

  const myBotIds = useMemo(() => {
    return new Set<string>((me?.myBots ?? []).map((b: any) => b.id));
  }, [me]);

  const getMyBackedAmount = useCallback((botId: string) => myBackings[botId] ?? 0, [myBackings]);
  const getPlatformBackedAmount = useCallback((botId: string) => platformBackedByBot[botId] ?? 0, [platformBackedByBot]);
  const getBackerCount = useCallback((botId: string) => backerCountByBot[botId] ?? 0, [backerCountByBot]);

  const pushToast = useCallback((t: Omit<Toast, "id">) => {
    const id = rid();
    setToasts(prev => [...prev, { id, ...t }]);
    setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const backBot = useCallback(async (botId: string, amount: number) => {
    try {
      await backBotApi(botId, amount);
      refetchMe();
      refetchNotifs();
    } catch (err: any) {
      pushToast({ kind: "big_loss" as NotificationKind, title: "Couldn't back bot", body: err?.message ?? "Something went wrong" });
      throw err;
    }
  }, [backBotApi, refetchMe, refetchNotifs, pushToast]);

  const addMyBot = useCallback((_botId: string) => {
    // On API-backed flow this is redundant; refetch pulls fresh list.
    refetchMe();
  }, [refetchMe]);

  const refetchAll = useCallback(() => {
    refetchMe();
    refetchNotifs();
  }, [refetchMe, refetchNotifs]);

  const value = useMemo<AppState>(() => ({
    getMyBackedAmount,
    getPlatformBackedAmount,
    getBackerCount,
    backBot,
    notifications: notifications as any,
    unreadCount,
    markAllRead,
    clearNotifications: clear,
    toasts,
    dismissToast,
    pushToast,
    hasOnboarded,
    setHasOnboarded,
    myBotIds,
    addMyBot,
    platformBackedByBot,
    backerCountByBot,
    refetchAll,
    isAdmin: me?.user?.isAdmin ?? false,
  }), [
    getMyBackedAmount, getPlatformBackedAmount, getBackerCount, backBot,
    notifications, unreadCount, markAllRead, clear,
    toasts, dismissToast, pushToast,
    hasOnboarded, setHasOnboarded, myBotIds, addMyBot,
    platformBackedByBot, backerCountByBot, refetchAll,
    me?.user?.isAdmin
  ]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used inside <AppStateProvider>");
  return ctx;
}
