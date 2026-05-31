"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchWithAuth } from "@/lib/auth";
import { useMarket } from "@/hooks/useMarket";
import {
  FileText, TrendingUp, TrendingDown, ChevronDown, ChevronUp,
  RefreshCw, Download, AlertCircle,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TaxLot {
  lotId: string; purchaseDate: string; qty: number;
  costPerShare: number; costBasis: number;
  currentPrice: number; currentValue: number;
  unrealizedGain: number; unrealizedGainPct: number;
}
interface TaxLotSymbol {
  symbol: string; currentPrice: number;
  totalCost: number; totalValue: number;
  totalGain: number; totalGainPct: number;
  lots: TaxLot[];
}
interface TaxTrade {
  date: string; qty: number; salePrice: number;
  proceeds: number; costBasis: number;
  gain: number; gainPct: number; type: "GAIN" | "LOSS";
}
interface TaxReportSymbol {
  symbol: string; totalProceeds: number;
  totalCostBasis: number; realizedGain: number;
  trades: TaxTrade[];
}
interface TaxReport {
  year: number; totalRealizedGain: number;
  symbols: TaxReportSymbol[]; hasActivity: boolean;
}

const APPLE = [0.22, 1, 0.36, 1] as const;
const C = {
  page: "var(--color-page)", card: "var(--color-card)",
  line: "var(--color-line)", primary: "var(--color-primary)",
  muted: "var(--color-muted)", hover: "var(--color-surface-hover)",
};

const fadeUp  = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.38, ease: APPLE } } };
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };

// ── Helpers ───────────────────────────────────────────────────────────────────

function ColorVal({ n, currency, showPct = false }: { n: number; currency: string; showPct?: boolean }) {
  const up  = n >= 0;
  const col = up ? "#22c55e" : "#ef4444";
  return (
    <span style={{ color: col, fontWeight: 600 }}>
      {up ? "+" : "-"}{currency}{Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      {showPct && ` (${up ? "+" : ""}${n.toFixed(2)}%)`}
    </span>
  );
}

function Pill({ type }: { type: "GAIN" | "LOSS" }) {
  const up = type === "GAIN";
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: up ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", color: up ? "#22c55e" : "#ef4444", border: `1px solid ${up ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}` }}>
      {type}
    </span>
  );
}

// ── Tax Lots Card ─────────────────────────────────────────────────────────────

function TaxLotCard({ sym, currency }: { sym: TaxLotSymbol; currency: string }) {
  const [open, setOpen] = useState(false);
  const up = sym.totalGain >= 0;

  return (
    <motion.div variants={fadeUp} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden", marginBottom: 10 }}>
      {/* Symbol header row */}
      <div onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", cursor: "pointer", userSelect: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: up ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", border: `1px solid ${up ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: up ? "#22c55e" : "#ef4444" }}>
            {sym.symbol.charAt(0)}
          </div>
          <div>
            <p style={{ color: C.primary, fontWeight: 700, fontSize: 14, margin: 0 }}>{sym.symbol}</p>
            <p style={{ color: C.muted, fontSize: 11, margin: "2px 0 0" }}>{sym.lots.length} open lot{sym.lots.length !== 1 ? "s" : ""} · {currency}{sym.currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })} current</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ textAlign: "right" }}>
            <p style={{ color: C.muted, fontSize: 10, margin: "0 0 2px", textTransform: "uppercase", letterSpacing: 0.5 }}>Unrealized Gain</p>
            <ColorVal n={sym.totalGain} currency={currency} showPct />
          </div>
          <div style={{ color: C.muted }}>{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
        </div>
      </div>

      {/* Lot rows */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: APPLE }}>
            {/* Column headers */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 0.7fr 1fr 1fr 1fr 1.2fr", padding: "8px 20px", background: C.hover, borderTop: `1px solid ${C.line}` }}>
              {["Lot", "Qty", "Cost/Share", "Cost Basis", "Current Value", "Unrealized G/L"].map((h, i) => (
                <span key={i} style={{ color: C.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</span>
              ))}
            </div>
            {sym.lots.map((lot, i) => (
              <div key={lot.lotId} style={{ display: "grid", gridTemplateColumns: "1fr 0.7fr 1fr 1fr 1fr 1.2fr", padding: "12px 20px", borderTop: `1px solid ${C.line}`, background: i % 2 === 0 ? "transparent" : C.hover }}>
                <div>
                  <p style={{ color: C.primary, fontSize: 12, fontWeight: 600, margin: 0 }}>Lot {i + 1}</p>
                  <p style={{ color: C.muted, fontSize: 10, margin: "2px 0 0" }}>{lot.purchaseDate}</p>
                </div>
                <span style={{ color: C.primary, fontSize: 12, alignSelf: "center" }}>{lot.qty.toLocaleString()}</span>
                <span style={{ color: C.muted, fontSize: 12, alignSelf: "center" }}>{currency}{lot.costPerShare.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                <span style={{ color: C.primary, fontSize: 12, alignSelf: "center" }}>{currency}{lot.costBasis.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                <span style={{ color: C.primary, fontSize: 12, alignSelf: "center" }}>{currency}{lot.currentValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                <div style={{ alignSelf: "center" }}>
                  <ColorVal n={lot.unrealizedGain} currency={currency} />
                  <span style={{ color: lot.unrealizedGain >= 0 ? "#22c55e" : "#ef4444", fontSize: 10, marginLeft: 4, opacity: 0.7 }}>({lot.unrealizedGain >= 0 ? "+" : ""}{lot.unrealizedGainPct.toFixed(2)}%)</span>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TaxPage() {
  const { market } = useMarket();
  const currency   = market.currency || "$";
  const currentYear = new Date().getFullYear();

  const [tab,         setTab]         = useState<"lots" | "report">("lots");
  const [taxLots,     setTaxLots]     = useState<TaxLotSymbol[]>([]);
  const [taxReport,   setTaxReport]   = useState<TaxReport | null>(null);
  const [year,        setYear]        = useState(currentYear);
  const [loading,     setLoading]     = useState(true);
  const [expandedSym, setExpandedSym] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [lotsRes, reportRes] = await Promise.all([
        fetchWithAuth("/api/portfolio/tax-lots"),
        fetchWithAuth(`/api/portfolio/tax-report?year=${year}`),
      ]);
      if (lotsRes.ok)   setTaxLots(await lotsRes.json());
      if (reportRes.ok) setTaxReport(await reportRes.json());
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [year]);

  // Summary stats for tax lots
  const totalUnrealized = taxLots.reduce((s, sym) => s + sym.totalGain, 0);
  const totalCost       = taxLots.reduce((s, sym) => s + sym.totalCost, 0);
  const totalValue      = taxLots.reduce((s, sym) => s + sym.totalValue, 0);

  const exportTaxCsv = () => {
    if (!taxReport) return;
    const rows: string[] = ["Symbol,Date,Qty,Sale Price,Proceeds,Cost Basis,Gain/Loss,Type"];
    taxReport.symbols.forEach(s => {
      s.trades.forEach(t => {
        rows.push(`${s.symbol},${t.date},${t.qty},${t.salePrice},${t.proceeds},${t.costBasis},${t.gain},${t.type}`);
      });
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `stocksense-tax-report-${year}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1100, margin: "0 auto", fontFamily: "var(--font-gantari,'Gantari',system-ui,sans-serif)", background: C.page, minHeight: "100vh" }}>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: APPLE }}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <FileText size={20} color="#8FFFD6" />
            <h1 style={{ color: C.primary, fontWeight: 700, fontSize: 20, margin: 0, letterSpacing: -0.3 }}>Tax & Lots</h1>
          </div>
          <p style={{ color: C.muted, fontSize: 12, margin: 0 }}>FIFO cost basis tracking · unrealized and realized gains</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {tab === "report" && taxReport?.hasActivity && (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={exportTaxCsv}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              <Download size={13} /> Export CSV
            </motion.button>
          )}
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }} onClick={loadData}
            style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <RefreshCw size={14} />
          </motion.button>
        </div>
      </motion.div>

      {/* Tab switcher */}
      <div style={{ display: "flex", gap: 2, marginBottom: 20, background: C.line, borderRadius: 10, padding: 3, width: "fit-content" }}>
        {(["lots", "report"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, background: tab === t ? C.card : "transparent", color: tab === t ? "#8FFFD6" : C.muted, transition: "all 0.15s" }}>
            {t === "lots" ? "Open Lots" : "Tax Report"}
          </button>
        ))}
      </div>

      {/* ── Open Lots Tab ── */}
      {tab === "lots" && (
        <>
          {/* Summary cards */}
          <motion.div initial="hidden" animate="visible" variants={stagger}
            style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
            {[
              { label: "Total Cost Basis", value: `${currency}${totalCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, color: C.muted },
              { label: "Current Value",    value: `${currency}${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, color: C.primary },
              { label: "Unrealized Gain",  value: `${totalUnrealized >= 0 ? "+" : "-"}${currency}${Math.abs(totalUnrealized).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, color: totalUnrealized >= 0 ? "#22c55e" : "#ef4444" },
            ].map(({ label, value, color }) => (
              <motion.div key={label} variants={fadeUp}
                style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 22px" }}>
                <p style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.7, margin: "0 0 8px" }}>{label}</p>
                <p style={{ color, fontWeight: 700, fontSize: 20, margin: 0, letterSpacing: -0.3 }}>{value}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Disclaimer */}
          <div style={{ display: "flex", gap: 8, padding: "10px 14px", background: "rgba(143,255,214,0.06)", border: "1px solid rgba(143,255,214,0.2)", borderRadius: 10, marginBottom: 20 }}>
            <AlertCircle size={14} color="#8FFFD6" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ color: C.muted, fontSize: 12, margin: 0 }}>Cost basis calculated using <strong style={{ color: C.primary }}>FIFO</strong> method. Consult a tax professional for filing purposes.</p>
          </div>

          {/* Lots */}
          {loading ? (
            <div style={{ padding: 48, textAlign: "center" }}>
              <div style={{ width: 28, height: 28, border: `2px solid ${C.line}`, borderTop: "2px solid #8FFFD6", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
              <p style={{ color: C.muted, fontSize: 13 }}>Loading lots…</p>
            </div>
          ) : taxLots.length === 0 ? (
            <div style={{ padding: 52, textAlign: "center", background: C.card, border: `1px solid ${C.line}`, borderRadius: 14 }}>
              <p style={{ fontSize: 32, margin: "0 0 12px" }}>📋</p>
              <p style={{ color: C.primary, fontSize: 14, fontWeight: 600, margin: "0 0 6px" }}>No open lots</p>
              <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>Place buy orders to start tracking cost basis.</p>
            </div>
          ) : (
            <motion.div initial="hidden" animate="visible" variants={stagger}>
              {taxLots.map(sym => <TaxLotCard key={sym.symbol} sym={sym} currency={currency} />)}
            </motion.div>
          )}
        </>
      )}

      {/* ── Tax Report Tab ── */}
      {tab === "report" && (
        <>
          {/* Year selector */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <span style={{ color: C.muted, fontSize: 13 }}>Tax Year:</span>
            <div style={{ display: "flex", gap: 6 }}>
              {[currentYear - 1, currentYear].map(y => (
                <button key={y} onClick={() => setYear(y)}
                  style={{ padding: "6px 16px", borderRadius: 8, border: `1px solid ${year === y ? "#8FFFD6" : C.line}`, background: year === y ? "#8FFFD618" : "transparent", color: year === y ? "#8FFFD6" : C.muted, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                  {y}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 48, textAlign: "center" }}>
              <div style={{ width: 28, height: 28, border: `2px solid ${C.line}`, borderTop: "2px solid #8FFFD6", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
              <p style={{ color: C.muted, fontSize: 13 }}>Loading report…</p>
            </div>
          ) : !taxReport?.hasActivity ? (
            <div style={{ padding: 52, textAlign: "center", background: C.card, border: `1px solid ${C.line}`, borderRadius: 14 }}>
              <p style={{ fontSize: 32, margin: "0 0 12px" }}>📊</p>
              <p style={{ color: C.primary, fontSize: 14, fontWeight: 600, margin: "0 0 6px" }}>No realized gains in {year}</p>
              <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>No sell orders were executed in this tax year.</p>
            </div>
          ) : (
            <>
              {/* Total realized gain card */}
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: APPLE }}
                style={{ background: C.card, border: `1px solid ${taxReport.totalRealizedGain >= 0 ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`, borderRadius: 14, padding: "22px 28px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.7, margin: "0 0 6px" }}>Total Realized Gain / Loss — {year}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {taxReport.totalRealizedGain >= 0 ? <TrendingUp size={18} color="#22c55e" /> : <TrendingDown size={18} color="#ef4444" />}
                    <span style={{ color: taxReport.totalRealizedGain >= 0 ? "#22c55e" : "#ef4444", fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>
                      {taxReport.totalRealizedGain >= 0 ? "+" : "-"}{currency}{Math.abs(taxReport.totalRealizedGain).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ color: C.muted, fontSize: 11, margin: "0 0 4px" }}>Symbols with activity</p>
                  <p style={{ color: "#8FFFD6", fontSize: 20, fontWeight: 700, margin: 0 }}>{taxReport.symbols.length}</p>
                </div>
              </motion.div>

              {/* Per-symbol trade breakdown */}
              {taxReport.symbols.map((sym, si) => (
                <motion.div key={sym.symbol} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: si * 0.05, duration: 0.35, ease: APPLE }}
                  style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden", marginBottom: 12 }}>
                  {/* Symbol header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${C.line}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: sym.realizedGain >= 0 ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: sym.realizedGain >= 0 ? "#22c55e" : "#ef4444" }}>
                        {sym.symbol.charAt(0)}
                      </div>
                      <p style={{ color: C.primary, fontWeight: 700, fontSize: 14, margin: 0 }}>{sym.symbol}</p>
                    </div>
                    <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ color: C.muted, fontSize: 10, margin: "0 0 2px" }}>Proceeds</p>
                        <p style={{ color: C.primary, fontSize: 13, fontWeight: 600, margin: 0 }}>{currency}{sym.totalProceeds.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ color: C.muted, fontSize: 10, margin: "0 0 2px" }}>Cost Basis</p>
                        <p style={{ color: C.muted, fontSize: 13, fontWeight: 600, margin: 0 }}>{currency}{sym.totalCostBasis.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ color: C.muted, fontSize: 10, margin: "0 0 2px" }}>Net Gain/Loss</p>
                        <ColorVal n={sym.realizedGain} currency={currency} />
                      </div>
                    </div>
                  </div>

                  {/* Trade rows */}
                  <div style={{ padding: "8px 20px 4px", background: C.hover }}>
                    {["Date", "Qty", "Sale Price", "Proceeds", "Cost Basis", "Gain/Loss", ""].map((h, i) => (
                      <span key={i} style={{ display: "inline-block", width: `${[14, 8, 12, 14, 14, 14, 10][i]}%`, color: C.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{h}</span>
                    ))}
                  </div>
                  {sym.trades.map((t, ti) => (
                    <div key={ti} style={{ padding: "10px 20px", borderTop: `1px solid ${C.line}`, background: ti % 2 === 0 ? "transparent" : C.hover }}>
                      {[t.date, t.qty, `${currency}${t.salePrice.toFixed(2)}`, `${currency}${t.proceeds.toFixed(2)}`, `${currency}${t.costBasis.toFixed(2)}`].map((v, vi) => (
                        <span key={vi} style={{ display: "inline-block", width: `${[14, 8, 12, 14, 14][vi]}%`, color: C.primary, fontSize: 12 }}>{v}</span>
                      ))}
                      <span style={{ display: "inline-block", width: "14%" }}>
                        <ColorVal n={t.gain} currency={currency} />
                      </span>
                      <span style={{ display: "inline-block", width: "10%" }}>
                        <Pill type={t.type} />
                      </span>
                    </div>
                  ))}
                </motion.div>
              ))}
            </>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}