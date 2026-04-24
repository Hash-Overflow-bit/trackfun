"use client";

// ============================================================
// useAuth — a thin wrapper around Privy's usePrivy hook.
//
// Gracefully handles the case where Privy isn't configured
// (no app ID), returning a "disabled" shape so components can
// still render without crashing.
// ============================================================

import { usePrivy, useLogin, useLogout } from "@privy-io/react-auth";
import type { User } from "@privy-io/react-auth";

export interface TrackFunAuth {
  /** Has Privy finished initializing? */
  ready: boolean;
  /** Is the user currently authenticated? */
  authenticated: boolean;
  /** The raw Privy user object, or null. */
  user: User | null;
  /** Display name — email or wallet address or "Player". */
  displayName: string;
  /** Open the Privy login modal. */
  login: () => void;
  /** Log the user out. */
  logout: () => Promise<void>;
  /** True when Privy is configured (NEXT_PUBLIC_PRIVY_APP_ID is set). */
  configured: boolean;
}

/** Derive a short display name for the header. */
function deriveDisplayName(user: User | null): string {
  if (!user) return "Player";
  if (user.email?.address) return user.email.address.split("@")[0];
  if (user.google?.name) return user.google.name.split(" ")[0];
  if (user.google?.email) return user.google.email.split("@")[0];
  const wallet = user.wallet?.address;
  if (wallet) return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
  return "Player";
}

export function useAuth(): TrackFunAuth {
  const configured = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

  // usePrivy / useLogin / useLogout will throw if no PrivyProvider is mounted.
  // When Privy isn't configured, we render without the provider, so we guard.
  if (!configured) {
    return {
      ready: true,
      authenticated: false,
      user: null,
      displayName: "Player",
      login: () => {
        // eslint-disable-next-line no-alert
        alert(
          "Privy is not configured. Set NEXT_PUBLIC_PRIVY_APP_ID in .env.local to enable login."
        );
      },
      logout: async () => {},
      configured: false,
    };
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const privy = usePrivy();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { login } = useLogin();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { logout } = useLogout();

  return {
    ready: privy.ready,
    authenticated: privy.authenticated,
    user: privy.user,
    displayName: deriveDisplayName(privy.user),
    login,
    logout,
    configured: true,
  };
}
