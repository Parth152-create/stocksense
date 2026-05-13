"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/auth";
import { useLivePrices } from "@/lib/websocket";
import { useMarket } from "@/lib/MarketContext";
import {
  TrendingUp, TrendingDown, ArrowLeft, Star, StarOff,
  BarChart2, AlertCircle, RefreshCw,
} from "lucide-react";

interface StockOverview {
  symbol: string; name: string; exchange: string;
  sector: string; industry: string; marketCap: number;
  peRatio: number; eps: number; dividendYield: number;
  week52High: number; week52Low: number; description: string;
}
interface AnalystRating {
  strongBuy: number; buy: number; hold: number;
  sell: number; strongSell: number; targetPrice: number;
}
interface Insight {
  id: string; type: "BULLISH" | "BEARISH" | "NEUTRAL";
  title: string; body: string; source: string; publishedAt: string;
}
interface OrderForm { type: "BUY" | "SELL"; qty: string; }

function Skeleton({ w, h = 16 }: { w: string | number; h?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 4,
      background: "var(--color-line)",
      animation: "pulse 1.5s ease-in-out infinite",
    }} />
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      background: "var(--color-card)", border: "1px solid var(--color-line)",
      borderRadius: 10, padding: "12px 16px",
    }}>
      <p style={{ margin: 0, fontSize: 11, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
      <p style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 700 }}>{value}</p>
    </div>
  );
}

function AnalystBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
      <span style={{ width: 72, color: "var(--color-muted)", fontSize: 12 }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: "var(--color-line)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width .5s ease" }} />
      </div>
      <span style={{ width: 20, textAlign: "right", fontWeight: 600 }}>{count}</span>
    </div>
  );
}

function TradingViewChart({ symbol }: { symbol: string }) {
  /**
   * ✅ FIX: Plain ticker ONLY — no "BSE:" or "NSE:" prefix.
   * TradingView free widget shows "symbol only available on TradingView"
   * popup whenever an exchange prefix is used. Plain symbols work fine.
   * Strip .BSE / .NSE suffix and return the bare ticker.
   */
  function toTradingViewSymbol(sym: string): string {
    return sym
      .replace(/\.BSE$/i, "")   // TCS.BSE  → TCS
      .replace(/\.NSE$/i, "")   // TCS.NSE  → TCS
      .replace(/^BSE:/i,  "")   // BSE:TCS  → TCS
      .replace(/^NSE:/i,  "");  // NSE:TCS  → TCS
  }

  const tvSymbol    = toTradingViewSymbol(symbol);
  const containerId = `tv-${symbol.replace(/[^a-zA-Z0-9]/g, "_")}`;

  useEffect(() => {
    const existing = document.getElementById(containerId);
    if (existing) existing.innerHTML = "";

    const oldScript = document.querySelector('script[src="https://s3.tradingview.com/tv.js"]');
    if (oldScript) oldScript.remove();

    const script = document.createElement("script");
    script.src   = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => {
      if (typeof window === "undefined") return;
      const TV = (window as any).TradingView;
      if (!TV) return;
      new TV.widget({
        container_id:        containerId,
        symbol:              tvSymbol,   // ← plain ticker, e.g. "TCS" not "BSE:TCS"
        interval:            "D",
        timezone:            "Asia/Kolkata",
        theme:               document.documentElement.classList.contains("dark") ? "dark" : "light",
        style:               "1",
        locale:              "en",
        enable_publishing:   false,
        allow_symbol_change: true,
        hide_top_toolbar:    false,
        save_image:          false,
        autosize:            true,
        height:              420,
      });
    };

    document.head.appendChild(script);

    return () => {
      try { document.head.removeChild(script); } catch { /* already removed */ }
      const el = document.getElementById(containerId);
      if (el) el.innerHTML = "";
    };
  }, [tvSymbol, containerId]);

  return (
    <div style={{
      background: "var(--color-card)", border: "1px solid var(--color-line)",
      borderRadius: 12, overflow: "hidden", marginBottom: 20,
    }}>
      <div id={containerId} style={{ width: "100%", height: 420 }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          height: 420, color: "var(--color-muted)", gap: 8, fontSize: 14,
        }}>
          <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} />
          Loading chart…
        </div>
      </div>
    </div>
  );
}

export default function StockPage() {
  const params = useParams();
  const router = useRouter();

  /**
   * ✅ FIX: Strip .BSE/.NSE from the URL param immediately.
   * URL might be /dashboard/stock/TCS.BSE — normalise to "TCS" for
   * all API calls and display. The route param is whatever the user
   * navigated to; we always work with the clean symbol internally.
   */
  const rawSymbol = ((params?.symbol as string) ?? "").toUpperCase();
  const symbol    = rawSymbol
    .replace(/\.BSE$/i, "")
    .replace(/\.NSE$/i, "");

  const { market, formatPrice } = useMarket();

  const [overview,       setOverview]       = useState<StockOverview | null>(null);
  const [ratings,        setRatings]        = useState<AnalystRating | null>(null);
  const [insights,       setInsights]       = useState<Insight[]>([]);
  const [watchlisted,    setWatchlisted]    = useState(false);
  const [fallbackPrice,  setFallbackPrice]  = useState<number | null>(null);
  const [fallbackChange, setFallbackChange] = useState<number | null>(null);
  const [orderForm,      setOrderForm]      = useState<OrderForm>({ type: "BUY", qty: "" });
  const [orderStatus,    setOrderStatus]    = useState<"idle" | "loading" | "success" | "error">("idle");
  const [orderMsg,       setOrderMsg]       = useState("");
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [userName,       setUserName]       = useState<string>("");

  const prices = useLivePrices([symbol]);
  const live   = prices[symbol];

  // ── Load user name for sidebar "Loading..." fix ──────────────────────────
  useEffect(() => {
    fetchWithAuth("/api/users/me")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.name) setUserName(data.name); })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ovRes, ratRes, insRes, wlRes, quoteRes] = await Promise.all([
        fetchWithAuth(`/api/stocks/${symbol}/overview`),
        fetchWithAuth(`/api/stocks/${symbol}/ratings`),
        fetchWithAuth(`/api/stocks/${symbol}/insights`),
        fetchWithAuth(`/api/watchlist`),
        fetchWithAuth(`/api/stocks/${symbol}`),
      ]);

      if (!ovRes.ok) throw new Error(`Symbol not found: ${symbol}`);
      setOverview(await ovRes.json());
      if (ratRes.ok) setRatings(await ratRes.json());
      if (insRes.ok) setInsights(await insRes.json());

      if (quoteRes.ok) {
        const quote = await quoteRes.json();
        if (quote.price && quote.price > 0) setFallbackPrice(quote.price);
        if (quote.changePercent !== undefined) setFallbackChange(quote.changePercent);
      }

      if (wlRes.ok) {
        const wl: { symbol: string }[] = await wlRes.json();
        // Check both raw and clean symbol
        setWatchlisted(wl.some(w =>
          w.symbol === symbol ||
          w.symbol === rawSymbol ||
          w.symbol.replace(/\.(BSE|NSE)$/i, "") === symbol
        ));
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load stock data");
    } finally {
      setLoading(false);
    }
  }, [symbol, rawSymbol]);

  useEffect(() => { void load(); }, [load]);

  const toggleWatchlist = async () => {
    // Always use clean symbol for watchlist API
    const method = watchlisted ? "DELETE" : "POST";
    const res    = await fetchWithAuth(`/api/watchlist/${symbol}`, { method });
    if (res.ok) setWatchlisted(w => !w);
  };

  const placeOrder = async () => {
    if (!orderForm.qty || isNaN(Number(orderForm.qty)) || Number(orderForm.qty) <= 0) {
      setOrderMsg("Enter a valid quantity");
      setOrderStatus("error");
      return;
    }
    setOrderStatus("loading");
    setOrderMsg("");
    try {
      const res = await fetchWithAuth("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,                        // clean symbol
          market: market.id,
          type:   orderForm.type,
          qty:    Number(orderForm.qty), // frontend sends "qty" — backend handles both
          price:  price ?? 0,
        }),
      });
      if (!res.ok) throw new Error("Order failed");
      setOrderStatus("success");
      setOrderMsg(`${orderForm.type} order placed for ${orderForm.qty} shares`);
      setOrderForm(f => ({ ...f, qty: "" }));
      setTimeout(() => setOrderStatus("idle"), 3000);
    } catch {
      setOrderStatus("error");
      setOrderMsg("Order failed — try again");
    }
  };

  const price     = live?.price     ?? fallbackPrice;
  const changePct = live?.changePct ?? fallbackChange;
  const isUp      = (changePct ?? 0) >= 0;
  const isLive    = !!live?.price;

  const totalRatings = ratings
    ? ratings.strongBuy + ratings.buy + ratings.hold + ratings.sell + ratings.strongSell
    : 0;

  const fmtCap = (n: number) => {
    if (n >= 1e12) return `${market.currency}${(n / 1e12).toFixed(2)}T`;
    if (n >= 1e9)  return `${market.currency}${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6)  return `${market.currency}${(n / 1e6).toFixed(2)}M`;
    return formatPrice(n, 0);
  };

  return (
    <div style={{ padding: "32px 28px", maxWidth: 1100, margin: "0 auto" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes spin  { to { transform: rotate(360deg) } }
        @keyframes ping  { 0%{transform:scale(1);opacity:.75} 100%{transform:scale(2);opacity:0} }
        .order-tab {
          flex: 1; padding: 8px; border: none; cursor: pointer;
          font-size: 13px; font-weight: 600; border-radius: 6px; transition: all .15s;
        }
      `}</style>

      <button onClick={() => router.back()} style={{
        display: "flex", alignItems: "center", gap: 6,
        background: "none", border: "none", cursor: "pointer",
        color: "var(--color-muted)", fontSize: 13, marginBottom: 20, padding: 0,
      }}>
        <ArrowLeft size={14} /> Back
      </button>

      {error ? (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", height: 300, gap: 12, color: "var(--color-bear)",
        }}>
          <AlertCircle size={32} />
          <p style={{ margin: 0, fontSize: 16 }}>{error}</p>
          <button onClick={load} style={{
            padding: "8px 20px", borderRadius: 8,
            background: "var(--color-primary)", color: "#000",
            border: "none", cursor: "pointer", fontWeight: 600,
          }}>Retry</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, alignItems: "start" }}>

          {/* ── LEFT COLUMN ── */}
          <div>

            {/* Hero header */}
            <div style={{
              background: "var(--color-card)", border: "1px solid var(--color-line)",
              borderRadius: 12, padding: "20px 24px", marginBottom: 20,
              display: "flex", justifyContent: "space-between", alignItems: "flex-start",
            }}>
              <div>
                {loading ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <Skeleton w={120} h={28} />
                    <Skeleton w={200} />
                    <Skeleton w={80} />
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {/* Show clean symbol in heading — no .BSE suffix */}
                      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>{symbol}</h1>
                      <span style={{
                        padding: "2px 8px", borderRadius: 6, fontSize: 11,
                        background: "var(--color-line)", color: "var(--color-muted)",
                      }}>{overview?.exchange}</span>
                    </div>
                    <p style={{ margin: "4px 0", color: "var(--color-muted)", fontSize: 14 }}>{overview?.name}</p>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--color-muted)" }}>
                      {overview?.sector} · {overview?.industry}
                    </p>
                  </>
                )}
              </div>

              <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                {loading ? (
                  <><Skeleton w={100} h={32} /><Skeleton w={70} /></>
                ) : price !== null ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {isLive && (
                        <span style={{ position: "relative", display: "inline-flex", width: 8, height: 8 }}>
                          <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#8FFFD6", opacity: 0.75, animation: "ping 1s cubic-bezier(0,0,0.2,1) infinite" }} />
                          <span style={{ position: "relative", borderRadius: "50%", width: 8, height: 8, background: "#8FFFD6", display: "inline-flex" }} />
                        </span>
                      )}
                      <span style={{ fontSize: 28, fontWeight: 800 }}>{formatPrice(price)}</span>
                    </div>
                    <span style={{
                      display: "flex", alignItems: "center", gap: 4, fontSize: 14, fontWeight: 600,
                      color: isUp ? "var(--color-bull)" : "var(--color-bear)",
                    }}>
                      {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {isUp ? "+" : ""}{changePct?.toFixed(2)}%
                      {!isLive && (
                        <span style={{ fontSize: 10, color: "var(--color-muted)", fontWeight: 400, marginLeft: 4 }}>
                          delayed
                        </span>
                      )}
                    </span>
                  </>
                ) : (
                  <span style={{ color: "var(--color-muted)", fontSize: 14 }}>Price unavailable</span>
                )}
                <button onClick={toggleWatchlist} style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12,
                  background: watchlisted
                    ? "color-mix(in srgb, var(--color-primary) 15%, transparent)"
                    : "transparent",
                  border: `1px solid ${watchlisted ? "var(--color-primary)" : "var(--color-line)"}`,
                  color: watchlisted ? "var(--color-primary)" : "var(--color-muted)",
                  fontWeight: 600,
                }}>
                  {watchlisted ? <Star size={12} fill="currentColor" /> : <StarOff size={12} />}
                  {watchlisted ? "Watchlisted" : "Add to Watchlist"}
                </button>
              </div>
            </div>

            {/* TradingView Chart — key={symbol} forces remount on symbol change */}
            <TradingViewChart key={symbol} symbol={symbol} />

            {/* Key stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} style={{ background: "var(--color-card)", border: "1px solid var(--color-line)", borderRadius: 10, padding: "12px 16px" }}>
                      <Skeleton w="60%" h={11} />
                      <div style={{ marginTop: 6 }}><Skeleton w="80%" h={18} /></div>
                    </div>
                  ))
                : overview ? (
                  <>
                    <StatCard label="Market Cap"  value={fmtCap(overview.marketCap)} />
                    <StatCard label="P/E Ratio"   value={overview.peRatio?.toFixed(2) ?? "N/A"} />
                    <StatCard label="EPS"         value={formatPrice(overview.eps ?? 0)} />
                    <StatCard label="Div. Yield"  value={overview.dividendYield ? `${(overview.dividendYield * 100).toFixed(2)}%` : "N/A"} />
                    <StatCard label="52W High"    value={formatPrice(overview.week52High ?? 0)} />
                    <StatCard label="52W Low"     value={formatPrice(overview.week52Low ?? 0)} />
                    <StatCard label="Sector"      value={overview.sector ?? "—"} />
                    <StatCard label="Exchange"    value={overview.exchange ?? "—"} />
                  </>
                ) : null}
            </div>

            {/* About */}
            {!loading && overview?.description && (
              <div style={{
                background: "var(--color-card)", border: "1px solid var(--color-line)",
                borderRadius: 12, padding: "18px 20px", marginBottom: 20,
              }}>
                <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700 }}>About</h3>
                <p style={{ margin: 0, fontSize: 13, color: "var(--color-muted)", lineHeight: 1.7 }}>
                  {overview.description}
                </p>
              </div>
            )}

            {/* Analyst Ratings */}
            <div style={{
              background: "var(--color-card)", border: "1px solid var(--color-line)",
              borderRadius: 12, padding: "18px 20px", marginBottom: 20,
            }}>
              <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                <BarChart2 size={15} /> Analyst Ratings
              </h3>
              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} w="100%" h={10} />)}
                </div>
              ) : ratings ? (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                    <AnalystBar label="Strong Buy"  count={ratings.strongBuy}  total={totalRatings} color="#22c55e" />
                    <AnalystBar label="Buy"         count={ratings.buy}        total={totalRatings} color="#86efac" />
                    <AnalystBar label="Hold"        count={ratings.hold}       total={totalRatings} color="#f59e0b" />
                    <AnalystBar label="Sell"        count={ratings.sell}       total={totalRatings} color="#fca5a5" />
                    <AnalystBar label="Strong Sell" count={ratings.strongSell} total={totalRatings} color="#ef4444" />
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--color-muted)" }}>
                    Consensus target:{" "}
                    <strong style={{ color: "var(--color-primary)" }}>{formatPrice(ratings.targetPrice)}</strong>
                    {price !== null && (
                      <span> ({((ratings.targetPrice - price) / price * 100).toFixed(1)}% upside)</span>
                    )}
                  </p>
                </>
              ) : (
                <p style={{ margin: 0, color: "var(--color-muted)", fontSize: 13 }}>No analyst data available</p>
              )}
            </div>

            {/* AI Insights */}
            <div style={{
              background: "var(--color-card)", border: "1px solid var(--color-line)",
              borderRadius: 12, padding: "18px 20px",
            }}>
              <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700 }}>AI Insights</h3>
              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <Skeleton w="40%" h={12} />
                      <Skeleton w="100%" />
                      <Skeleton w="80%" />
                    </div>
                  ))}
                </div>
              ) : insights.length === 0 ? (
                <p style={{ margin: 0, color: "var(--color-muted)", fontSize: 13 }}>No insights available</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {insights.map(ins => (
                    <div key={ins.id} style={{
                      padding: "12px 14px", borderRadius: 8,
                      border: "1px solid var(--color-line)",
                      borderLeft: `3px solid ${
                        ins.type === "BULLISH" ? "#22c55e"
                        : ins.type === "BEARISH" ? "#ef4444"
                        : "#f59e0b"
                      }`,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                          color: ins.type === "BULLISH" ? "#22c55e" : ins.type === "BEARISH" ? "#ef4444" : "#f59e0b",
                        }}>{ins.type}</span>
                        <span style={{ fontSize: 11, color: "var(--color-muted)" }}>
                          {new Date(ins.publishedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600 }}>{ins.title}</p>
                      <p style={{ margin: 0, fontSize: 12, color: "var(--color-muted)", lineHeight: 1.6 }}>{ins.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT COLUMN — Order Panel ── */}
          <div style={{ position: "sticky", top: 80 }}>
            <div style={{
              background: "var(--color-card)", border: "1px solid var(--color-line)",
              borderRadius: 12, padding: "20px",
            }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700 }}>Place Order</h3>

              <div style={{
                display: "flex", gap: 4, background: "var(--color-line)",
                borderRadius: 8, padding: 3, marginBottom: 16,
              }}>
                {(["BUY", "SELL"] as const).map(t => (
                  <button key={t} className="order-tab"
                    onClick={() => setOrderForm(f => ({ ...f, type: t }))}
                    style={{
                      background: orderForm.type === t
                        ? t === "BUY" ? "var(--color-bull)" : "var(--color-bear)"
                        : "transparent",
                      color: orderForm.type === t ? "#fff" : "var(--color-muted)",
                    }}>
                    {t}
                  </button>
                ))}
              </div>

              <div style={{
                padding: "10px 12px", borderRadius: 8, marginBottom: 14,
                background: "var(--color-page)", border: "1px solid var(--color-line)",
                display: "flex", justifyContent: "space-between", fontSize: 13,
              }}>
                <span style={{ color: "var(--color-muted)" }}>Market Price</span>
                <strong>{price !== null ? formatPrice(price) : "—"}</strong>
              </div>

              <label style={{ fontSize: 12, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>
                Quantity (shares)
              </label>
              <input
                type="number" min={1} placeholder="0"
                value={orderForm.qty}
                onChange={e => setOrderForm(f => ({ ...f, qty: e.target.value }))}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 14,
                  background: "var(--color-page)", border: "1px solid var(--color-line)",
                  color: "inherit", boxSizing: "border-box", outline: "none", marginBottom: 8,
                }}
              />

              {price !== null && orderForm.qty && !isNaN(Number(orderForm.qty)) && (
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  fontSize: 13, marginBottom: 14, color: "var(--color-muted)",
                }}>
                  <span>Estimated Total</span>
                  <strong style={{ color: "inherit" }}>{formatPrice(price * Number(orderForm.qty))}</strong>
                </div>
              )}

              <button onClick={placeOrder} disabled={orderStatus === "loading"} style={{
                width: "100%", padding: "11px", borderRadius: 8, cursor: "pointer",
                border: "none", fontWeight: 700, fontSize: 14,
                background: orderForm.type === "BUY" ? "var(--color-bull)" : "var(--color-bear)",
                color: "#fff", opacity: orderStatus === "loading" ? 0.6 : 1,
              }}>
                {orderStatus === "loading" ? "Placing…" : `${orderForm.type} ${symbol}`}
              </button>

              {orderMsg && (
                <p style={{
                  margin: "10px 0 0", fontSize: 12, textAlign: "center",
                  color: orderStatus === "success" ? "var(--color-bull)" : "var(--color-bear)",
                }}>{orderMsg}</p>
              )}

              <p style={{
                margin: "14px 0 0", fontSize: 11, color: "var(--color-muted)",
                textAlign: "center", lineHeight: 1.5,
              }}>
                Orders execute at market price. Not financial advice.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}