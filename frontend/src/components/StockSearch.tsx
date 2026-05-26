"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, TrendingUp, Loader2 } from "lucide-react";
import { useMarket } from "@/lib/MarketContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  region: string;
  currency: string;
  exchange?: string;
}

interface QuickPick {
  symbol: string;
  name: string;
  market: string;
}

// ─── Logo domains ─────────────────────────────────────────────────────────────

const LOGO_DOMAINS: Record<string, string> = {
  TSLA: "tesla.com", AAPL: "apple.com", AMD: "amd.com", MSFT: "microsoft.com",
  NVDA: "nvidia.com", ADBE: "adobe.com", KO: "coca-cola.com", MCD: "mcdonalds.com",
  AMZN: "amazon.com", GOOGL: "google.com", META: "meta.com", NFLX: "netflix.com",
  INTC: "intel.com", PYPL: "paypal.com", UBER: "uber.com", SPOT: "spotify.com",
  RELIANCE: "ril.com", TCS: "tcs.com", INFY: "infosys.com",
  HDFCBANK: "hdfcbank.com", WIPRO: "wipro.com", ICICIBANK: "icicibank.com",
};

const AVATAR_COLORS = [
  ["#8FFFD6", "#00c896"], ["#818cf8", "#6366f1"], ["#f59e0b", "#d97706"],
  ["#f472b6", "#ec4899"], ["#34d399", "#10b981"], ["#60a5fa", "#3b82f6"],
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strip all Yahoo/BSE/NSE suffixes and return a clean bare symbol */
function cleanSymbol(symbol: string): string {
  return symbol
    .replace(/\.NS$/i, "")
    .replace(/\.BO$/i, "")
    .replace(/\.BSE$/i, "")
    .replace(/\.NSE$/i, "")
    .replace(/=X$/i, "")
    .trim()
    .toUpperCase();
}

/**
 * Derive the market ID from a search result's region / type / exchange.
 * Falls back to the provided fallback (current context market).
 */
function marketFromResult(result: SearchResult, fallback: string): string {
  const type   = (result.type     ?? "").toUpperCase();
  const region = (result.region   ?? "").toLowerCase();
  const exch   = (result.exchange ?? "").toUpperCase();

  if (type === "CRYPTOCURRENCY") return "CRYPTO";
  if (type === "CURRENCY")       return "FX";

  // Yahoo returns "India" in region for BSE/NSE stocks
  if (region.includes("india"))          return "IN";
  if (exch === "BSE" || exch === "NSE")  return "IN";
  if (result.symbol.endsWith(".NS") || result.symbol.endsWith(".BO")) return "IN";

  if (region.includes("united states") || region.includes("us")) return "US";
  if (exch === "NASDAQ" || exch === "NYSE" || exch === "NYQ" || exch === "NMS") return "US";

  return fallback;
}

function ResultAvatar({ symbol }: { symbol: string }) {
  const [err, setErr] = useState(false);
  const clean  = cleanSymbol(symbol);
  const domain = LOGO_DOMAINS[clean];
  const [from, to] = AVATAR_COLORS[clean.charCodeAt(0) % AVATAR_COLORS.length];

  if (domain && !err) {
    return (
      <div style={{
        width: 32, height: 32, borderRadius: "50%", background: "#1f1f1f",
        display: "flex", alignItems: "center", justifyContent: "center",
        border: "1px solid #2a2a2a", flexShrink: 0, overflow: "hidden",
      }}>
        <img
          src={`https://icons.duckduckgo.com/ip3/${domain}.ico`}
          alt={clean} width={20} height={20}
          onError={() => setErr(true)}
          style={{ objectFit: "contain" }}
        />
      </div>
    );
  }

  return (
    <svg width={32} height={32} viewBox="0 0 32 32" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id={`sg-${clean}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={from} /><stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="16" fill={`url(#sg-${clean})`} />
      <text x="16" y="17" textAnchor="middle" dominantBaseline="middle"
        fill="#0a0a0a" fontWeight="800" fontSize="11" fontFamily="Geist,sans-serif">
        {clean.slice(0, 2)}
      </text>
    </svg>
  );
}

// ─── Quick picks ──────────────────────────────────────────────────────────────

const QUICK_PICKS: QuickPick[] = [
  { symbol: "RELIANCE", name: "Reliance Industries", market: "IN"     },
  { symbol: "TCS",      name: "Tata Consultancy",    market: "IN"     },
  { symbol: "AAPL",     name: "Apple Inc.",           market: "US"     },
  { symbol: "NVDA",     name: "NVIDIA",               market: "US"     },
  { symbol: "INFY",     name: "Infosys",              market: "IN"     },
  { symbol: "MSFT",     name: "Microsoft",            market: "US"     },
  { symbol: "BTC",      name: "Bitcoin",              market: "CRYPTO" },
  { symbol: "ETH",      name: "Ethereum",             market: "CRYPTO" },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StockSearch() {
  const router         = useRouter();
  const { market }     = useMarket();

  const [query,     setQuery]     = useState("");
  const [results,   setResults]   = useState<SearchResult[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [open,      setOpen]      = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [error,     setError]     = useState(false);

  const inputRef     = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Global keyboard shortcut: Cmd/Ctrl+K ─────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // ── Fetch from Spring Boot ────────────────────────────────────────────────
  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(
        `http://localhost:8081/api/stocks/search?q=${encodeURIComponent(q)}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Search failed");
      const data: SearchResult[] = await res.json();
      setResults(data.slice(0, 8));
    } catch {
      setError(true);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Debounce input ────────────────────────────────────────────────────────
  const handleInput = (val: string) => {
    setQuery(val);
    setActiveIdx(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 400);
  };

  // ── Unified navigation — always clean symbol, always pass market ──────────
  const navigateTo = useCallback((rawSymbol: string, resolvedMarket: string) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    const sym = cleanSymbol(rawSymbol);
    router.push(`/dashboard/stock/${sym}?market=${resolvedMarket}`);
  }, [router]);

  // ── Keyboard navigation ───────────────────────────────────────────────────
  const displayList = query ? results : QUICK_PICKS;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, displayList.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      const item = displayList[activeIdx];
      if ("market" in item) {
        // QuickPick
        navigateTo(item.symbol, (item as QuickPick).market);
      } else {
        // SearchResult
        navigateTo(item.symbol, marketFromResult(item as SearchResult, market.id));
      }
    }
  };

  const regionBadge = (result: SearchResult) => {
    const m = marketFromResult(result, market.id);
    switch (m) {
      case "IN":     return { label: "BSE",    color: "#f59e0b" };
      case "US":     return { label: "NASDAQ", color: "#8FFFD6" };
      case "CRYPTO": return { label: "CRYPTO", color: "#f7931a" };
      case "FX":     return { label: "FX",     color: "#818cf8" };
      default: {
        const exch = (result.exchange ?? "").toUpperCase();
        return { label: exch || "—", color: "#888" };
      }
    }
  };

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>

      {/* Input */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        background: open ? "#161616" : "#111111",
        border: `1px solid ${open ? "#2a2a2a" : "#1f1f1f"}`,
        borderRadius: open ? "12px 12px 0 0" : 12,
        padding: "10px 14px",
        transition: "all 0.2s",
        cursor: "text",
      }} onClick={() => { setOpen(true); inputRef.current?.focus(); }}>
        {loading
          ? <Loader2 size={15} color="#555" style={{ animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
          : <Search size={15} color={open ? "#888" : "#555"} style={{ flexShrink: 0 }} />
        }
        <input
          ref={inputRef}
          value={query}
          onChange={e => handleInput(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search any stock, ETF, crypto…"
          style={{
            flex: 1, background: "none", border: "none", outline: "none",
            color: "#fff", fontSize: 13, fontFamily: "inherit",
          }}
        />
        {query && (
          <button
            onClick={e => { e.stopPropagation(); setQuery(""); setResults([]); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#555", padding: 0, display: "flex" }}
          >
            <X size={13} />
          </button>
        )}
        {!open && !query && (
          <kbd style={{
            fontSize: 10, color: "#444", background: "#1a1a1a",
            border: "1px solid #2a2a2a", borderRadius: 5, padding: "2px 6px",
            fontFamily: "inherit", flexShrink: 0,
          }}>
            ⌘K
          </kbd>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 1000,
          background: "#161616", border: "1px solid #2a2a2a", borderTop: "none",
          borderRadius: "0 0 12px 12px",
          boxShadow: "0 16px 40px rgba(0,0,0,0.6)",
          maxHeight: 380, overflowY: "auto",
        }}>
          <div style={{ padding: "8px 14px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>
              {query ? `Results for "${query}"` : "Quick picks"}
            </span>
            {!query && (
              <span style={{ fontSize: 10, color: "#333" }}>↑↓ navigate · Enter open</span>
            )}
          </div>

          {error && (
            <div style={{ padding: "16px 14px", color: "#555", fontSize: 13, textAlign: "center" }}>
              Search unavailable — check backend is running on port 8081
            </div>
          )}

          {!loading && !error && query && results.length === 0 && (
            <div style={{ padding: "16px 14px", color: "#555", fontSize: 13, textAlign: "center" }}>
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {displayList.map((item, i) => {
            const isQuickPick = "market" in item;
            const rawSym      = item.symbol;
            const displaySym  = cleanSymbol(rawSym);
            const isActive    = i === activeIdx;

            // Resolve market for navigation and badge
            const resolvedMarket = isQuickPick
              ? (item as QuickPick).market
              : marketFromResult(item as SearchResult, market.id);

            const badge = isQuickPick
              ? (() => {
                  switch ((item as QuickPick).market) {
                    case "IN":     return { label: "BSE",    color: "#f59e0b" };
                    case "US":     return { label: "NASDAQ", color: "#8FFFD6" };
                    case "CRYPTO": return { label: "CRYPTO", color: "#f7931a" };
                    default:       return { label: "FX",     color: "#818cf8" };
                  }
                })()
              : regionBadge(item as SearchResult);

            return (
              <button
                key={rawSym + i}
                onClick={() => navigateTo(rawSym, resolvedMarket)}
                onMouseEnter={() => setActiveIdx(i)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px", border: "none", cursor: "pointer", textAlign: "left",
                  background: isActive ? "#1f1f1f" : "transparent",
                  transition: "background 0.1s",
                }}
              >
                <ResultAvatar symbol={rawSym} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>
                      {displaySym}
                    </span>
                    {badge && (
                      <span style={{
                        fontSize: 9, padding: "1px 5px", borderRadius: 4, fontWeight: 700,
                        background: `${badge.color}15`, color: badge.color,
                        border: `1px solid ${badge.color}30`,
                      }}>
                        {badge.label}
                      </span>
                    )}
                  </div>
                  <div style={{
                    color: "#555", fontSize: 11, marginTop: 1,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {item.name}
                  </div>
                </div>
                <TrendingUp size={13} color="#333" style={{ flexShrink: 0 }} />
              </button>
            );
          })}

          {!query && (
            <div style={{ padding: "8px 14px 10px", borderTop: "1px solid #1a1a1a", marginTop: 4 }}>
              <span style={{ fontSize: 10, color: "#333" }}>
                Type any stock name, symbol, or ISIN to search all exchanges
              </span>
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}