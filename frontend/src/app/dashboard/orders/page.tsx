"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMarket } from "@/hooks/useMarket";
import { useToast } from "@/components/ToastContext";
import { Download, RefreshCw, Search, Clock, CheckCircle2, XCircle } from "lucide-react";
import { fetchWithAuth } from "@/lib/auth";
import { exportOrdersCsv } from "@/lib/csv-export";

interface OrderRow {
  id: string;
  userId: string;
  symbol: string;
  market: string;
  type: "BUY" | "SELL";
  kind?: "MARKET" | "LIMIT" | "STOP_LOSS";
  quantity: number;
  price: number;
  total: number;
  limitPrice?: number;
  createdAt: string;
  status: "FILLED" | "EXECUTED" | "PENDING" | "CANCELLED" | "REJECTED";
}

const C = {
  page:    "var(--color-page)",
  card:    "var(--color-card)",
  line:    "var(--color-line)",
  primary: "var(--color-primary)",
  muted:   "var(--color-muted)",
  hover:   "var(--color-surface-hover)",
};

const APPLE = [0.22, 1, 0.36, 1] as const;

const STATUS_CONFIG: Record<string, {
  label: string; color: string; bg: string; border: string;
  icon: React.ReactNode; rowBg: string;
}> = {
  FILLED:    { label: "Filled",    color: "#22c55e", bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.25)",   icon: <CheckCircle2 size={11} />, rowBg: "transparent" },
  EXECUTED:  { label: "Filled",    color: "#22c55e", bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.25)",   icon: <CheckCircle2 size={11} />, rowBg: "transparent" },
  PENDING:   { label: "Pending",   color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.3)",   icon: <Clock size={11} />,        rowBg: "rgba(245,158,11,0.03)" },
  CANCELLED: { label: "Cancelled", color: "var(--color-muted)", bg: "var(--color-surface-hover)", border: "var(--color-line)", icon: <XCircle size={11} />, rowBg: "transparent" },
  REJECTED:  { label: "Rejected",  color: "#ef4444", bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.25)",   icon: <XCircle size={11} />,      rowBg: "rgba(239,68,68,0.02)" },
};

const KIND_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  MARKET:    { label: "MKT",  color: "#8FFFD6", bg: "rgba(143,255,214,0.1)",  border: "rgba(143,255,214,0.2)"  },
  LIMIT:     { label: "LMT",  color: "#818cf8", bg: "rgba(129,140,248,0.12)", border: "rgba(129,140,248,0.25)" },
  STOP_LOSS: { label: "STOP", color: "#fb923c", bg: "rgba(251,146,60,0.12)",  border: "rgba(251,146,60,0.25)"  },
};

function getStatus(s: string) { return STATUS_CONFIG[s] ?? STATUS_CONFIG.FILLED; }
function getKind(k?: string)   { return KIND_CONFIG[k ?? "MARKET"] ?? KIND_CONFIG.MARKET; }

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
}

function PendingPulse() {
  return (
    <motion.span animate={{ opacity: [1, 0.35, 1] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", marginLeft: 5, verticalAlign: "middle" }} />
  );
}

const PAGE_SIZE = 20;
const fadeUp  = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: APPLE } } };
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };
const cardV   = { hidden: { opacity: 0, y: 18, scale: 0.97 }, visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: APPLE } } };

// ── Mobile order card ─────────────────────────────────────────────────────────
function OrderCard({ order, currency, onCancel }: {
  order: OrderRow; currency: string; onCancel: (id: string) => void;
}) {
  const sc        = getStatus(order.status);
  const kc        = getKind(order.kind);
  const isPending = order.status === "PENDING";
  const isDimmed  = order.status === "CANCELLED" || order.status === "REJECTED";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      style={{
        background: C.card, border: `1px solid ${C.line}`, borderRadius: 12,
        padding: "14px 16px", opacity: isDimmed ? 0.55 : 1,
        borderLeft: isPending ? "3px solid #f59e0b" : `3px solid transparent`,
      }}>
      {/* Row 1: symbol + badges + amount */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <p style={{ color: C.primary, fontWeight: 700, fontSize: 14, margin: 0 }}>
            {order.symbol.replace(/\.(BSE|NSE)$/i, "")}
          </p>
          {isPending && <PendingPulse />}
          <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 700, color: order.type === "BUY" ? "#22c55e" : "#ef4444", background: order.type === "BUY" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", border: `1px solid ${order.type === "BUY" ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}` }}>
            {order.type}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 700, color: kc.color, background: kc.bg, border: `1px solid ${kc.border}` }}>
            {kc.label}
          </span>
        </div>
        <p style={{ color: isDimmed ? C.muted : C.primary, fontWeight: 700, fontSize: 14, margin: 0 }}>
          {currency}{(order.total ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </p>
      </div>

      {/* Row 2: qty × price + status + date */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 12 }}>
          <span style={{ color: C.muted, fontSize: 12 }}>
            {order.quantity?.toLocaleString()} × {currency}{(order.price ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
          {order.limitPrice && (
            <span style={{ color: kc.color, fontSize: 12, fontWeight: 600 }}>
              @ {currency}{order.limitPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          )}
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 700, color: sc.color, background: sc.bg, border: `1px solid ${sc.border}` }}>
          {sc.icon}{sc.label}
        </span>
      </div>

      {/* Row 3: date + cancel */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
        <span style={{ color: C.muted, fontSize: 11 }}>{formatDate(order.createdAt)}</span>
        {isPending && (
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.92 }}
            onClick={() => onCancel(order.id)}
            style={{ padding: "4px 10px", borderRadius: 7, border: "1px solid rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.08)", color: "#ef4444", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
            Cancel
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

export default function OrdersPage() {
  const { market } = useMarket();
  const { toast }  = useToast();
  const currency   = market.currency || "$";

  const [orders,       setOrders]       = useState<OrderRow[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [hasMore,      setHasMore]      = useState(true);
  const [currentPage,  setCurrentPage]  = useState(0);
  const [totalOrders,  setTotalOrders]  = useState(0);
  const [search,       setSearch]       = useState("");
  const [typeFilter,   setTypeFilter]   = useState<"ALL"|"BUY"|"SELL">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL"|"FILLED"|"PENDING"|"CANCELLED">("ALL");
  const [isMobile,     setIsMobile]     = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const normalise   = (o: any): OrderRow => ({ ...o, quantity: o.quantity ?? o.qty ?? 0 });

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const loadInitial = useCallback(async () => {
    setLoading(true); setOrders([]); setCurrentPage(0); setHasMore(true);
    try {
      const res = await fetchWithAuth(`/api/orders/paginated?page=0&size=${PAGE_SIZE}`);
      if (res.ok) {
        const data = await res.json();
        setOrders((data.orders ?? []).map(normalise));
        setHasMore(data.hasMore ?? false);
        setTotalOrders(data.totalOrders ?? 0);
        setCurrentPage(1);
      }
    } catch { } finally { setLoading(false); }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await fetchWithAuth(`/api/orders/paginated?page=${currentPage}&size=${PAGE_SIZE}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(prev => [...prev, ...(data.orders ?? []).map(normalise)]);
        setHasMore(data.hasMore ?? false);
        setCurrentPage(p => p + 1);
      }
    } catch { } finally { setLoadingMore(false); }
  }, [loadingMore, hasMore, currentPage]);

  const cancelOrder = useCallback(async (orderId: string) => {
    try {
      const res = await fetchWithAuth(`/api/orders/${orderId}`, { method: "DELETE" });
      if (res.ok) {
        toast("Order cancelled successfully", "success");
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: "CANCELLED" } : o));
      } else {
        const err = await res.json().catch(() => ({}));
        toast((err as any).message || "Failed to cancel order", "error");
      }
    } catch { toast("Network error", "error"); }
  }, [toast]);

  useEffect(() => { loadInitial(); }, [loadInitial]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) loadMore(); }, { threshold: 0.1 }
    );
    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current);
    return () => observerRef.current?.disconnect();
  }, [loadMore]);

  const handleExportCsv = async () => {
    try {
      const res = await fetchWithAuth("/api/orders");
      if (res.ok) {
        const all = await res.json();
        exportOrdersCsv(all.map((o: any) => ({ ...o, qty: o.quantity ?? o.qty ?? 0 })));
      }
    } catch { }
  };

  const filtered = orders.filter(o => {
    const matchSearch = o.symbol.toLowerCase().includes(search.toLowerCase()) || o.id.toLowerCase().includes(search.toLowerCase());
    const matchType   = typeFilter === "ALL" || o.type === typeFilter;
    const eff         = o.status === "EXECUTED" ? "FILLED" : o.status;
    const matchStatus = statusFilter === "ALL" || eff === statusFilter || o.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  const totalBuys  = orders.filter(o => o.type === "BUY").length;
  const totalSells = orders.filter(o => o.type === "SELL").length;
  const totalValue = orders.reduce((s, o) => s + (o.total ?? 0), 0);
  const pending    = orders.filter(o => o.status === "PENDING").length;

  return (
    <motion.div initial="hidden" animate="visible" variants={stagger}
      style={{ padding: "16px", maxWidth: 1200, margin: "0 auto", fontFamily: "var(--font-gantari,'Gantari',system-ui,sans-serif)", background: C.page, minHeight: "100vh", boxSizing: "border-box" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pendingPulse { 0%,100%{opacity:1} 50%{opacity:.35} }

        /* Stats grid: 4 → 2 */
        .ord-stats { grid-template-columns: repeat(4,1fr); }
        @media (max-width: 600px) { .ord-stats { grid-template-columns: repeat(2,1fr); } }

        /* Filters: row → wrap */
        .ord-filters { flex-wrap: nowrap; }
        @media (max-width: 640px) { .ord-filters { flex-wrap: wrap; } }

        /* Filter pill groups: shrink text on small */
        @media (max-width: 480px) {
          .ord-pill { padding: 5px 7px !important; font-size: 10px !important; }
        }

        /* Desktop table columns */
        .ord-row { grid-template-columns: 1.6fr 72px 80px 108px 1fr 1fr 1fr 130px 80px; }

        /* Header wrap */
        .ord-header { flex-wrap: wrap; gap: 10px; }
      `}</style>

      {/* Header */}
      <motion.div variants={fadeUp} className="ord-header"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ color: C.primary, fontWeight: 700, fontSize: 20, margin: 0, letterSpacing: -0.3 }}>Order History</h1>
          <p style={{ color: C.muted, fontSize: 12, margin: "4px 0 0" }}>
            {market.flag} {market.label} · {totalOrders} total
            {pending > 0 && <span style={{ marginLeft: 8, color: "#f59e0b", fontWeight: 600 }}>· {pending} pending</span>}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleExportCsv}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 12px", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            <Download size={13} /><span className="ord-btn-label">Export</span>
          </motion.button>
          <motion.button onClick={loadInitial} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }}
            style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <RefreshCw size={14} />
          </motion.button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={stagger} className="ord-stats" style={{ display: "grid", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Total",   value: totalOrders, color: "#8FFFD6" },
          { label: "Buys",    value: totalBuys,   color: "#22c55e" },
          { label: "Sells",   value: totalSells,  color: "#ef4444" },
          { label: "Pending", value: pending,      color: "#f59e0b" },
        ].map(({ label, value, color }) => (
          <motion.div key={label} variants={cardV}
            style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 14px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, right: 0, width: 60, height: 60, borderRadius: "50%", background: `radial-gradient(circle, ${color}12 0%, transparent 70%)`, pointerEvents: "none" }} />
            <p style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 4px" }}>{label}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <p style={{ color, fontWeight: 700, fontSize: 22, margin: 0 }}>{value}</p>
              {label === "Pending" && value > 0 && <PendingPulse />}
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Filters */}
      <motion.div variants={fadeUp} className="ord-filters" style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
          <Search size={14} color="var(--color-muted)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Symbol or order ID…"
            style={{ width: "100%", background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, color: C.primary, fontSize: 13, padding: "10px 12px 10px 34px", outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ display: "flex", gap: 2, background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 3, flexShrink: 0 }}>
          {(["ALL", "BUY", "SELL"] as const).map(f => (
            <button key={f} className="ord-pill" onClick={() => setTypeFilter(f)}
              style={{ padding: "5px 10px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, transition: "all 0.15s",
                background: typeFilter === f ? C.page : "transparent",
                color: typeFilter === f ? (f === "BUY" ? "#22c55e" : f === "SELL" ? "#ef4444" : "#8FFFD6") : C.muted }}>
              {f}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 2, background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 3, flexShrink: 0 }}>
          {(["ALL", "FILLED", "PENDING", "CANCELLED"] as const).map(f => (
            <button key={f} className="ord-pill" onClick={() => setStatusFilter(f)}
              style={{ padding: "5px 10px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, transition: "all 0.15s",
                background: statusFilter === f ? C.page : "transparent",
                color: statusFilter === f ? (f === "PENDING" ? "#f59e0b" : f === "CANCELLED" ? C.muted : f === "FILLED" ? "#22c55e" : "#8FFFD6") : C.muted }}>
              {/* Abbreviate on mobile */}
              {f === "CANCELLED" ? "CNCL" : f === "PENDING" ? "PEND" : f}
            </button>
          ))}
        </div>
      </motion.div>

      {/* ── Mobile: card list / Desktop: table ── */}
      {loading ? (
        <div style={{ padding: 48, textAlign: "center", background: C.card, border: `1px solid ${C.line}`, borderRadius: 14 }}>
          <div style={{ width: 28, height: 28, border: `2px solid ${C.line}`, borderTop: "2px solid #8FFFD6", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
          <p style={{ color: C.muted, fontSize: 13 }}>Loading orders…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 48, textAlign: "center", background: C.card, border: `1px solid ${C.line}`, borderRadius: 14 }}>
          <p style={{ color: "#8FFFD6", fontSize: 32, margin: "0 0 12px" }}>📋</p>
          <p style={{ color: C.primary, fontSize: 14, fontWeight: 600, margin: "0 0 6px" }}>No orders found</p>
          <p style={{ color: C.muted, fontSize: 13 }}>{search || typeFilter !== "ALL" || statusFilter !== "ALL" ? "Try adjusting your filters." : "Place your first trade to see orders here."}</p>
        </div>
      ) : isMobile ? (
        /* ── Mobile card list ── */
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <AnimatePresence>
            {filtered.map(order => (
              <OrderCard key={order.id} order={order} currency={currency} onCancel={cancelOrder} />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        /* ── Desktop table ── */
        <motion.div variants={fadeUp}
          style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
          <div className="ord-row" style={{ display: "grid", padding: "10px 18px", borderBottom: `1px solid ${C.line}`, background: "var(--color-surface-hover)" }}>
            {["Symbol", "Type", "Kind", "Status", "Qty", "Price", "Total", "Date", "Action"].map(h => (
              <span key={h} style={{ color: C.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>{h}</span>
            ))}
          </div>
          <AnimatePresence>
            {filtered.map((order, i) => {
              const sc        = getStatus(order.status);
              const kc        = getKind(order.kind);
              const isPending = order.status === "PENDING";
              const isDimmed  = order.status === "CANCELLED" || order.status === "REJECTED";
              return (
                <motion.div key={order.id}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                  transition={{ delay: Math.min(i * 0.025, 0.35), duration: 0.32, ease: APPLE }}
                  whileHover={{ backgroundColor: "var(--color-surface-hover)", transition: { duration: 0.12 } }}
                  className="ord-row"
                  style={{
                    display: "grid", padding: "12px 18px",
                    borderBottom: i < filtered.length - 1 ? `1px solid ${C.line}` : "none",
                    alignItems: "center",
                    borderLeft: isPending ? "3px solid #f59e0b" : "3px solid transparent",
                    opacity: isDimmed ? 0.5 : 1,
                  }}>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <p style={{ color: C.primary, fontWeight: 600, fontSize: 13, margin: 0 }}>{order.symbol.replace(/\.(BSE|NSE)$/i, "")}</p>
                      {isPending && <PendingPulse />}
                    </div>
                    <p style={{ color: C.muted, fontSize: 10, margin: "2px 0 0" }}>
                      {order.market || market.id}
                      {order.limitPrice && <span style={{ color: kc.color, fontWeight: 600, marginLeft: 4 }}>@ {currency}{order.limitPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>}
                    </p>
                  </div>

                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, color: order.type === "BUY" ? "#22c55e" : "#ef4444", background: order.type === "BUY" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", border: `1px solid ${order.type === "BUY" ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}` }}>
                    {order.type}
                  </span>

                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, color: kc.color, background: kc.bg, border: `1px solid ${kc.border}` }}>
                    {kc.label}
                  </span>

                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, color: sc.color, background: sc.bg, border: `1px solid ${sc.border}`, animation: isPending ? "pendingPulse 2s ease-in-out infinite" : "none" }}>
                    {sc.icon}{sc.label}
                  </span>

                  <span style={{ color: C.primary, fontSize: 13 }}>{order.quantity?.toLocaleString() ?? "—"}</span>
                  <span style={{ color: C.muted,    fontSize: 13 }}>{currency}{(order.price ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  <span style={{ color: isDimmed ? C.muted : C.primary, fontWeight: 600, fontSize: 13 }}>{currency}{(order.total ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  <span style={{ color: C.muted, fontSize: 11 }}>{formatDate(order.createdAt)}</span>

                  <div>
                    {isPending && (
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.92 }}
                        onClick={() => cancelOrder(order.id)}
                        style={{ padding: "4px 10px", borderRadius: 7, border: "1px solid rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.08)", color: "#ef4444", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                        Cancel
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} style={{ padding: 14, textAlign: "center" }}>
            {loadingMore && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <div style={{ width: 16, height: 16, border: `2px solid ${C.line}`, borderTop: "2px solid #8FFFD6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                <span style={{ color: C.muted, fontSize: 12 }}>Loading more…</span>
              </div>
            )}
            {!hasMore && orders.length > 0 && <span style={{ color: C.muted, fontSize: 11 }}>All {totalOrders} orders loaded</span>}
          </div>
        </motion.div>
      )}

      {/* Mobile infinite scroll sentinel */}
      {isMobile && <div ref={sentinelRef} style={{ height: 20 }} />}

      {orders.length > 0 && (
        <motion.div variants={fadeUp} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, padding: "10px 16px", background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, flexWrap: "wrap", gap: 8 }}>
          <span style={{ color: C.muted, fontSize: 12 }}>
            <strong style={{ color: C.primary }}>{filtered.length}</strong> of <strong style={{ color: C.primary }}>{totalOrders}</strong> orders
          </span>
          <span style={{ color: C.muted, fontSize: 12 }}>
            Volume: <span style={{ color: C.primary, fontWeight: 700 }}>{currency}{totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}