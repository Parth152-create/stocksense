"use client";
import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);
  return (
    <html>
      <body style={{ margin: 0, background: "var(--color-page, #0a0a0a)" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: "1.5rem",
            padding: "2rem",
            textAlign: "center",
            fontFamily: "Geist, system-ui, sans-serif",
            color: "var(--color-text, #f5f5f5)",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "rgba(239,68,68,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AlertTriangle size={30} color="#ef4444" />
          </div>
          <div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: "0 0 0.5rem" }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: "0.9rem", color: "#888", margin: 0, maxWidth: 360 }}>
              An unexpected error occurred. Our team has been notified.
            </p>
            {error.digest && (
              <p style={{ fontSize: "0.75rem", color: "#555", marginTop: "0.5rem" }}>
                Error ID: {error.digest}
              </p>
            )}
          </div>
          <button
            onClick={reset}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.6rem 1.4rem",
              borderRadius: "0.5rem",
              border: "1px solid rgba(143,255,214,0.3)",
              background: "rgba(143,255,214,0.08)",
              color: "#8FFFD6",
              fontSize: "0.9rem",
              cursor: "pointer",
              transition: "background 0.2s",
            }}
          >
            <RefreshCw size={15} />
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

