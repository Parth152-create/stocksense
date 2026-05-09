"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DashboardError]", error);
  }, [error]);

  return (
    <div
      className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-8 text-center"
      style={{ color: "var(--color-text)" }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: "rgba(239,68,68,0.1)",
          border: "1px solid rgba(239,68,68,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <AlertTriangle size={32} color="#ef4444" />
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
          Something went wrong
        </h2>
        <p
          style={{
            fontSize: "0.875rem",
            color: "var(--color-muted)",
            maxWidth: 400,
            margin: "0 auto",
          }}
        >
          This part of the dashboard ran into an error. You can try again or go
          back to the main dashboard.
        </p>
        {process.env.NODE_ENV === "development" && (
          <details
            style={{
              marginTop: "1rem",
              padding: "0.75rem",
              borderRadius: "0.5rem",
              background: "var(--color-card)",
              border: "1px solid var(--color-line)",
              textAlign: "left",
              maxWidth: 480,
              margin: "1rem auto 0",
            }}
          >
            <summary
              style={{
                cursor: "pointer",
                fontSize: "0.8rem",
                color: "var(--color-muted)",
              }}
            >
              Error details (dev only)
            </summary>
            <pre
              style={{
                marginTop: "0.5rem",
                fontSize: "0.75rem",
                color: "#ef4444",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {error.message}
              {"\n"}
              {error.stack}
            </pre>
          </details>
        )}
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
          href="/dashboard"
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
            transition: "background 0.15s",
          }}
        >
          <Home size={14} />
          Dashboard
        </Link>
      </div>
    </div>
  );
}