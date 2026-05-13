"use client";

import { useState, useEffect, useCallback } from "react";
import { useMarket } from "@/hooks/useMarket";
import { Download, RefreshCw, Search } from "lucide-react";
import { fetchWithAuth } from "@/lib/auth";
import { exportOrdersCsv } from "@/lib/csv-export";

// ─── Types ────────────────────────────────────────────────────────────────────
// NOTE: Backend Order response uses "quantity" — never "qty"
// Frontend sends { symbol, type, qty, price, market } on POST (OrderController handles both)
// Frontend READS order.quantity (backend field)

interface OrderRow {
  id: string;
  userId: string;
  symbol: string;
  market: string;
  type: "BUY" | "SELL";
  quantity: number;      // ← backend field is "quantity"
  price: number;
  total: number;
  createdAt: string;
  status: "FILLED" | "PENDING" | "CANCELLED" | "REJECTED";
}

interface BackendOrderRow extends Partial<Omit<OrderRow, "quantity">> {
  quantity?: number;
  qty?: number;
}

const C = {
  page:    "var(--color-page)",
  card:    "var(--color-card)",
  line:    "var(--color-line)",
  primary: "var(--color-primary)",
  muted:   "var(--color-muted)",
  hover:   "var(--color-surface-hover)",
};

const STATUS_COLOR: Record<string, string> = {
  FILLED:    "#22c55e",
  PENDING:   "#f59e0b",
  CANCELLED: "var(--color-muted)",
  REJECTED:  "#ef4444",
};

const STATUS_BG: Record<string, string> = {
  FILLED:    "rgba(34,197,94,0.1)",
  PENDING:   "rgba(245,158,11,0.1)",
  CANCELLED: "var(--color-surface-hover)",
  REJECTED:  "rgba(239,68,68,0.1)",
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const { market } = useMarket();
  const currency = market.currency || "$";

  const [orders,   setOrders]   = useState<OrderRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "BUY" | "SELL">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "FILLED" | "PENDING" | "CANCELLED">("ALL");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/orders");
      if (res.ok) {
        const data = await res.json();
        // Normalise: backend always returns quantity, but guard just in case
        const normalised: OrderRow[] = (Array.isArray(data) ? data : []).map((o: BackendOrderRow) => ({
          ...o,
          quantity: o.quantity ?? o.qty ?? 0,   // ← prefer quantity, fallback qty
        } as OrderRow));
        setOrders(normalised);
      }
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    queueMicrotask(() => { void loadOrders(); });
  }, [loadOrders]);

  const handleExportCsv = () => {
    exportOrdersCsv(orders.map((order) => ({
      ...order,
      qty: order.quantity,
    })));
  };

  const filtered = orders.filter(o => {
    const matchSearch =
      o.symbol.toLowerCase().includes(search.toLowerCase()) ||
      o.id.toLowerCase().includes(search.toLowerCase());
    const matchType   = typeFilter === "ALL"   || o.type === typeFilter;
    const matchStatus = statusFilter === "ALL" || o.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  // Aggregate stats
  const totalBuys  = orders.filter(o => o.type === "BUY").length;
  const totalSells = orders.filter(o => o.type === "SELL").length;
  const totalValue = orders.reduce((s, o) => s + (o.total ?? 0), 0);
  const pending    = orders.filter(o => o.status === "PENDING").length;

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1200, margin: "0 auto", fontFamily: "'Geist','Inter',sans-serif", background: C.page, minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: C.primary, fontWeight: 700, fontSize: 20, margin: 0, letterSpacing: -0.3 }}>Order History</h1>
          <p style={{ color: C.muted, fontSize: 12, margin: "4px 0 0" }}>
            {market.flag} {market.label} · {orders.length} total orders
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={handleExportCsv} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            <Download size={13} /> Export CSV
          </button>
          <button onClick={loadOrders} style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total Orders",  value: orders.length,                                                       color: "#8FFFD6" },
          { label: "Buy Orders",    value: totalBuys,                                                           color: "#22c55e" },
          { label: "Sell Orders",   value: totalSells,                                                          color: "#ef4444" },
          { label: "Pending",       value: pending,                                                             color: "#f59e0b" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 18px" }}>
            <p style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 6px" }}>{label}</p>
            <p style={{ color, fontWeight: 700, fontSize: 24, margin: 0 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={14} color="var(--color-muted)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by symbol or order ID…"
            style={{ width: "100%", background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, color: C.primary, fontSize: 13, padding: "11px 14px 11px 38px", outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ display: "flex", gap: 4, background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 4 }}>
          {(["ALL", "BUY", "SELL"] as const).map(f => (
            <button key={f} onClick={() => setTypeFilter(f)} style={{ padding: "6px 12px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, background: typeFilter === f ? C.page : "transparent", color: typeFilter === f ? (f === "BUY" ? "#22c55e" : f === "SELL" ? "#ef4444" : "#8FFFD6") : C.muted }}>
              {f}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4, background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 4 }}>
          {(["ALL", "FILLED", "PENDING", "CANCELLED"] as const).map(f => (
            <button key={f} onClick={() => setStatusFilter(f)} style={{ padding: "6px 12px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, background: statusFilter === f ? C.page : "transparent", color: statusFilter === f ? "#8FFFD6" : C.muted }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden" }}>
        {/* Column Headers */}
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 80px 80px 1fr 1fr 1fr 100px", padding: "11px 20px", borderBottom: `1px solid ${C.line}` }}>
          {["Symbol", "Type", "Status", "Quantity", "Price", "Total", "Date"].map(h => (
            <span key={h} style={{ color: C.muted, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <div style={{ width: 28, height: 28, border: `2px solid ${C.line}`, borderTop: "2px solid #8FFFD6", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
            <p style={{ color: C.muted, fontSize: 13 }}>Loading orders…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <p style={{ color: "#8FFFD6", fontSize: 32, margin: "0 0 12px" }}>📋</p>
            <p style={{ color: C.primary, fontSize: 14, fontWeight: 600, margin: "0 0 6px" }}>No orders found</p>
            <p style={{ color: C.muted, fontSize: 13 }}>
              {search || typeFilter !== "ALL" || statusFilter !== "ALL"
                ? "Try adjusting your filters."
                : "Place your first trade to see orders here."}
            </p>
          </div>
        ) : (
          filtered.map((order, i) => (
            <div key={order.id}
              style={{ display: "grid", gridTemplateColumns: "1.5fr 80px 80px 1fr 1fr 1fr 100px", padding: "13px 20px", borderBottom: i < filtered.length - 1 ? `1px solid ${C.line}` : "none", alignItems: "center", transition: "background 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.background = C.hover)}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>

              {/* Symbol */}
              <div>
                <p style={{ color: C.primary, fontWeight: 600, fontSize: 13, margin: 0 }}>
                  {order.symbol.replace(/\.(BSE|NSE)$/i, "")}
                </p>
                <p style={{ color: C.muted, fontSize: 10, margin: "2px 0 0" }}>{order.market}</p>
              </div>

              {/* Type */}
              <span style={{
                display: "inline-block", padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                color: order.type === "BUY" ? "#22c55e" : "#ef4444",
                background: order.type === "BUY" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
              }}>
                {order.type}
              </span>

              {/* Status */}
              <span style={{
                display: "inline-block", padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                color: STATUS_COLOR[order.status] ?? C.muted,
                background: STATUS_BG[order.status] ?? C.hover,
              }}>
                {order.status}
              </span>

              {/* Quantity — reads order.quantity (backend field) */}
              <span style={{ color: C.primary, fontSize: 13 }}>
                {order.quantity?.toLocaleString() ?? "—"}
              </span>

              {/* Price */}
              <span style={{ color: C.muted, fontSize: 13 }}>
                {currency}{(order.price ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>

              {/* Total */}
              <span style={{ color: C.primary, fontWeight: 600, fontSize: 13 }}>
                {currency}{(order.total ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>

              {/* Date */}
              <span style={{ color: C.muted, fontSize: 11 }}>
                {formatDate(order.createdAt)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Total traded value footer */}
      {orders.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12, padding: "12px 20px", background: C.card, border: `1px solid ${C.line}`, borderRadius: 12 }}>
          <span style={{ color: C.muted, fontSize: 12 }}>
            Total traded volume: <span style={{ color: C.primary, fontWeight: 700 }}>
              {currency}{totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </span>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
