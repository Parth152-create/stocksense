"use client";

import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/auth";
import { exportOrdersCsv } from "@/lib/csv-export";
import { Download, TrendingUp, TrendingDown, Clock, CheckCircle, XCircle, Filter } from "lucide-react";

type OrderStatus = "PENDING" | "FILLED" | "CANCELLED" | "PARTIAL";
type OrderType = "BUY" | "SELL";

interface Order {
  id: string;
  symbol: string;
  type: OrderType;
  qty: number;
  price: number;
  total: number;
  status: OrderStatus;
  createdAt: string; // ISO datetime — matches OrderRow.createdAt in csv-export.ts
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; icon: React.ReactNode; color: string }> = {
  FILLED:    { label: "Filled",    icon: <CheckCircle size={13} />, color: "var(--color-bull, #22c55e)" },
  PENDING:   { label: "Pending",   icon: <Clock size={13} />,       color: "var(--color-primary, #8FFFD6)" },
  CANCELLED: { label: "Cancelled", icon: <XCircle size={13} />,     color: "var(--color-bear, #ef4444)" },
  PARTIAL:   { label: "Partial",   icon: <Clock size={13} />,       color: "#f59e0b" },
};

function StatusBadge({ status }: { status: OrderStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 9999, fontSize: 12, fontWeight: 500,
      color: cfg.color,
      background: `color-mix(in srgb, ${cfg.color} 12%, transparent)`,
      border: `1px solid color-mix(in srgb, ${cfg.color} 30%, transparent)`,
    }}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function Skeleton({ w, h = 16 }: { w: string | number; h?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 4,
      background: "var(--color-line)",
      animation: "pulse 1.5s ease-in-out infinite",
    }} />
  );
}

export default function OrdersPage() {
  const [orders, setOrders]       = useState<Order[]>([]);
  const [filtered, setFiltered]   = useState<Order[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [typeFilter, setTypeFilter]     = useState<"ALL" | OrderType>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | OrderStatus>("ALL");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchWithAuth("/api/orders");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Order[] = await res.json();
        setOrders(data);
        setFiltered(data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load orders");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    let out = orders;
    if (typeFilter !== "ALL")   out = out.filter(o => o.type === typeFilter);
    if (statusFilter !== "ALL") out = out.filter(o => o.status === statusFilter);
    setFiltered(out);
  }, [orders, typeFilter, statusFilter]);

  // Synchronous — no await, no exporting state needed
  const handleExport = () => exportOrdersCsv(filtered);

  const totalBought  = orders.filter(o => o.type === "BUY"  && o.status === "FILLED").reduce((s, o) => s + o.total, 0);
  const totalSold    = orders.filter(o => o.type === "SELL" && o.status === "FILLED").reduce((s, o) => s + o.total, 0);
  const pendingCount = orders.filter(o => o.status === "PENDING").length;

  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div style={{ padding: "32px 28px", maxWidth: 1100, margin: "0 auto" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        .orders-row:hover td { background: var(--color-surface-hover); }
        .filter-btn { padding: 5px 12px; border-radius: 6px; font-size: 13px; cursor: pointer;
          border: 1px solid var(--color-line); background: transparent;
          color: var(--color-muted); transition: all .15s; }
        .filter-btn.active { background: var(--color-primary); color: #000;
          border-color: var(--color-primary); font-weight: 600; }
        .filter-btn:not(.active):hover { border-color: var(--color-primary); color: var(--color-primary); }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Order History</h1>
          <p style={{ color: "var(--color-muted)", fontSize: 14, margin: "4px 0 0" }}>All your buy and sell orders</p>
        </div>
        <button
          onClick={handleExport}
          disabled={filtered.length === 0}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 8, cursor: "pointer",
            background: "var(--color-primary)", color: "#000",
            border: "none", fontWeight: 600, fontSize: 13,
            opacity: filtered.length === 0 ? 0.5 : 1,
          }}
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Summary cards */}
      {!loading && !error && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
          {[
            { label: "Total Bought", value: `$${fmt(totalBought)}`, color: "var(--color-bull)",    icon: <TrendingUp size={16} /> },
            { label: "Total Sold",   value: `$${fmt(totalSold)}`,   color: "var(--color-bear)",    icon: <TrendingDown size={16} /> },
            { label: "Pending",      value: pendingCount,            color: "var(--color-primary)", icon: <Clock size={16} /> },
          ].map(card => (
            <div key={card.label} style={{
              background: "var(--color-card)", border: "1px solid var(--color-line)",
              borderRadius: 12, padding: "16px 20px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div>
                <p style={{ margin: 0, fontSize: 12, color: "var(--color-muted)" }}>{card.label}</p>
                <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 700 }}>{card.value}</p>
              </div>
              <div style={{ color: card.color, opacity: 0.8 }}>{card.icon}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <Filter size={13} style={{ color: "var(--color-muted)" }} />
          {(["ALL", "BUY", "SELL"] as const).map(t => (
            <button key={t} className={`filter-btn${typeFilter === t ? " active" : ""}`}
              onClick={() => setTypeFilter(t)}>{t}</button>
          ))}
        </div>
        <div style={{ width: 1, background: "var(--color-line)" }} />
        {(["ALL", "FILLED", "PENDING", "CANCELLED", "PARTIAL"] as const).map(s => (
          <button key={s} className={`filter-btn${statusFilter === s ? " active" : ""}`}
            onClick={() => setStatusFilter(s)}>{s === "ALL" ? "All Status" : s}</button>
        ))}
      </div>

      {/* Table */}
      <div style={{
        background: "var(--color-card)", border: "1px solid var(--color-line)",
        borderRadius: 12, overflow: "hidden",
      }}>
        {loading ? (
          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ display: "flex", gap: 20, alignItems: "center" }}>
                <Skeleton w={80} /><Skeleton w={40} /><Skeleton w={50} />
                <Skeleton w={60} /><Skeleton w={80} /><Skeleton w={90} /><Skeleton w={70} />
              </div>
            ))}
          </div>
        ) : error ? (
          <div style={{ padding: 48, textAlign: "center", color: "var(--color-bear)" }}>⚠ {error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 64, textAlign: "center", color: "var(--color-muted)" }}>No orders found</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-line)" }}>
                {["Date", "Symbol", "Type", "Qty", "Price", "Total", "Status"].map(h => (
                  <th key={h} style={{
                    padding: "12px 16px", textAlign: "left",
                    color: "var(--color-muted)", fontWeight: 500, fontSize: 12,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(order => (
                <tr key={order.id} className="orders-row" style={{ borderBottom: "1px solid var(--color-line)" }}>
                  <td style={{ padding: "12px 16px", color: "var(--color-muted)" }}>
                    {new Date(order.createdAt).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                    })}
                  </td>
                  <td style={{ padding: "12px 16px", fontWeight: 600 }}>{order.symbol}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{
                      color: order.type === "BUY" ? "var(--color-bull)" : "var(--color-bear)",
                      fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3,
                    }}>
                      {order.type === "BUY"
                        ? <><TrendingUp size={12} />BUY</>
                        : <><TrendingDown size={12} />SELL</>}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>{order.qty.toLocaleString()}</td>
                  <td style={{ padding: "12px 16px" }}>${fmt(order.price)}</td>
                  <td style={{ padding: "12px 16px", fontWeight: 600 }}>${fmt(order.total)}</td>
                  <td style={{ padding: "12px 16px" }}><StatusBadge status={order.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div style={{
            padding: "10px 16px", borderTop: "1px solid var(--color-line)",
            color: "var(--color-muted)", fontSize: 12,
          }}>
            Showing {filtered.length} of {orders.length} orders
          </div>
        )}
      </div>
    </div>
  );
}