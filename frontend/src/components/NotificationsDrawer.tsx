"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  X, Bell, BellOff, TrendingUp, ShoppingCart,
  BarChart2, AlertTriangle, CheckCheck, Plus, ArrowRight,
} from "lucide-react";

export interface AppNotification {
  id: string;
  type: "PRICE_ALERT" | "ORDER_FILLED" | "EARNINGS" | "ANOMALY";
  title: string;
  message: string;
  symbol?: string;
  read: boolean;
  createdAt: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

function typeIcon(type: AppNotification["type"]) {
  switch (type) {
    case "PRICE_ALERT":  return { Icon: TrendingUp,    color: "#8FFFD6", bg: "#8FFFD611" };
    case "ORDER_FILLED": return { Icon: ShoppingCart,  color: "#a78bfa", bg: "#a78bfa11" };
    case "EARNINGS":     return { Icon: BarChart2,     color: "#f59e0b", bg: "#f59e0b11" };
    case "ANOMALY":      return { Icon: AlertTriangle, color: "#ef4444", bg: "#ef444411" };
    default:             return { Icon: Bell,          color: "#888",    bg: "#88888811" };
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationsDrawer({
  open, onClose, notifications, onMarkRead, onMarkAllRead,
}: Props) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const router    = useRouter();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const T = {
    bg:          isDark ? "#111111"               : "#ffffff",
    border:      isDark ? "#1f1f1f"               : "#e5e7eb",
    unreadBg:    isDark ? "#161616"               : "#f9fafb",
    hoverBg:     isDark ? "#1c1c1c"               : "#f3f4f6",
    itemBorder:  isDark ? "#181818"               : "#f0f0f0",
    title:       isDark ? "#ffffff"               : "#18181A",
    muted:       isDark ? "#6b7280"               : "#9ca3af",
    closeBg:     isDark ? "#1a1a1a"               : "#f3f4f6",
    closeBorder: isDark ? "#2a2a2a"               : "#e5e7eb",
    emptyIcon:   isDark ? "rgba(143,255,214,0.06)": "rgba(143,255,214,0.10)",
    actionBg:    isDark ? "#1a1a1a"               : "#f9fafb",
  };

  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, zIndex: 40,
        background: "rgba(0,0,0,0.4)",
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
        transition: "opacity 0.2s",
      }} />

      <div ref={drawerRef} style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 380,
        background: T.bg, borderLeft: `1px solid ${T.border}`,
        zIndex: 50, display: "flex", flexDirection: "column",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
        fontFamily: "var(--font-gantari,'Gantari',system-ui,sans-serif)",
        boxShadow: isDark ? "-8px 0 32px rgba(0,0,0,0.5)" : "-4px 0 24px rgba(0,0,0,0.08)",
      }}>

        {/* Header */}
        <div style={{
          padding: "20px 20px 16px", borderBottom: `1px solid ${T.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Bell size={16} color="#8FFFD6" />
            <span style={{ color: T.title, fontWeight: 600, fontSize: 15 }}>Notifications</span>
            {unreadCount > 0 && (
              <span style={{ background: "#8FFFD6", color: "#0a0a0a", fontSize: 10, fontWeight: 700, borderRadius: 99, padding: "1px 7px" }}>
                {unreadCount}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {unreadCount > 0 && (
              <button onClick={onMarkAllRead} style={{
                background: "none", border: "none", cursor: "pointer", color: T.muted,
                display: "flex", alignItems: "center", gap: 4, fontSize: 11,
                padding: "4px 8px", borderRadius: 6, transition: "color 0.15s",
              }}
                onMouseEnter={e => (e.currentTarget.style.color = "#8FFFD6")}
                onMouseLeave={e => (e.currentTarget.style.color = T.muted)}>
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
            <button onClick={onClose} style={{
              width: 28, height: 28, borderRadius: "50%",
              background: T.closeBg, border: `1px solid ${T.closeBorder}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: T.muted,
            }}>
              <X size={13} />
            </button>
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {notifications.length === 0 ? (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              padding: "48px 28px 32px", gap: 0,
            }}>
              {/* Icon */}
              <div style={{
                width: 64, height: 64, borderRadius: 18,
                background: T.emptyIcon, border: "1px solid rgba(143,255,214,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 16,
              }}>
                <BellOff size={26} color="#8FFFD6" strokeWidth={1.5} />
              </div>

              <p style={{ color: T.title, fontSize: 15, fontWeight: 700, margin: "0 0 6px", textAlign: "center" }}>
                No notifications yet
              </p>
              <p style={{ color: T.muted, fontSize: 12, margin: "0 0 24px", textAlign: "center", lineHeight: 1.6, maxWidth: 240 }}>
                Set price alerts on stocks you're watching and we'll notify you when they hit your target.
              </p>

              {/* CTA buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
                <button
                  onClick={() => { onClose(); router.push("/dashboard/watchlist"); }}
                  style={{
                    width: "100%", padding: "11px 16px", borderRadius: 10,
                    background: "rgba(143,255,214,0.08)", border: "1px solid rgba(143,255,214,0.2)",
                    color: "#8FFFD6", cursor: "pointer", fontWeight: 600, fontSize: 13,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    fontFamily: "inherit", transition: "background 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(143,255,214,0.13)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "rgba(143,255,214,0.08)")}
                >
                  <Bell size={14} /> Set a price alert
                </button>
                <button
                  onClick={() => { onClose(); router.push("/dashboard"); }}
                  style={{
                    width: "100%", padding: "10px 16px", borderRadius: 10,
                    background: "transparent", border: `1px solid ${T.border}`,
                    color: T.muted, cursor: "pointer", fontWeight: 500, fontSize: 13,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    fontFamily: "inherit", transition: "background 0.15s, color 0.15s",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = T.actionBg;
                    (e.currentTarget as HTMLButtonElement).style.color = T.title;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                    (e.currentTarget as HTMLButtonElement).style.color = T.muted;
                  }}
                >
                  <Plus size={14} /> Browse stocks
                </button>
              </div>

              {/* Notification types hint */}
              <div style={{ marginTop: 28, width: "100%" }}>
                <p style={{ color: T.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px", opacity: 0.5 }}>
                  You'll be notified for
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {([
                    { type: "PRICE_ALERT"  as const, label: "Price alerts hitting your target" },
                    { type: "ORDER_FILLED" as const, label: "Orders executed"                  },
                    { type: "EARNINGS"     as const, label: "Earnings announcements"           },
                    { type: "ANOMALY"      as const, label: "Unusual market activity"          },
                  ]).map(({ type, label }) => {
                    const { Icon, color, bg } = typeIcon(type);
                    return (
                      <div key={type} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Icon size={12} color={color} />
                        </div>
                        <span style={{ fontSize: 12, color: T.muted }}>{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            notifications.map(n => {
              const { Icon, color, bg } = typeIcon(n.type);
              return (
                <div key={n.id} onClick={() => !n.read && onMarkRead(n.id)}
                  style={{
                    display: "flex", gap: 12, padding: "14px 20px",
                    cursor: n.read ? "default" : "pointer",
                    background: n.read ? "transparent" : T.unreadBg,
                    borderBottom: `1px solid ${T.itemBorder}`,
                    transition: "background 0.15s", position: "relative",
                  }}
                  onMouseEnter={e => { if (!n.read) (e.currentTarget as HTMLDivElement).style.background = T.hoverBg; }}
                  onMouseLeave={e => { if (!n.read) (e.currentTarget as HTMLDivElement).style.background = T.unreadBg; }}
                >
                  {!n.read && (
                    <div style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", width: 5, height: 5, borderRadius: "50%", background: "#8FFFD6" }} />
                  )}
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={15} color={color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <p style={{ color: n.read ? T.muted : T.title, fontSize: 13, fontWeight: n.read ? 400 : 600, margin: 0, lineHeight: 1.3 }}>
                        {n.title}
                      </p>
                      <span style={{ color: T.muted, fontSize: 10, flexShrink: 0, marginTop: 1 }}>
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                    <p style={{ color: T.muted, fontSize: 12, margin: "3px 0 0", lineHeight: 1.5 }}>{n.message}</p>
                    {n.symbol && (
                      <span style={{ display: "inline-block", marginTop: 6, background: bg, color, fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99, border: `1px solid ${color}33` }}>
                        {n.symbol}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
          <Link href="/dashboard/notifications" onClick={onClose}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              color: "#8FFFD6", fontSize: 13, textDecoration: "none",
              padding: "9px", borderRadius: 8, border: "1px solid rgba(143,255,214,0.2)",
              transition: "background 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(143,255,214,0.07)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            View all notifications <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </>
  );
}