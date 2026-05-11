"use client";

import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/auth";
import { Bell, BellOff, Check, CheckCheck, Trash2, TrendingUp, TrendingDown, AlertTriangle, Info } from "lucide-react";

interface Notification {
  id: string;
  type: "PRICE_ALERT" | "ORDER_FILLED" | "ORDER_CANCELLED" | "SYSTEM" | string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  PRICE_ALERT:      { icon: <AlertTriangle size={15} />, color: "#f59e0b" },
  ORDER_FILLED:     { icon: <TrendingUp size={15} />,    color: "var(--color-bull, #22c55e)" },
  ORDER_CANCELLED:  { icon: <TrendingDown size={15} />,  color: "var(--color-bear, #ef4444)" },
  SYSTEM:           { icon: <Info size={15} />,          color: "var(--color-primary, #8FFFD6)" },
};

function getConfig(type: string) {
  return TYPE_CONFIG[type] ?? { icon: <Bell size={15} />, color: "var(--color-muted)" };
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function Skeleton() {
  return (
    <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-line)", display: "flex", gap: 14 }}>
      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--color-line)", animation: "pulse 1.5s ease-in-out infinite", flexShrink: 0 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ width: "40%", height: 13, borderRadius: 4, background: "var(--color-line)", animation: "pulse 1.5s ease-in-out infinite" }} />
        <div style={{ width: "75%", height: 12, borderRadius: 4, background: "var(--color-line)", animation: "pulse 1.5s ease-in-out infinite" }} />
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "UNREAD">("ALL");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/notifications");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setNotifications(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const markOne = async (id: string) => {
    const res = await fetchWithAuth(`/api/notifications/${id}/read`, { method: "POST" });
    if (res.ok) {
      setNotifications(n => n.map(x => x.id === id ? { ...x, read: true } : x));
    }
  };

  const markAll = async () => {
    const res = await fetchWithAuth("/api/notifications/read-all", { method: "POST" });
    if (res.ok) {
      setNotifications(n => n.map(x => ({ ...x, read: true })));
    }
  };

  const displayed = filter === "UNREAD"
    ? notifications.filter(n => !n.read)
    : notifications;

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div style={{ padding: "32px 28px", maxWidth: 760, margin: "0 auto" }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            Notifications
            {unreadCount > 0 && (
              <span style={{
                background: "var(--color-primary)", color: "#000",
                borderRadius: 9999, fontSize: 11, fontWeight: 700,
                padding: "2px 7px",
              }}>{unreadCount}</span>
            )}
          </h1>
          <p style={{ color: "var(--color-muted)", fontSize: 14, margin: "4px 0 0" }}>
            Price alerts and order updates
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAll}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: 8, cursor: "pointer",
              background: "transparent", border: "1px solid var(--color-line)",
              color: "var(--color-muted)", fontSize: 13, fontWeight: 500,
            }}
          >
            <CheckCheck size={14} /> Mark all read
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{
        display: "flex", gap: 2, marginBottom: 16,
        background: "var(--color-line)", borderRadius: 8, padding: 3, width: "fit-content",
      }}>
        {(["ALL", "UNREAD"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "6px 16px", borderRadius: 6, border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 500,
            background: filter === f ? "var(--color-card)" : "transparent",
            color: filter === f ? "inherit" : "var(--color-muted)",
          }}>
            {f === "UNREAD" ? `Unread (${unreadCount})` : "All"}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{
        background: "var(--color-card)", border: "1px solid var(--color-line)",
        borderRadius: 12, overflow: "hidden",
      }}>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} />)
        ) : error ? (
          <div style={{ padding: 48, textAlign: "center", color: "var(--color-bear)" }}>⚠ {error}</div>
        ) : displayed.length === 0 ? (
          <div style={{
            padding: 64, textAlign: "center",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
          }}>
            <BellOff size={32} style={{ color: "var(--color-line)" }} />
            <p style={{ margin: 0, color: "var(--color-muted)", fontSize: 14 }}>
              {filter === "UNREAD" ? "No unread notifications" : "No notifications yet"}
            </p>
          </div>
        ) : (
          displayed.map((n, i) => {
            const cfg = getConfig(n.type);
            return (
              <div
                key={n.id}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 14,
                  padding: "16px 20px",
                  borderBottom: i < displayed.length - 1 ? "1px solid var(--color-line)" : "none",
                  background: n.read ? "transparent" : "color-mix(in srgb, var(--color-primary) 4%, transparent)",
                  transition: "background .15s",
                }}
              >
                {/* Icon */}
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: `color-mix(in srgb, ${cfg.color} 15%, transparent)`,
                  color: cfg.color,
                }}>
                  {cfg.icon}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <p style={{
                      margin: 0, fontSize: 14, fontWeight: n.read ? 400 : 600,
                      lineHeight: 1.4,
                    }}>{n.title}</p>
                    <span style={{ fontSize: 11, color: "var(--color-muted)", flexShrink: 0, marginTop: 2 }}>
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                  <p style={{
                    margin: "3px 0 0", fontSize: 13,
                    color: "var(--color-muted)", lineHeight: 1.5,
                  }}>{n.message}</p>
                </div>

                {/* Mark read button */}
                {!n.read && (
                  <button
                    onClick={() => markOne(n.id)}
                    title="Mark as read"
                    style={{
                      flexShrink: 0, background: "none", border: "none",
                      cursor: "pointer", color: "var(--color-muted)", padding: 4,
                      borderRadius: 6, display: "flex", alignItems: "center",
                    }}
                  >
                    <Check size={14} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {!loading && !error && displayed.length > 0 && (
        <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--color-muted)", textAlign: "center" }}>
          {displayed.length} notification{displayed.length !== 1 ? "s" : ""}
          {filter === "UNREAD" ? " unread" : " total"}
        </p>
      )}
    </div>
  );
}