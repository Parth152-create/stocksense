"use client";

import { useEffect } from "react";
import { TrendingDown, RefreshCw, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function StockError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const symbol = (params?.symbol as string)?.toUpperCase() ?? "this stock";

  useEffect(() => {
    console.error(`[StockError] ${symbol}:`, error);
  }, [error, symbol]);

  return (
    <div
      className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-8 text-center"
      style={{ color: "var(--color-text)" }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: "1rem",
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.18)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <TrendingDown size={32} color="#ef4444" />
      </div>

      <div>
        <h2
          style={{
            fontSize: "1.4rem",
            fontWeight: 600,
            margin: "0 0 0.5rem",
            color: "var(--color-text)",
          }}
        >
          Failed to load {symbol}
        </h2>
        <p
          style={{
            fontSize: "0.875rem",
            color: "var(--color-muted)",
            maxWidth: 380,
            margin: "0 auto",
          }}
        >
          We couldn't fetch data for this stock. This may be a temporary issue
          with the market data provider. Please try again.
        </p>
      </div>

      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button
          onClick={reset}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.6rem 1.2rem",
            borderRadius: "0.5rem",
            border: "1px solid rgba(143,255,214,0.3)",
            background: "rgba(143,255,214,0.08)",
            color: "#8FFFD6",
            fontSize: "0.875rem",
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "rgba(143,255,214,0.14)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "rgba(143,255,214,0.08)")
          }
        >
          <RefreshCw size={14} />
          Try again
        </button>

        <Link
          href="/dashboard/watchlist"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.6rem 1.2rem",
            borderRadius: "0.5rem",
            border: "1px solid var(--color-line)",
            background: "var(--color-card)",
            color: "var(--color-muted)",
            fontSize: "0.875rem",
            textDecoration: "none",
          }}
        >
          <ChevronLeft size={14} />
          Back to watchlist
        </Link>
      </div>
    </div>
  );
}