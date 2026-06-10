"use client";

import { useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { useMarket, MARKETS, MarketId } from "@/lib/MarketContext";

export default function MarketSwitcher() {
  const { market, setMarketId } = useMarket();
  const [open, setOpen] = useState(false);

  const options = Object.values(MARKETS);

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          background: open ? "var(--color-card)" : "transparent",
          border: "1px solid",
          borderColor: open ? "var(--color-line)" : "transparent",
          borderRadius: 10,
          cursor: "pointer",
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => {
          if (!open) {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--color-card)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-line)";
          }
        }}
        onMouseLeave={(e) => {
          if (!open) {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent";
          }
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>{market.flag}</span>
        <div style={{ flex: 1, textAlign: "left" }}>
          <div style={{ color: "var(--color-primary)", fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>
            {market.label}
          </div>
          <div style={{ color: "var(--color-muted)", fontSize: 11, marginTop: 2, lineHeight: 1 }}>
            {market.currency}
          </div>
        </div>

        <span style={{
          fontSize: 11, fontWeight: 700, color: "#8FFFD6",
          background: "rgba(143,255,214,0.08)",
          border: "1px solid rgba(143,255,214,0.15)",
          borderRadius: 5, padding: "2px 6px",
          letterSpacing: 0.3, minWidth: 20, textAlign: "center",
        }}>
          {market.currency || market.id}
        </span>

        <ChevronDown
          size={13}
          color="var(--color-muted)"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
            flexShrink: 0,
          }}
        />
      </button>

      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 40 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0, right: 0,
            background: "var(--color-card)",
            border: "1px solid var(--color-line)",
            borderRadius: 10,
            overflow: "hidden",
            zIndex: 50,
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            animation: "msFadeIn 0.15s ease",
          }}>
            <style>{`
              @keyframes msFadeIn {
                from { opacity: 0; transform: translateY(-4px); }
                to   { opacity: 1; transform: translateY(0); }
              }
              .ms-option:hover { background: var(--color-surface-hover) !important; }
            `}</style>

            {options.map((m, idx) => {
              const isActive = m.id === market.id;
              return (
                <button
                  key={m.id}
                  className="ms-option"
                  onClick={() => { setMarketId(m.id as MarketId); setOpen(false); }}
                  style={{
                    width: "100%",
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "11px 14px",
                    background: isActive ? "var(--color-line)" : "transparent",
                    border: "none",
                    borderTop: idx === 0 ? "none" : "1px solid var(--color-line)",
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                >
                  <span style={{ fontSize: 15 }}>{m.flag}</span>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <div style={{
                      color: isActive ? "#8FFFD6" : "var(--color-primary)",
                      fontSize: 12,
                      fontWeight: isActive ? 600 : 400,
                      lineHeight: 1.3,
                    }}>
                      {m.label}
                    </div>
                    <div style={{ color: "var(--color-muted)", fontSize: 11, marginTop: 1 }}>
                      {m.currency}
                    </div>
                  </div>

                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    color: "var(--color-muted)",
                    padding: "1px 5px", borderRadius: 4,
                    background: "var(--color-page)",
                    border: "1px solid var(--color-line)",
                  }}>
                    {m.currency || m.id}
                  </span>

                  {isActive && <Check size={13} color="#8FFFD6" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}