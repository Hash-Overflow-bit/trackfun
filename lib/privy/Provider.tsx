"use client";

// ============================================================
// Privy client provider.
//
// Wraps the app in <PrivyProvider> using the public App ID from
// NEXT_PUBLIC_PRIVY_APP_ID. If no App ID is configured, renders
// children without auth so local dev works without credentials.
// ============================================================

import { PrivyProvider } from "@privy-io/react-auth";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export function TrackFunPrivyProvider({ children }: Props) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const clientId = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID;

  // If Privy isn't configured yet, render children without auth.
  // This lets devs preview the UI before pasting credentials.
  if (!appId) {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.warn(
        "[Track.fun] NEXT_PUBLIC_PRIVY_APP_ID is not set. Auth is disabled. See .env.example."
      );
    }
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={appId}
      {...(clientId ? { clientId } : {})}
      config={{
        // Match Track.fun's dark, lime-accented vibe.
        appearance: {
          theme: "dark",
          accentColor: "#bef264", // lime-300
          logo: undefined, // can be set to your hosted logo URL
          showWalletLoginFirst: false,
        },
        // Keep it simple: email + Google. Extend later as needed.
        loginMethods: ["email", "google", "wallet"],
        // Prepare embedded wallets so we can hook future on-chain features,
        // but don't surface UI for them today.
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
          requireUserPasswordOnCreate: false,
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
