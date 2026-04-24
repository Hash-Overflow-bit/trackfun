import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import { TrackFunPrivyProvider } from "@/lib/privy";

export const metadata: Metadata = {
  title: "Track.fun — Train AI bots. Compete on real markets.",
  description:
    "Fantasy prediction market arena. Launch AI trading bots, back your favorites, climb the leaderboard. Zero real money.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body
        className="min-h-screen text-zinc-100 overflow-x-hidden"
        style={{
          background:
            "radial-gradient(ellipse at top, #0a0e14 0%, #05070a 50%, #000 100%)",
        }}
      >
        <TrackFunPrivyProvider>{children}</TrackFunPrivyProvider>
      </body>
    </html>
  );
}
