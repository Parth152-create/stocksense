"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

const ICONS: Record<ToastType, string> = {
  success: "✓",
  error:   "✕",
  info:    "ℹ",
  warning: "⚠",
};

const COLORS: Record<ToastType, { border: string; icon: string; bg: string }> = {
  success: { border: "#22c55e55", icon: "#22c55e", bg: "rgba(34,197,94,0.08)"  },
  error:   { border: "#ef444455", icon: "#ef4444", bg: "rgba(239,68,68,0.08)"  },
  info:    { border: "#8FFFD655", icon: "#8FFFD6", bg: "rgba(143,255,214,0.08)"},
  warning: { border: "#f59e0b55", icon: "#f59e0b", bg: "rgba(245,158,11,0.08)" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<string, NodeJS.Timeout>>({});

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const toast = useCallback((message: string, type: ToastType = "info", duration = 3500) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev.slice(-4), { id, type, message, duration }]);
    timers.current[id] = setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Toast container — top right */}
      <div style={{
        position: "fixed", top: 72, right: 24, zIndex: 9999,
        display: "flex", flexDirection: "column", gap: 10,
        pointerEvents: "none",
      }}>
        {toasts.map(t => {
          const c = COLORS[t.type];
          return (
            <div key={t.id} style={{
              pointerEvents: "all",
              display: "flex", alignItems: "flex-start", gap: 10,
              padding: "12px 16px",
              background: `color-mix(in srgb, var(--color-card) 90%, transparent)`,
              backdropFilter: "blur(12px)",
              border: `1px solid ${c.border}`,
              borderLeft: `3px solid ${c.icon}`,
              borderRadius: 10,
              boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
              minWidth: 280, maxWidth: 360,
              animation: "toastIn 0.25s cubic-bezier(0.34,1.56,0.64,1) both",
              cursor: "pointer",
            }} onClick={() => dismiss(t.id)}>
              <span style={{
                width: 18, height: 18, borderRadius: "50%",
                background: c.bg, border: `1px solid ${c.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 700, color: c.icon, flexShrink: 0,
              }}>
                {ICONS[t.type]}
              </span>
              <p style={{ margin: 0, fontSize: 13, color: "var(--color-primary)", lineHeight: 1.5, flex: 1 }}>
                {t.message}
              </p>
              <span style={{ fontSize: 16, color: "var(--color-muted)", lineHeight: 1, flexShrink: 0 }}>×</span>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(20px) scale(0.95); }
          to   { opacity: 1; transform: translateX(0)    scale(1); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);