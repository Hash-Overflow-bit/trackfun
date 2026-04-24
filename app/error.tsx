"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="max-w-lg mx-auto py-16 text-center px-6">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 mb-5">
        <AlertCircle className="w-7 h-7 text-rose-400" />
      </div>
      <h1 className="font-display text-3xl mb-2">Something broke</h1>
      <p className="text-sm text-zinc-400 mb-6">
        We caught the error. Try refreshing — if it persists, it's on us.
      </p>
      {error.digest && (
        <p className="text-[10px] font-mono text-zinc-600 mb-4">ref: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="px-5 py-2.5 rounded-lg bg-lime-400 hover:bg-lime-300 text-black font-bold text-sm inline-flex items-center gap-2"
      >
        <RefreshCw className="w-4 h-4" strokeWidth={2.5} /> Try again
      </button>
    </div>
  );
}
