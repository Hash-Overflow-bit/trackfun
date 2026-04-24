"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to the server / analytics here in the future
    console.error(error);
  }, [error]);

  return (
    <html>
      <body
        style={{
          background: "radial-gradient(ellipse at top, #0a0e14 0%, #05070a 50%, #000 100%)",
          color: "#fafafa",
          minHeight: "100vh",
          fontFamily: "'Space Grotesk', system-ui, sans-serif",
          margin: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 460, textAlign: "center" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 64, height: 64, borderRadius: 16,
            background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)",
            marginBottom: 20,
          }}>
            <AlertCircle size={28} color="#fb7185" />
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.02em" }}>
            Something broke
          </h1>
          <p style={{ color: "#a1a1aa", fontSize: 14, marginBottom: 20 }}>
            We caught the error and are looking into it.
            {error.digest && (
              <>
                <br />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#52525b" }}>
                  ref: {error.digest}
                </span>
              </>
            )}
          </p>
          <button
            onClick={reset}
            style={{
              padding: "10px 20px", borderRadius: 8, background: "#bef264", color: "#000",
              fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 8,
            }}
          >
            <RefreshCw size={14} strokeWidth={2.5} /> Try again
          </button>
        </div>
      </body>
    </html>
  );
}
