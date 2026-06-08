"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, BellOff, Star } from "lucide-react";
import { fetchWithAuth } from "@/lib/auth";
import { useToast } from "@/components/ToastContext";

const ACCENT = "#8FFFD6";
const BULL   = "#22c55e";
const BEAR   = "#ef4444";
const AMBER  = "#f59e0b";

interface Props {
  symbol:      string;
  price:       number | null;
  watchlisted: boolean;
  currency:    string;
}

export function PriceAlertPanel({ symbol, price, watchlisted, currency }: Props) {
  const { toast } = useToast();

  const [alertPrice,   setAlertPrice]   = useState("");
  const [currentAlert, setCurrentAlert] = useState<number | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [loaded,       setLoaded]       = useState(false);
  const [focused,      setFocused]      = useState(false);

  // Load existing alert on mount / when watchlist status changes
  useEffect(() => {
    if (!watchlisted) { setLoaded(true); return; }
    fetchWithAuth("/api/watchlist")
      .then(r => r.ok ? r.json() : [])
      .then((items: { symbol: string; alertPrice: number | null }[]) => {
        const sym = symbol.toUpperCase();
        const match = items.find(i => {
          const s = i.symbol.toUpperCase().replace(/\.(NS|BSE|NSE)$/, "");
          return s === sym || i.symbol.toUpperCase() === sym;
        });
        if (match?.alertPrice != null) {
          setCurrentAlert(match.alertPrice);
          setAlertPrice(match.alertPrice.toString());
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [symbol, watchlisted]);

  const handleSave = async () => {
    const val = parseFloat(alertPrice);
    if (isNaN(val) || val <= 0) { toast("Enter a valid price", "error"); return; }
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/watchlist/${symbol}/alert`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertPrice: val }),
      });
      if (res.ok) {
        setCurrentAlert(val);
        toast(`Alert set — notify when ${symbol} hits ${currency}${val.toLocaleString()}`, "success");
      } else {
        const err = await res.json().catch(() => ({}));
        toast((err as any).error ?? "Failed to set alert — is the stock on your watchlist?", "error");
      }
    } catch { toast("Network error", "error"); }
    finally   { setSaving(false); }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/watchlist/${symbol}/alert`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertPrice: null }),
      });
      if (res.ok) {
        setCurrentAlert(null);
        setAlertPrice("");
        toast("Price alert cleared", "info");
      }
    } catch { toast("Network error", "error"); }
    finally   { setSaving(false); }
  };

  // Direction hint
  const inputVal   = parseFloat(alertPrice);
  const abovePrice = price != null && !isNaN(inputVal) && inputVal > price;
  const changeDir  = abovePrice ? "rises above" : "drops below";
  const hintColor  = abovePrice ? BULL : BEAR;
  const hasAlert   = currentAlert !== null;
  const hasInput   = alertPrice.length > 0 && !isNaN(inputVal) && inputVal > 0;

  // Not watchlisted — show nudge instead of full panel
  if (!watchlisted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        style={{
          background: "var(--color-card)",
          border: "1px solid var(--color-line)",
          borderRadius: 12, padding: "14px 16px",
          display: "flex", alignItems: "center", gap: 12,
        }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: "rgba(143,255,214,0.06)",
          border: "1px solid rgba(143,255,214,0.15)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <BellOff size={14} color="var(--color-muted)" />
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--color-primary)" }}>
            Price Alerts
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--color-muted)", lineHeight: 1.5 }}>
            Add {symbol} to your{" "}
            <span style={{ color: ACCENT, fontWeight: 600 }}>Watchlist</span>
            {" "}to set a price alert.
          </p>
        </div>
      </motion.div>
    );
  }

  if (!loaded) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: "var(--color-card)",
        border: `1px solid ${hasAlert ? AMBER + "44" : "var(--color-line)"}`,
        borderRadius: 12, padding: "16px 18px",
        position: "relative", overflow: "hidden",
        transition: "border-color 0.2s",
      }}
    >
      {/* Top accent bar when alert is active */}
      <AnimatePresence>
        {hasAlert && (
          <motion.div
            key="bar"
            initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} exit={{ scaleX: 0 }}
            style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 2,
              background: `linear-gradient(90deg, ${AMBER}, ${AMBER}88)`,
              transformOrigin: "left",
            }}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: hasAlert ? `${AMBER}14` : "rgba(255,255,255,0.04)",
            border: `1px solid ${hasAlert ? AMBER + "33" : "var(--color-line)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s",
          }}>
            <Bell size={14} color={hasAlert ? AMBER : "var(--color-muted)"} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--color-primary)" }}>
              Price Alert
            </p>
            <AnimatePresence mode="wait">
              {hasAlert ? (
                <motion.p
                  key="active"
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                  style={{ margin: 0, fontSize: 10, color: AMBER, fontWeight: 600 }}
                >
                  Active · {currency}{currentAlert?.toLocaleString()}
                </motion.p>
              ) : (
                <motion.p
                  key="inactive"
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                  style={{ margin: 0, fontSize: 10, color: "var(--color-muted)" }}
                >
                  No alert set
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>

        {hasAlert && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={handleClear} disabled={saving}
            style={{
              padding: "4px 10px", borderRadius: 6,
              border: "1px solid rgba(239,68,68,0.3)",
              background: "rgba(239,68,68,0.08)",
              color: BEAR, cursor: "pointer",
              fontSize: 11, fontWeight: 600,
              fontFamily: "var(--font-gantari,'Gantari',sans-serif)",
            }}
          >
            Clear
          </motion.button>
        )}
      </div>

      {/* Input row */}
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <span style={{
            position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
            fontSize: 13, color: "var(--color-muted)", pointerEvents: "none",
            userSelect: "none",
          }}>
            {currency}
          </span>
          <input
            type="number" min={0} step="0.01"
            value={alertPrice}
            onChange={e => setAlertPrice(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={e => e.key === "Enter" && hasInput && handleSave()}
            placeholder={price ? price.toFixed(2) : "0.00"}
            style={{
              width: "100%", padding: "9px 12px 9px 28px",
              borderRadius: 8, fontSize: 14, fontWeight: 500,
              background: "var(--color-page)",
              border: `1.5px solid ${focused ? AMBER : "var(--color-line)"}`,
              boxShadow: focused ? `0 0 0 3px ${AMBER}18` : "none",
              color: "var(--color-primary)", outline: "none",
              boxSizing: "border-box" as const,
              fontFamily: "var(--font-gantari,'Gantari',sans-serif)",
              transition: "border-color 0.15s, box-shadow 0.15s",
            }}
          />
        </div>
        <motion.button
          whileHover={{ scale: hasInput ? 1.04 : 1 }}
          whileTap={{ scale: hasInput ? 0.96 : 1 }}
          onClick={handleSave}
          disabled={saving || !hasInput}
          style={{
            padding: "9px 14px", borderRadius: 8, border: "none",
            background: hasInput ? AMBER : `${AMBER}33`,
            color: hasInput ? "#0a0a0a" : `${AMBER}66`,
            fontWeight: 700, fontSize: 12, flexShrink: 0,
            cursor: saving || !hasInput ? "not-allowed" : "pointer",
            fontFamily: "var(--font-gantari,'Gantari',sans-serif)",
            transition: "all 0.15s",
          }}
        >
          {saving ? "…" : hasAlert ? "Update" : "Set"}
        </motion.button>
      </div>

      {/* Direction hint */}
      <AnimatePresence>
        {hasInput && price && (
          <motion.p
            key="hint"
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: "auto", marginTop: 8 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            style={{ margin: 0, fontSize: 11, color: "var(--color-muted)", lineHeight: 1.5 }}
          >
            Notify me when {symbol}{" "}
            <span style={{ color: hintColor, fontWeight: 600 }}>{changeDir}</span>{" "}
            <strong style={{ color: hintColor }}>
              {currency}{inputVal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </strong>
          </motion.p>
        )}
        {!hasInput && (
          <motion.p
            key="default"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ margin: "8px 0 0", fontSize: 11, color: "var(--color-muted)", lineHeight: 1.5 }}
          >
            Get notified when {symbol} hits your target price.
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}