"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { TrendingUp, TrendingDown, Star, ExternalLink, AlertCircle } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SharedSymbol {
  symbol: string;
  price:  number;
}

interface SharedWatchlist {
  owner:   string;
  symbols: SharedSymbol[];
  count:   number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SYMBOL_META: Record<string, { name: string; color: string; bg: string }> = {
  NVDA:     { name: "NVIDIA Corp",    color: "#76b900", bg: "#76b90018" },
  AAPL:     { name: "Apple Inc",      color: "#aaaaaa", bg: "#aaaaaa18" },
  MSFT:     { name: "Microsoft Corp", color: "#00a4ef", bg: "#00a4ef18" },
  TSLA:     { name: "Tesla Inc",      color: "#ef4444", bg: "#ef444418" },
  AMZN:     { name: "Amazon",         color: "#f90",    bg: "#f9900018" },
  META:     { name: "Meta",           color: "#1877f2", bg: "#1877f218" },
  GOOGL:    { name: "Alphabet",       color: "#4285f4", bg: "#4285f418" },
  AMD:      { name: "AMD",            color: "#ed1c24", bg: "#ed1c2418" },
  RELIANCE: { name: "Reliance Ind.",  color: "#0ea5e9", bg: "#0ea5e918" },
  TCS:      { name: "TCS",            color: "#8b5cf6", bg: "#8b5cf618" },
  INFY:     { name: "Infosys",        color: "#f59e0b", bg: "#f59e0b18" },
  HDFCBANK: { name: "HDFC Bank",      color: "#10b981", bg: "#10b98118" },
  BTC:      { name: "Bitcoin",        color: "#f7931a", bg: "#f7931a18" },
  ETH:      { name: "Ethereum",       color: "#627eea", bg: "#627eea18" },
  SOL:      { name: "Solana",         color: "#9945ff", bg: "#9945ff18" },
};
const DEFAULT_META = { name: "", color: "#8FFFD6", bg: "#8FFFD618" };

const LOGO_DOMAINS: Record<string, string> = {
  TSLA: "tesla.com", AAPL: "apple.com", AMD: "amd.com", MSFT: "microsoft.com",
  NVDA: "nvidia.com", AMZN: "amazon.com", GOOGL: "google.com", META: "meta.com",
  NFLX: "netflix.com", RELIANCE: "ril.com", TCS: "tcs.com",
  INFY: "infosys.com", HDFCBANK: "hdfcbank.com",
};

// ─── Avatar ───────────────────────────────────────────────────────────────────

function StockAvatar({ symbol, color, bg, size = 38 }: {
  symbol: string; color: string; bg: string; size?: number;
}) {
  const [err, setErr] = useState(false);
  const clean = symbol.replace(/\.(BSE|NSE)$/i, "");
  const domain = LOGO_DOMAINS[clean];
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: bg, border: `1px solid ${color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.32, fontWeight: 700, color, flexShrink: 0, overflow: "hidden" }}>
      {domain && !err
        ? <img src={`https://icons.duckduckgo.com/ip3/${domain}.ico`} alt={symbol} width={size * 0.6} height={size * 0.6} onError={() => setErr(true)} style={{ objectFit: "contain" }} />
        : clean.charAt(0)}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SharedWatchlistPage() {
  const params = useParams();
  const router = useRouter();
  const token  = params?.token as string;

  const [data,    setData]    = useState<SharedWatchlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`/api/watchlist/shared/${token}`);
        if (res.status === 404) {
          setError("This watchlist link is invalid or has been revoked by the owner.");
          return;
        }
        if (!res.ok) { setError("Something went wrong loading this watchlist."); return; }
        setData(await res.json());
      } catch {
        setError("Network error — please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-page)", fontFamily: "var(--font-gantari,'Gantari',system-ui,sans-serif)" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 32, height: 32, border: "2px solid var(--color-line)", borderTop: "2px solid #8FFFD6", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
        <p style={{ color: "var(--color-muted)", fontSize: 14 }}>Loading watchlist…</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error || !data) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-page)", fontFamily: "var(--font-gantari,'Gantari',system-ui,sans-serif)", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <AlertCircle size={24} color="#ef4444" />
        </div>
        <h2 style={{ color: "var(--color-primary)", fontWeight: 700, fontSize: 18, margin: "0 0 8px" }}>Watchlist Not Found</h2>
        <p style={{ color: "var(--color-muted)", fontSize: 13, margin: "0 0 24px", lineHeight: 1.6 }}>{error}</p>
        <button onClick={() => router.push("/")}
          style={{ padding: "11px 24px", borderRadius: 10, border: "none", background: "#8FFFD6", color: "#0a0a0a", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
          Go to StockSense
        </button>
      </div>
    </div>
  );

  // ── Loaded ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "var(--color-page)", fontFamily: "var(--font-gantari,'Gantari',system-ui,sans-serif)", padding: "32px 24px" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 52, height: 52, borderRadius: "50%", background: "#8FFFD618", border: "1px solid #8FFFD633", marginBottom: 14 }}>
            <Star size={22} color="#8FFFD6" />
          </div>
          <h1 style={{ color: "var(--color-primary)", fontWeight: 700, fontSize: 22, margin: "0 0 6px", letterSpacing: -0.3 }}>
            {data.owner}'s Watchlist
          </h1>
          <p style={{ color: "var(--color-muted)", fontSize: 13, margin: 0 }}>
            {data.count} symbol{data.count !== 1 ? "s" : ""} · Live prices · Read-only
          </p>
        </div>

        {/* Symbols */}
        <div style={{ background: "var(--color-card)", border: "1px solid var(--color-line)", borderRadius: 14, overflow: "hidden", marginBottom: 24 }}>
          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 36px", padding: "10px 20px", borderBottom: "1px solid var(--color-line)" }}>
            {["Symbol", "Price", ""].map((h, i) => (
              <span key={i} style={{ color: "var(--color-muted)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</span>
            ))}
          </div>

          {data.symbols.map((item, i) => {
            const clean = item.symbol.replace(/\.(BSE|NSE)$/i, "");
            const meta  = SYMBOL_META[clean] ?? DEFAULT_META;
            const price = item.price ?? 0;

            return (
              <div key={item.symbol}
                style={{ display: "grid", gridTemplateColumns: "1fr 120px 36px", padding: "14px 20px", borderBottom: i < data.symbols.length - 1 ? "1px solid var(--color-line)" : "none", alignItems: "center", cursor: "pointer", transition: "background 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--color-surface-hover)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                onClick={() => router.push(`/dashboard/stock/${clean}`)}>

                {/* Asset */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <StockAvatar symbol={item.symbol} color={meta.color} bg={meta.bg} size={38} />
                  <div>
                    <p style={{ color: "var(--color-primary)", fontWeight: 700, fontSize: 14, margin: 0 }}>{clean}</p>
                    <p style={{ color: "var(--color-muted)", fontSize: 11, margin: "2px 0 0" }}>{meta.name || clean}</p>
                  </div>
                </div>

                {/* Price */}
                <span style={{ color: "var(--color-primary)", fontSize: 14, fontWeight: 600 }}>
                  {price > 0
                    ? `$${price.toLocaleString("en-US", { minimumFractionDigits: price < 10 ? 4 : 2 })}`
                    : "—"}
                </span>

                {/* View button */}
                <button
                  onClick={e => { e.stopPropagation(); router.push(`/dashboard/stock/${clean}`); }}
                  style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--color-line)", background: "transparent", color: "var(--color-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ExternalLink size={12} />
                </button>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div style={{ background: "var(--color-card)", border: "1px solid var(--color-line)", borderRadius: 14, padding: "20px 24px", textAlign: "center" }}>
          <p style={{ color: "var(--color-muted)", fontSize: 13, margin: "0 0 14px", lineHeight: 1.6 }}>
            Track stocks, set alerts, and build your own watchlist on StockSense
          </p>
          <button onClick={() => router.push("/auth/login")}
            style={{ padding: "11px 28px", borderRadius: 10, border: "none", background: "#8FFFD6", color: "#0a0a0a", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
            Get Started Free
          </button>
        </div>

        {/* Footer note */}
        <p style={{ color: "var(--color-muted)", fontSize: 11, textAlign: "center", marginTop: 20, lineHeight: 1.6 }}>
          This is a read-only view shared by {data.owner}. Prices are live but may be delayed.
          Alert prices and account details are never shared.
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}