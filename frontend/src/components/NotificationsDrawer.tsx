"use client";

import { useEffect, useRef, useCallback } from "react";
import { X, Bell, TrendingUp, ShoppingCart, BarChart2, AlertTriangle, CheckCheck } from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  if (m < 1)   return "just now";
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NotificationsDrawer({
  open, onClose, notifications, onMarkRead, onMarkAllRead,
}: Props) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 40,
          background: "rgba(0,0,0,0.4)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.2s",
        }}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: 380,
          background: "#111111",
          borderLeft: "1px solid #1f1f1f",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "20px 20px 16px",
          borderBottom: "1px solid #1f1f1f",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Bell size={16} color="#8FFFD6" />
            <span style={{ color: "#fff", fontWeight: 600, fontSize: 15 }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <span style={{
                background: "#8FFFD6", color: "#0a0a0a",
                fontSize: 10, fontWeight: 700,
                borderRadius: 99, padding: "1px 7px",
              }}>
                {unreadCount}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllRead}
                title="Mark all read"
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#555", display: "flex", alignItems: "center", gap: 4,
                  fontSize: 11, padding: "4px 8px", borderRadius: 6,
                  transition: "color 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.color = "#8FFFD6")}
                onMouseLeave={e => (e.currentTarget.style.color = "#555")}
              >
                <CheckCheck size={13} />
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                width: 28, height: 28, borderRadius: "50%",
                background: "#1a1a1a", border: "1px solid #2a2a2a",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "#666",
              }}
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {notifications.length === 0 ? (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", height: "100%", gap: 12, color: "#444",
            }}>
              <Bell size={32} strokeWidth={1} />
              <p style={{ fontSize: 13 }}>No notifications yet</p>
            </div>
          ) : (
            notifications.map(n => {
              const { Icon, color, bg } = typeIcon(n.type);
              return (
                <div
                  key={n.id}
                  onClick={() => !n.read && onMarkRead(n.id)}
                  style={{
                    display: "flex", gap: 12,
                    padding: "14px 20px",
                    cursor: n.read ? "default" : "pointer",
                    background: n.read ? "transparent" : "#161616",
                    borderBottom: "1px solid #181818",
                    transition: "background 0.15s",
                    position: "relative",
                  }}
                  onMouseEnter={e => {
                    if (!n.read) (e.currentTarget as HTMLDivElement).style.background = "#1c1c1c";
                  }}
                  onMouseLeave={e => {
                    if (!n.read) (e.currentTarget as HTMLDivElement).style.background = "#161616";
                  }}
                >
                  {/* Unread dot */}
                  {!n.read && (
                    <div style={{
                      position: "absolute", left: 8, top: "50%",
                      transform: "translateY(-50%)",
                      width: 5, height: 5, borderRadius: "50%",
                      background: "#8FFFD6",
                    }} />
                  )}

                  {/* Icon */}
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: bg, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon size={15} color={color} />
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <p style={{
                        color: n.read ? "#888" : "#fff",
                        fontSize: 13, fontWeight: n.read ? 400 : 600,
                        margin: 0, lineHeight: 1.3,
                      }}>
                        {n.title}
                      </p>
                      <span style={{ color: "#444", fontSize: 10, flexShrink: 0, marginTop: 1 }}>
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                    <p style={{
                      color: "#555", fontSize: 12, margin: "3px 0 0",
                      lineHeight: 1.5,
                    }}>
                      {n.message}
                    </p>
                    {n.symbol && (
                      <span style={{
                        display: "inline-block", marginTop: 6,
                        background: bg, color, fontSize: 10, fontWeight: 600,
                        padding: "2px 8px", borderRadius: 99,
                        border: `1px solid ${color}33`,
                      }}>
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
        <div style={{
          padding: "12px 20px",
          borderTop: "1px solid #1f1f1f",
          flexShrink: 0,
        }}>
          <a href="/dashboard/notifications" style={{
            display: "block", textAlign: "center",
            color: "#8FFFD6", fontSize: 13, textDecoration: "none",
            padding: "8px", borderRadius: 8,
            border: "1px solid #8FFFD622",
            transition: "background 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "#8FFFD611")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            View all notifications →
          </a>
        </div>
      </div>
    </>
  );
}