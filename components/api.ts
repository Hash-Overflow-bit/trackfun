"use client";

// ============================================================
// Client-side API hooks.
//
// Replace the in-memory AppStateContext with API-backed data.
// All POST calls attach the Privy access token.
// ============================================================

import { useState, useEffect, useCallback, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";

async function fetchJson<T>(url: string, opts: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(opts.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (opts.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const res = await fetch(url, { ...opts, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

function useAuthToken() {
  const privy = usePrivy();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (!privy.authenticated) { setToken(null); return; }
    let cancelled = false;
    privy.getAccessToken().then(t => { if (!cancelled) setToken(t); }).catch(() => {});
    return () => { cancelled = true; };
  }, [privy.authenticated, privy]);

  return token;
}

// ------------------ Bots ------------------
export function useBots(sortBy: string = "pnl", limit: number = 120) {
  const [bots, setBots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      const data: any = await fetchJson(`/api/bots?sortBy=${sortBy}&limit=${limit}`);
      setBots(data.bots);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [sortBy, limit]);

  useEffect(() => {
    refetch();
    const id = setInterval(refetch, 30_000); // Refresh every 30s
    return () => clearInterval(id);
  }, [refetch]);

  return { bots, loading, error, refetch };
}

// ------------------ Feed ------------------
export function useFeed(filterType: string = "all", limit: number = 60) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const data: any = await fetchJson(`/api/feed?type=${filterType}&limit=${limit}`);
      setEvents(data.events);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filterType, limit]);

  useEffect(() => {
    refetch();
    const id = setInterval(refetch, 5_000); // Every 5s feels alive
    return () => clearInterval(id);
  }, [refetch]);

  return { events, loading, refetch };
}

// ------------------ Me ------------------
export function useMe() {
  const token = useAuthToken();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!token) { setData(null); return; }
    setLoading(true);
    try {
      const res: any = await fetchJson("/api/me", {}, token);
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { refetch(); }, [refetch]);

  return { me: data, loading, refetch };
}

// ------------------ Notifications ------------------
export function useNotifications() {
  const token = useAuthToken();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refetch = useCallback(async () => {
    if (!token) { setNotifications([]); setUnreadCount(0); return; }
    try {
      const data: any = await fetchJson("/api/notifications", {}, token);
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (e) { console.error(e); }
  }, [token]);

  useEffect(() => {
    refetch();
    const id = setInterval(refetch, 15_000);
    return () => clearInterval(id);
  }, [refetch]);

  const markAllRead = useCallback(async () => {
    if (!token) return;
    await fetchJson("/api/notifications", {
      method: "POST",
      body: JSON.stringify({ action: "mark_all_read" }),
    }, token).catch(() => {});
    refetch();
  }, [token, refetch]);

  const clear = useCallback(async () => {
    if (!token) return;
    await fetchJson("/api/notifications", {
      method: "POST",
      body: JSON.stringify({ action: "clear" }),
    }, token).catch(() => {});
    refetch();
  }, [token, refetch]);

  return { notifications, unreadCount, markAllRead, clear, refetch };
}

// ------------------ Balance ------------------
export function useBalance() {
  const token = useAuthToken();
  const [balance, setBalance] = useState<any>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!token) { setBalance(null); setLedger([]); return; }
    setLoading(true);
    try {
      const data: any = await fetchJson("/api/balance", {}, token);
      setBalance(data.balance);
      setLedger(data.ledger);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    refetch();
    const id = setInterval(refetch, 20_000);
    return () => clearInterval(id);
  }, [refetch]);

  return { balance, ledger, loading, refetch };
}

// ------------------ Deposits (crypto) ------------------
export function useDepositAddress() {
  const token = useAuthToken();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAddress = useCallback(async () => {
    if (!token) { setData(null); return; }
    setLoading(true);
    setError(null);
    try {
      const res: any = await fetchJson("/api/deposits/address", {}, token);
      setData(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchAddress(); }, [fetchAddress]);

  return { address: data, loading, error, refetch: fetchAddress };
}

export function useDeposits() {
  const token = useAuthToken();
  const [deposits, setDeposits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!token) { setDeposits([]); return; }
    setLoading(true);
    try {
      const data: any = await fetchJson("/api/deposits", {}, token);
      setDeposits(data.deposits);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    refetch();
    const id = setInterval(refetch, 15_000);
    return () => clearInterval(id);
  }, [refetch]);

  return { deposits, loading, refetch };
}

// ------------------ Investments ------------------
export function useInvestments() {
  const token = useAuthToken();
  const [investments, setInvestments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!token) { setInvestments([]); return; }
    setLoading(true);
    try {
      const data: any = await fetchJson("/api/investments", {}, token);
      setInvestments(data.investments);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    refetch();
    const id = setInterval(refetch, 15_000);
    return () => clearInterval(id);
  }, [refetch]);

  const invest = useCallback(async (botId: string, amount: number) => {
    if (!token) throw new Error("Log in to invest");
    const res = await fetchJson<{ principal: number; entryFee: number }>("/api/investments", {
      method: "POST",
      body: JSON.stringify({ botId, amount }),
    }, token);
    refetch();
    return res;
  }, [token, refetch]);

  const divest = useCallback(async (investmentId: string) => {
    if (!token) throw new Error("Log in to divest");
    const res = await fetchJson<any>(`/api/investments?id=${investmentId}`, {
      method: "DELETE",
    }, token);
    refetch();
    return res;
  }, [token, refetch]);

  return { investments, loading, refetch, invest, divest };
}

// ------------------ Actions ------------------
export function useActions() {
  const token = useAuthToken();

  const createBot = useCallback(async (data: any) => {
    if (!token) throw new Error("Log in to create a bot");
    return fetchJson<{ bot: any }>("/api/bots/create", {
      method: "POST",
      body: JSON.stringify(data),
    }, token);
  }, [token]);

  const backBot = useCallback(async (botId: string, amount: number) => {
    if (!token) throw new Error("Log in to back a bot");
    return fetchJson<{ backing: any }>("/api/backings", {
      method: "POST",
      body: JSON.stringify({ botId, amount }),
    }, token);
  }, [token]);

  return { createBot, backBot, tokenReady: !!token };
}
