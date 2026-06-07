"use client";

import { useEffect, useState, useRef, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { AnimatePresence } from "framer-motion";
import { Command } from "cmdk";
import {
  Search, TrendingUp, TrendingDown, LayoutDashboard, Briefcase,
  BookMarked, BarChart3, Settings, SlidersHorizontal, FileText,
  Users, Wallet, Sparkles, Bell, ArrowRight, Clock, X, Zap,
} from "lucide-react";
import { fetchWithAuth } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StockResult {
  symbol:   string;
  name:     string;
  exchange: string;
  price?:   number;
  change?:  number;
}

interface NavItem {
  label:    string;
  href:     string;
  icon:     React.ReactNode;
  keywords: string[];
}

interface RecentSearch {
  symbol:    string;
  name:      string;
  timestamp: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT      = "#8FFFD6";
const BULL        = "#22c55e";
const BEAR        = "#ef4444";
const DEBOUNCE_MS = 280;
const RECENT_KEY  = "ss_recent_searches";
const MAX_RECENT  = 8;

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",     href: "/dashboard",               icon: <LayoutDashboard size={13} />,   keywords: ["home", "overview"] },
  { label: "Portfolio",     href: "/dashboard/portfolio",     icon: <Briefcase size={13} />,         keywords: ["holdings", "positions"] },
  { label: "Wallet",        href: "/dashboard/wallet",        icon: <Wallet size={13} />,            keywords: ["funds", "balance", "deposit"] },
  { label: "Watchlist",     href: "/dashboard/watchlist",     icon: <BookMarked size={13} />,        keywords: ["saved", "favorites", "tracking"] },
  { label: "Analytics",     href: "/dashboard/analytics",     icon: <BarChart3 size={13} />,         keywords: ["charts", "performance", "returns"] },
  { label: "Insights",      href: "/dashboard/insights",      icon: <Sparkles size={13} />,          keywords: ["ai", "signals", "ml"] },
  { label: "Orders",        href: "/dashboard/orders",        icon: <BarChart3 size={13} />,         keywords: ["trades", "history", "buy", "sell"] },
  { label: "Screener",      href: "/dashboard/screener",      icon: <SlidersHorizontal size={13} />, keywords: ["filter", "scan", "find"] },
  { label: "Tax & Lots",    href: "/dashboard/tax",           icon: <FileText size={13} />,          keywords: ["tax", "lots", "harvest", "gains"] },
  { label: "Community",     href: "/dashboard/community",     icon: <Users size={13} />,             keywords: ["social", "traders", "copy"] },
  { label: "Notifications", href: "/dashboard/notifications", icon: <Bell size={13} />,              keywords: ["alerts", "updates"] },
  { label: "Settings",      href: "/dashboard/settings",      icon: <Settings size={13} />,          keywords: ["preferences", "account", "profile"] },
];

// ─── localStorage helpers ─────────────────────────────────────────────────────

function getRecent(): RecentSearch[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); }
  catch { return []; }
}
function saveRecent(item: RecentSearch) {
  const next = [item, ...getRecent().filter(r => r.symbol !== item.symbol)].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}
function removeRecent(symbol: string) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(getRecent().filter(r => r.symbol !== symbol)));
}

// ─── Kbd chip ─────────────────────────────────────────────────────────────────

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      padding: "2px 6px", borderRadius: 5, fontSize: 10, fontWeight: 600,
      background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)",
      color: "var(--color-muted)", fontFamily: "inherit", lineHeight: 1.6,
    }}>
      {children}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CommandPalette() {
  const router  = useRouter();
  const { resolvedTheme } = useTheme();
  const isDark  = resolvedTheme !== "light";
  const [, startTransition] = useTransition();

  const [open,          setOpen]          = useState(false);
  const [query,         setQuery]         = useState("");
  const [stockResults,  setStockResults]  = useState<StockResult[]>([]);
  const [searching,     setSearching]     = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // ── Open / close ───────────────────────────────────────────────────────────

  const openPalette = useCallback(() => {
    setRecentSearches(getRecent());
    setQuery("");
    setStockResults([]);
    setOpen(true);
  }, []);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery("");
    setStockResults([]);
    setSearching(false);
  }, []);

  // ── Global Cmd+K listener ──────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        open ? closePalette() : openPalette();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, openPalette, closePalette]);

  // ── Stock search with debounce ─────────────────────────────────────────────

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setStockResults([]); setSearching(false); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetchWithAuth(`/api/stocks/search?q=${encodeURIComponent(query.trim())}&limit=6`);
        if (res.ok) {
          const data = await res.json();
          setStockResults(Array.isArray(data) ? data : []);
        }
      } catch { setStockResults([]); }
      finally   { setSearching(false); }
    }, DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // ── Navigation helpers ─────────────────────────────────────────────────────

  const navigateToStock = useCallback((symbol: string, name: string) => {
    saveRecent({ symbol, name, timestamp: Date.now() });
    closePalette();
    startTransition(() => router.push(`/dashboard/stock/${symbol}`));
  }, [closePalette, router]);

  const navigateToPage = useCallback((href: string) => {
    closePalette();
    startTransition(() => router.push(href));
  }, [closePalette, router]);

  const handleRemoveRecent = (e: React.MouseEvent, symbol: string) => {
    e.stopPropagation();
    removeRecent(symbol);
    setRecentSearches(getRecent());
  };

  // ── Shared cmdk item style ─────────────────────────────────────────────────

  const itemStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 10,
    padding: "9px 16px", cursor: "pointer",
    borderLeft: "2px solid transparent",
    outline: "none", userSelect: "none",
    transition: "background 0.1s, border-color 0.1s",
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        /* cmdk item selected state */
        [cmdk-item][data-selected="true"] {
          background: rgba(143,255,214,0.06) !important;
          border-left-color: ${ACCENT} !important;
        }
        [cmdk-item][data-selected="true"] .cmd-item-icon {
          background: rgba(143,255,214,0.12) !important;
          border-color: rgba(143,255,214,0.3) !important;
          color: ${ACCENT} !important;
        }
        [cmdk-item][data-selected="true"] .cmd-arrow { opacity: 0.7 !important; }
        [cmdk-item][data-selected="true"] .cmd-sym-badge { color: ${ACCENT} !important; }

        /* Recent remove button */
        [cmdk-item]:hover .recent-x { opacity: 1 !important; }

        /* Scrollbar */
        [cmdk-list]::-webkit-scrollbar { width: 4px; }
        [cmdk-list]::-webkit-scrollbar-track { background: transparent; }
        [cmdk-list]::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }

        /* Animations */
        .cmd-backdrop { animation: cmdBdIn  0.18s ease both; }
        .cmd-panel    { animation: cmdPanIn 0.22s cubic-bezier(0.34,1.4,0.64,1) both; }
        @keyframes cmdBdIn  { from{opacity:0}       to{opacity:1} }
        @keyframes cmdPanIn { from{opacity:0;transform:translateX(-50%) scale(0.96) translateY(-8px)} to{opacity:1;transform:translateX(-50%) scale(1) translateY(0)} }
        @keyframes spin     { to{transform:rotate(360deg)} }
        @keyframes cmdPing  { 0%{transform:scale(1);opacity:.75} 100%{transform:scale(2);opacity:0} }
      `}</style>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div
              className="cmd-backdrop"
              onClick={closePalette}
              style={{
                position: "fixed", inset: 0, zIndex: 9998,
                background: isDark ? "rgba(0,0,0,0.72)" : "rgba(0,0,0,0.45)",
                backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
              }}
            />

            {/* Panel */}
            <div
              className="cmd-panel"
              style={{
                position: "fixed", top: "18vh", left: "50%",
                zIndex: 9999, width: "min(600px, 92vw)",
                background: isDark ? "rgba(12,12,12,0.97)" : "rgba(252,252,252,0.97)",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.10)"}`,
                borderRadius: 14, overflow: "hidden",
                boxShadow: isDark
                  ? "0 0 0 1px rgba(143,255,214,0.05), 0 32px 80px rgba(0,0,0,0.7)"
                  : "0 8px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.06)",
                fontFamily: "var(--font-gantari,'Gantari',system-ui,sans-serif)",
              }}
            >
              <Command
                label="Command palette"
                shouldFilter={!query.trim() ? true : false}
                loop
              >
                {/* ── Input ── */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "14px 16px",
                  borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)"}`,
                }}>
                  <div style={{ flexShrink: 0, width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {searching ? (
                      <div style={{
                        width: 15, height: 15, borderRadius: "50%",
                        border: `1.5px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                        borderTop: `1.5px solid ${ACCENT}`,
                        animation: "spin 0.7s linear infinite",
                      }} />
                    ) : (
                      <Search size={15} style={{ color: ACCENT, opacity: 0.85 }} />
                    )}
                  </div>

                  <Command.Input
                    value={query}
                    onValueChange={setQuery}
                    placeholder="Search stocks, or navigate…"
                    autoFocus
                    style={{
                      flex: 1, border: "none", outline: "none",
                      background: "transparent", fontSize: 14, fontWeight: 500,
                      color: "var(--color-primary)", caretColor: ACCENT,
                      fontFamily: "var(--font-gantari,'Gantari',system-ui,sans-serif)",
                    }}
                  />

                  <Kbd>esc</Kbd>
                </div>

                {/* ── List ── */}
                <Command.List style={{ maxHeight: 380, overflowY: "auto", padding: "6px 0" }}>

                  {/* Empty state — only shown when query has text and cmdk finds nothing */}
                  <Command.Empty>
                    {!searching && (
                      <div style={{
                        display: "flex", flexDirection: "column", alignItems: "center",
                        justifyContent: "center", padding: "32px 24px", gap: 10,
                      }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: 10,
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <Zap size={18} style={{ color: "var(--color-muted)", opacity: 0.35 }} />
                        </div>
                        <p style={{ margin: 0, fontSize: 13, color: "var(--color-muted)", opacity: 0.5 }}>
                          No results for <strong style={{ opacity: 0.8 }}>"{query}"</strong>
                        </p>
                      </div>
                    )}
                  </Command.Empty>

                  {/* ── Recent searches (no query) ── */}
                  {!query.trim() && recentSearches.length > 0 && (
                    <Command.Group
                      heading={
                        <span style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "8px 16px 4px", fontSize: 10, fontWeight: 700,
                          letterSpacing: "0.08em", textTransform: "uppercase",
                          color: "var(--color-muted)", opacity: 0.5,
                        }}>
                          Recent
                          <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)", display: "block" }} />
                        </span>
                      }
                    >
                      {recentSearches.map(item => (
                        <Command.Item
                          key={`recent-${item.symbol}`}
                          value={`recent-${item.symbol}-${item.name}`}
                          onSelect={() => navigateToStock(item.symbol, item.name)}
                          style={itemStyle}
                        >
                          <Clock size={12} style={{ color: "var(--color-muted)", opacity: 0.4, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}>{item.symbol}</span>
                            <span style={{ fontSize: 11, color: "var(--color-muted)", marginLeft: 8 }}>{item.name}</span>
                          </div>
                          <button
                            className="recent-x"
                            tabIndex={-1}
                            onClick={e => handleRemoveRecent(e, item.symbol)}
                            aria-label={`Remove ${item.symbol}`}
                            style={{
                              background: "none", border: "none", cursor: "pointer",
                              color: "var(--color-muted)", opacity: 0,
                              padding: 4, borderRadius: 4,
                              display: "flex", alignItems: "center",
                              transition: "opacity 0.15s",
                            }}
                          >
                            <X size={10} />
                          </button>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  )}

                  {/* ── Default nav (no query, no recent) ── */}
                  {!query.trim() && recentSearches.length === 0 && (
                    <Command.Group
                      heading={
                        <span style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "8px 16px 4px", fontSize: 10, fontWeight: 700,
                          letterSpacing: "0.08em", textTransform: "uppercase",
                          color: "var(--color-muted)", opacity: 0.5,
                        }}>
                          Navigate
                          <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)", display: "block" }} />
                        </span>
                      }
                    >
                      {NAV_ITEMS.slice(0, 6).map(item => (
                        <Command.Item
                          key={item.href}
                          value={`${item.label} ${item.keywords.join(" ")}`}
                          onSelect={() => navigateToPage(item.href)}
                          style={itemStyle}
                        >
                          <div className="cmd-item-icon" style={{
                            width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.07)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "var(--color-muted)", transition: "all 0.15s",
                          }}>
                            {item.icon}
                          </div>
                          <span style={{ fontSize: 13, color: "var(--color-primary)" }}>{item.label}</span>
                          <ArrowRight className="cmd-arrow" size={11} style={{ color: ACCENT, marginLeft: "auto", opacity: 0, transition: "opacity 0.1s" }} />
                        </Command.Item>
                      ))}
                    </Command.Group>
                  )}

                  {/* ── Stock results ── */}
                  {query.trim() && stockResults.length > 0 && (
                    <Command.Group
                      heading={
                        <span style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "8px 16px 4px", fontSize: 10, fontWeight: 700,
                          letterSpacing: "0.08em", textTransform: "uppercase",
                          color: "var(--color-muted)", opacity: 0.5,
                        }}>
                          Stocks
                          <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)", display: "block" }} />
                        </span>
                      }
                    >
                      {stockResults.map(result => {
                        const isUp = (result.change ?? 0) >= 0;
                        return (
                          <Command.Item
                            key={result.symbol}
                            value={`${result.symbol} ${result.name} ${result.exchange}`}
                            onSelect={() => navigateToStock(result.symbol, result.name)}
                            style={itemStyle}
                          >
                            {/* Symbol badge */}
                            <div className="cmd-item-icon" style={{
                              width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                              background: "rgba(255,255,255,0.04)",
                              border: "1px solid rgba(255,255,255,0.07)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              transition: "all 0.15s",
                            }}>
                              <span className="cmd-sym-badge" style={{
                                fontSize: 9, fontWeight: 800,
                                color: "var(--color-muted)", letterSpacing: "0.03em",
                                transition: "color 0.15s",
                              }}>
                                {result.symbol.slice(0, 4)}
                              </span>
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)" }}>
                                  {result.symbol}
                                </span>
                                <span style={{
                                  fontSize: 10, color: "var(--color-muted)", opacity: 0.5,
                                  background: "rgba(255,255,255,0.04)", padding: "1px 5px", borderRadius: 4,
                                }}>
                                  {result.exchange}
                                </span>
                              </div>
                              <p style={{
                                margin: 0, fontSize: 11, color: "var(--color-muted)",
                                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220,
                              }}>
                                {result.name}
                              </p>
                            </div>

                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              {result.price !== undefined && (
                                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--color-primary)" }}>
                                  ${result.price.toFixed(2)}
                                </p>
                              )}
                              {result.change !== undefined && (
                                <p style={{
                                  margin: 0, fontSize: 11, fontWeight: 600,
                                  color: isUp ? BULL : BEAR,
                                  display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 2,
                                }}>
                                  {isUp ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                                  {isUp ? "+" : ""}{result.change.toFixed(2)}%
                                </p>
                              )}
                            </div>

                            <ArrowRight className="cmd-arrow" size={12} style={{ color: ACCENT, flexShrink: 0, opacity: 0, transition: "opacity 0.1s" }} />
                          </Command.Item>
                        );
                      })}
                    </Command.Group>
                  )}

                  {/* ── Nav results (when searching) ── */}
                  {query.trim() && (
                    <Command.Group
                      heading={
                        <span style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "8px 16px 4px", fontSize: 10, fontWeight: 700,
                          letterSpacing: "0.08em", textTransform: "uppercase",
                          color: "var(--color-muted)", opacity: 0.5,
                        }}>
                          Pages
                          <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)", display: "block" }} />
                        </span>
                      }
                    >
                      {NAV_ITEMS.map(item => (
                        <Command.Item
                          key={item.href}
                          value={`${item.label} ${item.keywords.join(" ")}`}
                          onSelect={() => navigateToPage(item.href)}
                          style={itemStyle}
                        >
                          <div className="cmd-item-icon" style={{
                            width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.07)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "var(--color-muted)", transition: "all 0.15s",
                          }}>
                            {item.icon}
                          </div>
                          <span style={{ fontSize: 13, color: "var(--color-primary)" }}>{item.label}</span>
                          <ArrowRight className="cmd-arrow" size={11} style={{ color: ACCENT, marginLeft: "auto", opacity: 0, transition: "opacity 0.1s" }} />
                        </Command.Item>
                      ))}
                    </Command.Group>
                  )}
                </Command.List>

                {/* ── Footer ── */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "9px 16px",
                  borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ display: "flex", gap: 3 }}><Kbd>↑</Kbd><Kbd>↓</Kbd></div>
                    <span style={{ fontSize: 10, color: "var(--color-muted)", opacity: 0.4 }}>navigate</span>
                    <Kbd>↵</Kbd>
                    <span style={{ fontSize: 10, color: "var(--color-muted)", opacity: 0.4 }}>select</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ position: "relative", display: "inline-flex", width: 6, height: 6 }}>
                      <span style={{
                        position: "absolute", inset: 0, borderRadius: "50%",
                        background: ACCENT, opacity: 0.5,
                        animation: "cmdPing 2s ease infinite",
                      }} />
                      <span style={{ position: "relative", width: 6, height: 6, borderRadius: "50%", background: ACCENT, display: "block" }} />
                    </span>
                    <span style={{ fontSize: 10, color: "var(--color-muted)", opacity: 0.3, letterSpacing: "0.05em" }}>
                      StockSense
                    </span>
                  </div>
                </div>
              </Command>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Header trigger button ────────────────────────────────────────────────────

export function CommandPaletteTrigger({ isDark }: { isDark: boolean }) {
  const fire = () => window.dispatchEvent(
    new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
  );

  return (
    <button
      onClick={fire}
      aria-label="Open command palette (⌘K)"
      style={{
        display: "flex", alignItems: "center", gap: 7,
        padding: "6px 12px", borderRadius: 8, cursor: "pointer",
        background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
        border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
        color: isDark ? "#555" : "#9ca3af",
        transition: "border-color 0.15s, color 0.15s",
        fontSize: 12,
        fontFamily: "var(--font-gantari,'Gantari',system-ui,sans-serif)",
      }}
      onMouseEnter={e => {
        const b = e.currentTarget as HTMLButtonElement;
        b.style.borderColor = `${ACCENT}44`;
        b.style.color = ACCENT;
      }}
      onMouseLeave={e => {
        const b = e.currentTarget as HTMLButtonElement;
        b.style.borderColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
        b.style.color = isDark ? "#555" : "#9ca3af";
      }}
    >
      <Search size={12} />
      <span>Search</span>
      <span style={{
        padding: "1px 5px", borderRadius: 4, fontSize: 10, fontWeight: 600,
        background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
        border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
        marginLeft: 2,
      }}>
        ⌘K
      </span>
    </button>
  );
}