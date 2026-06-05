"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchWithAuth } from "@/lib/auth";
import {
  Bell, BellOff, Check, CheckCheck,
  TrendingUp, TrendingDown, AlertTriangle, Info, Zap,
} from "lucide-react";

interface Notification {
  id: string;
  type: "PRICE_ALERT" | "ORDER_FILLED" | "ORDER_CANCELLED" | "SYSTEM" | string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

const APPLE = [0.22, 1, 0.36, 1] as const;

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  PRICE_ALERT:     { icon: <AlertTriangle size={14} />, color: "#f59e0b", bg: "rgba(245,158,11,0.12)"  },
  ORDER_FILLED:    { icon: <TrendingUp    size={14} />, color: "#22c55e", bg: "rgba(34,197,94,0.12)"   },
  ORDER_CANCELLED: { icon: <TrendingDown  size={14} />, color: "#ef4444", bg: "rgba(239,68,68,0.12)"   },
  SYSTEM:          { icon: <Zap          size={14} />, color: "#8FFFD6", bg: "rgba(143,255,214,0.12)" },
};

function getConfig(type: string) {
  return TYPE_CONFIG[type] ?? {
    icon: <Info size={14} />, color: "var(--color-muted)", bg: "var(--color-surface-hover)",
  };
}

function timeAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ── Skeleton row ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-line)", display: "flex", gap: 14 }}>
      <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--color-line)", animation: "pulse 1.5s ease-in-out infinite", flexShrink: 0 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ width: "38%", height: 13, borderRadius: 4, background: "var(--color-line)", animation: "pulse 1.5s ease-in-out infinite" }} />
        <div style={{ width: "68%", height: 12, borderRadius: 4, background: "var(--color-line)", animation: "pulse 1.5s ease-in-out infinite" }} />
      </div>
    </div>
  );
}

const fadeUp   = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.38, ease: APPLE } } };
const stagger  = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
const rowAnim  = { hidden: { opacity: 0, x: -10 }, visible: { opacity: 1, x: 0, transition: { duration: 0.32, ease: APPLE } } };
const exitAnim = { opacity: 0, x: 20, transition: { duration: 0.2 } };

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [filter,   setFilter]   = useState<"ALL" | "UNREAD">("ALL");
  const [marking,  setMarking]  = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
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
    setMarking(id);
    const res = await fetchWithAuth(`/api/notifications/${id}/read`, { method: "POST" });
    if (res.ok) setNotifications(n => n.map(x => x.id === id ? { ...x, read: true } : x));
    setMarking(null);
  };

  const markAll = async () => {
    const res = await fetchWithAuth("/api/notifications/read-all", { method: "POST" });
    if (res.ok) setNotifications(n => n.map(x => ({ ...x, read: true })));
  };

  const displayed    = filter === "UNREAD" ? notifications.filter(n => !n.read) : notifications;
  const unreadCount  = notifications.filter(n => !n.read).length;

  // Group by date
  const grouped: Record<string, Notification[]> = {};
  displayed.forEach(n => {
    const d = new Date(n.createdAt);
    const now = new Date();
    let label = "Older";
    if (d.toDateString() === now.toDateString()) label = "Today";
    else {
      const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
      if (d.toDateString() === yesterday.toDateString()) label = "Yesterday";
    }
    (grouped[label] = grouped[label] ?? []).push(n);
  });
  const groupOrder = ["Today", "Yesterday", "Older"].filter(k => grouped[k]);

  return (
    <motion.div
      initial="hidden" animate="visible" variants={stagger}
      style={{ padding: 16, boxSizing: "border-box", maxWidth: 720, margin: "0 auto", fontFamily: "var(--font-gantari,'Gantari',system-ui,sans-serif)" }}
    >
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>

      {/* ── Header ── */}
      <motion.div variants={fadeUp}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: -0.3 }}>
              Notifications
            </h1>
            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.span
                  key="badge"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  style={{ background: "#8FFFD6", color: "#0a0a0a", borderRadius: 9999, fontSize: 11, fontWeight: 700, padding: "2px 8px" }}
                >
                  {unreadCount}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <p style={{ color: "var(--color-muted)", fontSize: 13, margin: 0 }}>
            Price alerts and order updates
          </p>
        </div>

        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={markAll}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, cursor: "pointer", background: "transparent", border: "1px solid var(--color-line)", color: "var(--color-muted)", fontSize: 13, fontWeight: 500 }}
            >
              <CheckCheck size={14} /> Mark all read
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Filter tabs ── */}
      <motion.div variants={fadeUp}
        style={{ display: "flex", flexWrap: "wrap", gap: 2, marginBottom: 20, background: "var(--color-line)", borderRadius: 10, padding: 3, width: "fit-content", maxWidth: "100%" }}>
        {(["ALL", "UNREAD"] as const).map(f => (
          <motion.button key={f} onClick={() => setFilter(f)}
            whileTap={{ scale: 0.96 }}
            style={{
              padding: "7px 18px", borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 500,
              background: filter === f ? "var(--color-card)" : "transparent",
              color: filter === f ? "var(--color-primary)" : "var(--color-muted)",
              transition: "all 0.15s",
            }}>
            {f === "UNREAD" ? `Unread ${unreadCount > 0 ? `(${unreadCount})` : ""}` : "All"}
          </motion.button>
        ))}
      </motion.div>

      {/* ── List ── */}
      {loading ? (
        <div style={{ background: "var(--color-card)", border: "1px solid var(--color-line)", borderRadius: 14, overflow: "hidden" }}>
          {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : error ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ padding: 48, textAlign: "center", color: "#ef4444", background: "var(--color-card)", border: "1px solid var(--color-line)", borderRadius: 14 }}>
          ⚠ {error}
        </motion.div>
      ) : displayed.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          style={{ padding: 64, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, background: "var(--color-card)", border: "1px solid var(--color-line)", borderRadius: 14 }}>
          <BellOff size={32} style={{ color: "var(--color-line)" }} />
          <p style={{ margin: 0, color: "var(--color-muted)", fontSize: 14 }}>
            {filter === "UNREAD" ? "You're all caught up" : "No notifications yet"}
          </p>
          {filter === "UNREAD" && unreadCount === 0 && (
            <motion.button whileHover={{ scale: 1.03 }} onClick={() => setFilter("ALL")}
              style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid var(--color-line)", background: "transparent", color: "var(--color-muted)", fontSize: 12, cursor: "pointer" }}>
              View all
            </motion.button>
          )}
        </motion.div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {groupOrder.map(group => (
            <motion.div key={group} variants={fadeUp}>
              {/* Date group label */}
              <p style={{ color: "var(--color-muted)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 8px 4px" }}>
                {group}
              </p>

              <div style={{ background: "var(--color-card)", border: "1px solid var(--color-line)", borderRadius: 14, overflow: "hidden" }}>
                <AnimatePresence initial={false}>
                  {grouped[group].map((n, i) => {
                    const cfg     = getConfig(n.type);
                    const isLast  = i === grouped[group].length - 1;
                    const isMarking = marking === n.id;

                    return (
                      <motion.div
                        key={n.id}
                        variants={rowAnim}
                        exit={exitAnim}
                        layout
                        style={{
                          display: "flex", alignItems: "flex-start", gap: 14,
                          padding: "15px 18px",
                          borderBottom: isLast ? "none" : "1px solid var(--color-line)",
                          background: n.read
                            ? "transparent"
                            : `color-mix(in srgb, ${cfg.color} 5%, transparent)`,
                          // Unread left accent
                          borderLeft: n.read ? "3px solid transparent" : `3px solid ${cfg.color}`,
                          transition: "background 0.2s, border-color 0.2s",
                          position: "relative",
                        }}
                      >
                        {/* Type icon */}
                        <motion.div
                          whileHover={{ scale: 1.1 }}
                          style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: cfg.bg, color: cfg.color }}
                        >
                          {cfg.icon}
                        </motion.div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 3 }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: n.read ? 400 : 600, lineHeight: 1.4, color: "var(--color-primary)" }}>
                              {n.title}
                            </p>
                            <span style={{ fontSize: 11, color: "var(--color-muted)", flexShrink: 0, marginTop: 1 }}>
                              {timeAgo(n.createdAt)}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: 12, color: "var(--color-muted)", lineHeight: 1.55 }}>
                            {n.message}
                          </p>

                          {/* Type tag */}
                          <span style={{ display: "inline-block", marginTop: 7, padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 600, color: cfg.color, background: cfg.bg, letterSpacing: 0.3 }}>
                            {n.type.replace(/_/g, " ")}
                          </span>
                        </div>

                        {/* Mark read button */}
                        {!n.read && (
                          <motion.button
                            onClick={() => markOne(n.id)}
                            whileHover={{ scale: 1.15, color: "#8FFFD6" }}
                            whileTap={{ scale: 0.9 }}
                            title="Mark as read"
                            style={{ flexShrink: 0, background: "none", border: "1px solid var(--color-line)", cursor: "pointer", color: "var(--color-muted)", padding: "5px 6px", borderRadius: 7, display: "flex", alignItems: "center", opacity: isMarking ? 0.5 : 1, transition: "color 0.15s, border-color 0.15s" }}
                          >
                            <Check size={12} />
                          </motion.button>
                        )}

                        {/* Unread dot */}
                        {!n.read && (
                          <div style={{ position: "absolute", top: 16, right: n.read ? 18 : 52, width: 7, height: 7, borderRadius: "50%", background: cfg.color, opacity: 0.8 }} />
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Footer count */}
      {!loading && !error && displayed.length > 0 && (
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          style={{ margin: "16px 0 0", fontSize: 12, color: "var(--color-muted)", textAlign: "center" }}
        >
          {displayed.length} notification{displayed.length !== 1 ? "s" : ""}
          {filter === "UNREAD" ? " unread" : " total"}
        </motion.p>
      )}
    </motion.div>
  );
}
