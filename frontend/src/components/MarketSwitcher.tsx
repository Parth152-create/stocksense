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
      {/* Trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          background: open ? "#1a1a1a" : "transparent",
          border: "1px solid",
          borderColor: open ? "#2a2a2a" : "#1a1a1a",
          borderRadius: 10,
          cursor: "pointer",
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => {
          if (!open) {
            (e.currentTarget as HTMLButtonElement).style.background = "#151515";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#242424";
          }
        }}
        onMouseLeave={(e) => {
          if (!open) {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#1a1a1a";
          }
        }}
      >
        {/* Flag + labels */}
        <span style={{ fontSize: 16, lineHeight: 1 }}>{market.flag}</span>
        <div style={{ flex: 1, textAlign: "left" }}>
          <div style={{ color: "#fff", fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>
            {market.label}
          </div>
          <div style={{ color: "#555", fontSize: 11, marginTop: 2, lineHeight: 1 }}>
            {market.currency}
          </div>
        </div>

        {/* Currency badge */}
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#8FFFD6",
            background: "rgba(143,255,214,0.08)",
            border: "1px solid rgba(143,255,214,0.15)",
            borderRadius: 5,
            padding: "2px 6px",
            letterSpacing: 0.3,
            minWidth: 20,
            textAlign: "center",
          }}
        >
          {market.currency || market.id}
        </span>

        <ChevronDown
          size={13}
          color="#555"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
            flexShrink: 0,
          }}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Backdrop to close on outside click */}
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 40,
            }}
            onClick={() => setOpen(false)}
          />

          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              right: 0,
              background: "#111111",
              border: "1px solid #2a2a2a",
              borderRadius: 10,
              overflow: "hidden",
              zIndex: 50,
              boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
              animation: "msFadeIn 0.15s ease",
            }}
          >
            <style>{`
              @keyframes msFadeIn {
                from { opacity: 0; transform: translateY(-4px); }
                to   { opacity: 1; transform: translateY(0); }
              }
              .ms-option:hover { background: #181818 !important; }
            `}</style>

            {options.map((m, idx) => {
              const isActive = m.id === market.id;
              return (
                <button
                  key={m.id}
                  className="ms-option"
                  onClick={() => {
                    setMarketId(m.id as MarketId);
                    setOpen(false);
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "11px 14px",
                    background: isActive ? "#161616" : "transparent",
                    border: "none",
                    borderTop: idx === 0 ? "none" : "1px solid #1a1a1a",
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                >
                  <span style={{ fontSize: 15 }}>{m.flag}</span>

                  <div style={{ flex: 1, textAlign: "left" }}>
                    <div
                      style={{
                        color: isActive ? "#8FFFD6" : "#ccc",
                        fontSize: 12,
                        fontWeight: isActive ? 600 : 400,
                        lineHeight: 1.3,
                      }}
                    >
                      {m.label}
                    </div>
                    <div style={{ color: "#444", fontSize: 11, marginTop: 1 }}>
                      {m.currency}
                    </div>
                  </div>

                  {/* Currency pill */}
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#666",
                      padding: "1px 5px",
                      borderRadius: 4,
                      background: "#1a1a1a",
                    }}
                  >
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