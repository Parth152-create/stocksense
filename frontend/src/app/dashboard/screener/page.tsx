"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { fetchWithAuth } from "@/lib/auth";
import { useMarket } from "@/lib/MarketContext";
import {
  Search, SlidersHorizontal, TrendingUp, TrendingDown,
  RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, Filter,
} from "lucide-react";

interface ScreenerRow {
  symbol: string; name: string; sector: string; market: string;
  price: number; change: number; changePct: number;
  volume: number; currency: string; exchange: string;
}
interface ScreenerResponse {
  market: string; results: ScreenerRow[]; count: number; sectors: string[];
}
type SortBy  = "changePct" | "price" | "volume" | "name";
type SortDir = "asc" | "desc";

const C = {
  page: "var(--color-page)", card: "var(--color-card)",
  line: "var(--color-line)", primary: "var(--color-primary)",
  muted: "var(--color-muted)", hover: "var(--color-surface-hover)",
};
const APPLE = [0.22, 1, 0.36, 1] as const;

const PRESETS = [
  { label: "Top Gainers", minChange:  2,   maxChange: 100,  sortBy: "changePct" as SortBy, sortDir: "desc" as SortDir },
  { label: "Top Losers",  minChange: -100, maxChange: -2,   sortBy: "changePct" as SortBy, sortDir: "asc"  as SortDir },
  { label: "Most Active", minChange: -100, maxChange: 100,  sortBy: "volume"    as SortBy, sortDir: "desc" as SortDir },
  { label: "Under $50",   minChange: -100, maxChange: 100,  sortBy: "price"     as SortBy, sortDir: "asc"  as SortDir, maxPrice: 50 },
  { label: "All",         minChange: -100, maxChange: 100,  sortBy: "changePct" as SortBy, sortDir: "desc" as SortDir },
];

function SkeletonRow() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, padding: "13px 16px", borderBottom: `1px solid ${C.line}`, alignItems: "center" }}>
      {[140, 70, 70].map((w, i) => (
        <div key={i} style={{ height: i === 0 ? 14 : 12, width: w, borderRadius: 4, background: C.line, opacity: 0.5 }} />
      ))}
    </div>
  );
}

function SortIcon({ col, sortBy, sortDir }: { col: SortBy; sortBy: SortBy; sortDir: SortDir }) {
  if (col !== sortBy) return <ArrowUpDown size={11} style={{ opacity: 0.3 }} />;
  return sortDir === "desc" ? <ArrowDown size={11} color="#8FFFD6" /> : <ArrowUp size={11} color="#8FFFD6" />;
}

export default function ScreenerPage() {
  const router     = useRouter();
  const { market } = useMarket();

  const [results,      setResults]      = useState<ScreenerRow[]>([]);
  const [sectors,      setSectors]      = useState<string[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [searched,     setSearched]     = useState(false);
  const [sector,       setSector]       = useState("");
  const [minChange,    setMinChange]    = useState("-100");
  const [maxChange,    setMaxChange]    = useState("100");
  const [minPrice,     setMinPrice]     = useState("0");
  const [maxPrice,     setMaxPrice]     = useState("999999");
  const [sortBy,       setSortBy]       = useState<SortBy>("changePct");
  const [sortDir,      setSortDir]      = useState<SortDir>("desc");
  const [limit,        setLimit]        = useState(20);
  const [activePreset, setActivePreset] = useState("All");
  const [filtersOpen,  setFiltersOpen]  = useState(false);
  const [query,        setQuery]        = useState("");

  useEffect(() => {
    setSector(""); setResults([]); setSearched(false);
    fetchWithAuth(`/api/screener?market=${market.id}&limit=1`)
      .then(r => r.ok ? r.json() : null)
      .then((data: ScreenerResponse | null) => { if (data?.sectors) setSectors(data.sectors); })
      .catch(() => {});
  }, [market.id]);

  const runScreener = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ market: market.id, minChange, maxChange, minPrice, maxPrice, sortBy, sortDir, limit: String(limit) });
      if (sector) params.set("sector", sector);
      const res = await fetchWithAuth(`/api/screener?${params}`);
      if (!res.ok) return;
      const data: ScreenerResponse = await res.json();
      setResults(data.results ?? []);
      if (data.sectors?.length) setSectors(data.sectors);
      setSearched(true);
    } catch { }
    finally { setLoading(false); }
  }, [market.id, sector, minChange, maxChange, minPrice, maxPrice, sortBy, sortDir, limit]);

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setActivePreset(preset.label);
    setMinChange(String(preset.minChange));
    setMaxChange(String(preset.maxChange));
    setSortBy(preset.sortBy);
    setSortDir(preset.sortDir);
    if ("maxPrice" in preset) setMaxPrice(String(preset.maxPrice));
    else setMaxPrice("999999");
  };

  const toggleSort = (col: SortBy) => {
    if (sortBy === col) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortBy(col); setSortDir("desc"); }
  };

  const filtered = query.trim()
    ? results.filter(r => r.symbol.toLowerCase().includes(query.toLowerCase()) || r.name.toLowerCase().includes(query.toLowerCase()) || r.sector.toLowerCase().includes(query.toLowerCase()))
    : results;

  const fmt = (row: ScreenerRow) => {
    const sym = row.currency === "INR" ? "₹" : "$";
    return `${sym}${row.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  };

  const inputStyle = {
    width: "100%", padding: "9px 12px", borderRadius: 8, background: C.page,
    border: `1px solid ${C.line}`, color: C.primary, fontSize: 13,
    fontFamily: "inherit", boxSizing: "border-box" as const,
  };

  return (
    <div style={{ padding: "16px", maxWidth: 1200, margin: "0 auto", fontFamily: "var(--font-gantari,'Gantari',system-ui,sans-serif)", background: C.page, minHeight: "100vh", boxSizing: "border-box" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .sc-row:hover { background: var(--color-surface-hover) !important; }

        /* Table: 5-col desktop → 3-col mobile */
        .sc-cols { grid-template-columns: 2fr 1fr 1fr 1fr 1fr; }
        .sc-row-grid { grid-template-columns: 2fr 1fr 1fr 1fr 1fr; }
        @media (max-width: 640px) {
          .sc-cols, .sc-row-grid { grid-template-columns: 2fr 1fr 1fr !important; }
          .sc-hide { display: none !important; }
        }

        /* Header wrap */
        .sc-header { flex-wrap: wrap; gap: 10px; }
        .sc-actions { display: flex; gap: 8px; flex-shrink: 0; }

        /* Presets: scroll horizontally on mobile */
        .sc-presets { overflow-x: auto; padding-bottom: 4px; flex-wrap: nowrap !important; }
        .sc-presets::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="sc-header"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ color: C.primary, fontWeight: 700, fontSize: 20, margin: 0, letterSpacing: -0.3 }}>Stock Screener</h1>
          <p style={{ color: C.muted, fontSize: 12, margin: "4px 0 0" }}>{market.flag} {market.label} · Filter and discover stocks</p>
        </div>
        <div className="sc-actions">
          <button onClick={() => setFiltersOpen(f => !f)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 12px", borderRadius: 10, border: `1px solid ${filtersOpen ? "#8FFFD6" : C.line}`, background: filtersOpen ? "rgba(143,255,214,0.08)" : "transparent", color: filtersOpen ? "#8FFFD6" : C.muted, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            <Filter size={13} /> Filters
          </button>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={runScreener} disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: "linear-gradient(135deg,#8FFFD6,#00c896)", borderRadius: 10, border: "none", cursor: loading ? "not-allowed" : "pointer", color: "#0a0a0a", fontWeight: 700, fontSize: 13, opacity: loading ? 0.7 : 1 }}>
            {loading
              ? <div style={{ width: 13, height: 13, borderRadius: "50%", border: "2px solid #0a0a0a33", borderTop: "2px solid #0a0a0a", animation: "spin 0.7s linear infinite" }} />
              : <Search size={13} />}
            Screen
          </motion.button>
        </div>
      </motion.div>

      {/* Preset pills */}
      <div className="sc-presets" style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {PRESETS.map(p => (
          <button key={p.label} onClick={() => applyPreset(p)}
            style={{ padding: "6px 14px", borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0, background: activePreset === p.label ? "#8FFFD6" : C.card, color: activePreset === p.label ? "#0a0a0a" : C.muted, border: activePreset === p.label ? "none" : `1px solid ${C.line}`, transition: "all 0.15s" }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Advanced filters */}
      <AnimatePresence>
        {filtersOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} style={{ overflow: "hidden", marginBottom: 14 }}>
            <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <SlidersHorizontal size={13} color="#8FFFD6" />
                <span style={{ color: C.primary, fontWeight: 600, fontSize: 13 }}>Advanced Filters</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
                <div>
                  <label style={{ display: "block", color: C.muted, fontSize: 11, marginBottom: 5, fontWeight: 500 }}>Sector</label>
                  <select value={sector} onChange={e => setSector(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                    <option value="">All Sectors</option>
                    {sectors.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {[
                  { label: "Min Change %", val: minChange, set: setMinChange },
                  { label: "Max Change %", val: maxChange, set: setMaxChange },
                  { label: "Min Price",    val: minPrice,  set: setMinPrice  },
                  { label: "Max Price",    val: maxPrice,  set: setMaxPrice  },
                ].map(({ label, val, set }) => (
                  <div key={label}>
                    <label style={{ display: "block", color: C.muted, fontSize: 11, marginBottom: 5, fontWeight: 500 }}>{label}</label>
                    <input type="number" value={val} onChange={e => set(e.target.value)} style={inputStyle} />
                  </div>
                ))}
                <div>
                  <label style={{ display: "block", color: C.muted, fontSize: 11, marginBottom: 5, fontWeight: 500 }}>Results</label>
                  <select value={limit} onChange={e => setLimit(Number(e.target.value))} style={{ ...inputStyle, cursor: "pointer" }}>
                    {[10, 20, 30, 50].map(n => <option key={n} value={n}>{n} results</option>)}
                  </select>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search within results */}
      {searched && results.length > 0 && (
        <div style={{ position: "relative", marginBottom: 12 }}>
          <Search size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.muted }} />
          <input placeholder="Search results…" value={query} onChange={e => setQuery(e.target.value)}
            style={{ width: "100%", padding: "9px 12px 9px 34px", borderRadius: 10, background: C.card, border: `1px solid ${C.line}`, color: C.primary, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", outline: "none" }} />
        </div>
      )}

      {/* Results table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: APPLE }}
        style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden" }}>

        {/* Column headers */}
        <div className="sc-cols" style={{ display: "grid", padding: "10px 16px", borderBottom: `1px solid ${C.line}`, background: C.hover }}>
          {([
            { key: "name",      label: "Symbol / Name" },
            { key: "price",     label: "Price"         },
            { key: "changePct", label: "Change %"      },
            { key: "volume",    label: "Volume",  hide: true },
            { key: null,        label: "Sector",  hide: true },
          ] as { key: SortBy | null; label: string; hide?: boolean }[]).map(({ key, label, hide }) => (
            <button key={label} className={hide ? "sc-hide" : ""}
              onClick={() => key && toggleSort(key)}
              style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: key ? "pointer" : "default", color: C.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, padding: 0 }}>
              {label}
              {key && <SortIcon col={key} sortBy={sortBy} sortDir={sortDir} />}
            </button>
          ))}
        </div>

        {!searched && !loading && (
          <div style={{ padding: 48, textAlign: "center" }}>
            <p style={{ fontSize: 32, margin: "0 0 10px" }}>🔍</p>
            <p style={{ color: C.primary, fontSize: 14, fontWeight: 600, margin: "0 0 6px" }}>Ready to screen</p>
            <p style={{ color: C.muted, fontSize: 13 }}>Select a preset or configure filters, then click Screen.</p>
          </div>
        )}

        {loading && <div>{Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}</div>}

        {searched && !loading && filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: "center" }}>
            <p style={{ fontSize: 28, margin: "0 0 10px" }}>📭</p>
            <p style={{ color: C.primary, fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>No results</p>
            <p style={{ color: C.muted, fontSize: 13 }}>Try widening your filters.</p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.03 } } }}>
            {filtered.map((row, i) => {
              const isUp   = row.changePct >= 0;
              const navSym = row.symbol.replace(/\.(BSE|NSE)$/i, "");
              return (
                <motion.div key={row.symbol} className="sc-row sc-row-grid"
                  variants={{ hidden: { opacity: 0, x: -8 }, visible: { opacity: 1, x: 0 } }}
                  transition={{ duration: 0.25, ease: APPLE }}
                  onClick={() => router.push(`/dashboard/stock/${navSym}?market=${row.market}`)}
                  style={{ display: "grid", padding: "12px 16px", borderBottom: i < filtered.length - 1 ? `1px solid ${C.line}` : "none", cursor: "pointer", alignItems: "center", background: "transparent", transition: "background 0.12s" }}>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: isUp ? "rgba(143,255,214,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${isUp ? "rgba(143,255,214,0.2)" : "rgba(239,68,68,0.2)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: isUp ? "#8FFFD6" : "#ef4444" }}>
                      {row.symbol.replace(/\.(BSE|NSE)$/i, "").slice(0, 2)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ color: C.primary, fontWeight: 600, fontSize: 13, margin: 0 }}>{row.symbol.replace(/\.(BSE|NSE)$/i, "")}</p>
                      <p style={{ color: C.muted, fontSize: 11, margin: "1px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>{row.name}</p>
                    </div>
                  </div>

                  <span style={{ color: C.primary, fontSize: 13, fontWeight: 600 }}>{fmt(row)}</span>

                  <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 7px", borderRadius: 7, background: isUp ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${isUp ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`, width: "fit-content" }}>
                    {isUp ? <TrendingUp size={10} color="#22c55e" /> : <TrendingDown size={10} color="#ef4444" />}
                    <span style={{ color: isUp ? "#22c55e" : "#ef4444", fontSize: 11, fontWeight: 700 }}>{isUp ? "+" : ""}{row.changePct.toFixed(2)}%</span>
                  </div>

                  <span className="sc-hide" style={{ color: C.muted, fontSize: 12 }}>
                    {row.volume >= 1_000_000 ? `${(row.volume / 1_000_000).toFixed(1)}M` : row.volume >= 1_000 ? `${(row.volume / 1_000).toFixed(0)}K` : String(row.volume)}
                  </span>

                  <span className="sc-hide" style={{ fontSize: 11, color: C.muted, background: C.hover, padding: "3px 8px", borderRadius: 6, border: `1px solid ${C.line}`, display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 110 }}>
                    {row.sector}
                  </span>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {searched && filtered.length > 0 && (
          <div style={{ padding: "10px 16px", borderTop: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: C.muted, fontSize: 12 }}>{filtered.length} result{filtered.length !== 1 ? "s" : ""}{query ? ` matching "${query}"` : ""}</span>
            <button onClick={runScreener} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 12 }}>
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}