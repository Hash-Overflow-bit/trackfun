"use client";

// ============================================================
// Track.fun logo — uses the user's actual uploaded PNG assets.
//
// /public/logo.png       — full logo (icon + wordmark, stacked)
// /public/logo-mark.png  — just the trending-line icon
//
// Do not recreate these — they're the user's brand assets.
// ============================================================

import React from "react";

interface LogoProps {
  variant?: "full" | "mark";
  className?: string;
  /** Pixel height. Width auto-scales. */
  height?: number;
}

export function TrackFunLogo({
  variant = "full",
  className = "",
  height,
}: LogoProps) {
  const src = variant === "mark" ? "/logo-mark.png" : "/logo.png";
  const h = height ?? (variant === "mark" ? 32 : 96);
  return (
    <img
      src={src}
      alt="Track.fun"
      className={className}
      style={{ height: h, width: "auto", display: "block" }}
    />
  );
}

/** Horizontal: just the mark PNG for header usage. */
export function TrackFunLogoHorizontal({
  className = "",
  height = 32,
}: {
  className?: string;
  height?: number;
}) {
  return (
    <img
      src="/logo.png"
      alt="Track.fun"
      className={className}
      style={{ height, width: "auto", display: "block" }}
    />
  );
}
