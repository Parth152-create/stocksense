"use client";

/**
 * PWAManager — drop into dashboard/layout.tsx inside <ToastProvider>
 *
 * Handles:
 *   1. Install prompt  — "Add to Home Screen" banner (Cmd+K style)
 *   2. Offline banner  — detects network loss, shows persistent bar
 *   3. Push permission — one-time prompt after 30s on dashboard
 *
 * Usage in dashboard/layout.tsx:
 *   import { PWAManager } from "@/components/PWAManager";
 *   // Inside return, after <ToastProvider>:
 *   <PWAManager />
 */

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download, X, Wifi, WifiOff, Bell, BellOff,
  Smartphone, TrendingUp, CheckCircle,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT      = "#8FFFD6";
const INSTALL_KEY = "ss_pwa_install_dismissed";
const PUSH_KEY    = "ss_push_permission_asked";

// ─── Types ────────────────────────────────────────────────────────────────────

type BannerType = "install" | "offline" | "push" | null;

// ─── Offline hook ─────────────────────────────────────────────────────────────

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  useEffect(() => {
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online",  on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online",  on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return isOnline;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PWAManager() {
  const pathname = usePathname();
  const isOnline = useOnlineStatus();

  const [banner,          setBanner]          = useState<BannerType>(null);
  const [deferredPrompt,  setDeferredPrompt]  = useState<any>(null);
  const [isInstalled,     setIsInstalled]     = useState(false);
  const [pushPermission,  setPushPermission]  = useState<NotificationPermission>("default");
  const [installing,      setInstalling]      = useState(false);
  const [justInstalled,   setJustInstalled]   = useState(false);
  const [wasOffline,      setWasOffline]      = useState(false);

  // ── Detect already installed ───────────────────────────────────────────────
  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    if (mq.matches) setIsInstalled(true);
    const handler = (e: MediaQueryListEvent) => setIsInstalled(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // ── Capture beforeinstallprompt ────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Only show if not dismissed before and not already installed
      const dismissed = localStorage.getItem(INSTALL_KEY);
      if (!dismissed && !isInstalled) {
        // Delay 4s after page load to not be jarring
        setTimeout(() => setBanner("install"), 4000);
      }
    };
    window.addEventListener("beforeinstallprompt", handler as EventListener);
    return () => window.removeEventListener("beforeinstallprompt", handler as EventListener);
  }, [isInstalled]);

  // ── Offline/online transitions ─────────────────────────────────────────────
  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      setBanner("offline");
    } else if (wasOffline) {
      // Back online — show brief "connected" state then hide
      setBanner("offline"); // keep showing but now online
      setTimeout(() => {
        setBanner(prev => prev === "offline" ? null : prev);
        setWasOffline(false);
      }, 3000);
    }
  }, [isOnline]);

  // ── Push notification permission prompt ───────────────────────────────────
  useEffect(() => {
    if (typeof Notification === "undefined") return;
    const current = Notification.permission;
    setPushPermission(current);

    const alreadyAsked = localStorage.getItem(PUSH_KEY);
    if (alreadyAsked || current !== "default" || isInstalled) return;

    // Only prompt on dashboard pages, after 30s
    if (!pathname.startsWith("/dashboard")) return;

    const timer = setTimeout(() => {
      // Don't show push if install banner is showing
      setBanner(prev => prev === null ? "push" : prev);
    }, 30000);

    return () => clearTimeout(timer);
  }, [pathname, isInstalled]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setJustInstalled(true);
        setIsInstalled(true);
        setTimeout(() => { setBanner(null); setJustInstalled(false); }, 3000);
      } else {
        setBanner(null);
        localStorage.setItem(INSTALL_KEY, "1");
      }
      setDeferredPrompt(null);
    } finally {
      setInstalling(false);
    }
  }, [deferredPrompt]);

  const dismissInstall = useCallback(() => {
    setBanner(null);
    localStorage.setItem(INSTALL_KEY, "1");
  }, []);

  const handlePushPermission = useCallback(async () => {
    localStorage.setItem(PUSH_KEY, "1");
    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      setBanner(null);
    } catch {
      setBanner(null);
    }
  }, []);

  const dismissPush = useCallback(() => {
    setBanner(null);
    localStorage.setItem(PUSH_KEY, "1");
  }, []);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes pwaSlideUp   { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pwaSlideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pwaPulse     { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>

      <AnimatePresence>

        {/* ── Offline / Back online banner (top) ── */}
        {banner === "offline" && (
          <motion.div
            key="offline"
            initial={{ y: -48, opacity: 0 }}
            animate={{ y: 0,   opacity: 1 }}
            exit={{   y: -48, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            style={{
              position: "fixed", top: 0, left: 0, right: 0,
              zIndex: 99999,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              padding: "10px 20px",
              background: isOnline
                ? "linear-gradient(90deg, rgba(34,197,94,0.95), rgba(34,197,94,0.85))"
                : "linear-gradient(90deg, rgba(239,68,68,0.97), rgba(185,28,28,0.95))",
              backdropFilter: "blur(12px)",
              boxShadow: "0 2px 16px rgba(0,0,0,0.3)",
              fontFamily: "var(--font-gantari,'Gantari',sans-serif)",
            }}
          >
            {isOnline
              ? <><CheckCircle size={15} color="#fff" /><span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>Back online — data is syncing</span></>
              : <><WifiOff size={15} color="#fff" style={{ animation: "pwaPulse 1.5s ease infinite" }} /><span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>You're offline — showing cached data</span></>
            }
          </motion.div>
        )}

        {/* ── Install prompt (bottom sheet style) ── */}
        {banner === "install" && !isInstalled && (
          <motion.div
            key="install"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0,  opacity: 1 }}
            exit={{   y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            style={{
              position: "fixed", bottom: 24, left: "50%",
              transform: "translateX(-50%)",
              zIndex: 9998,
              width: "min(440px, calc(100vw - 48px)",
              background: "rgba(14,14,14,0.97)",
              border: `1px solid ${ACCENT}33`,
              borderRadius: 16,
              boxShadow: `0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px ${ACCENT}11`,
              overflow: "hidden",
              fontFamily: "var(--font-gantari,'Gantari',sans-serif)",
            }}
          >
            {/* Accent top bar */}
            <div style={{ height: 2, background: `linear-gradient(90deg, ${ACCENT}, #00c896)` }} />

            <div style={{ padding: "18px 20px" }}>
              {justInstalled ? (
                // ── Success state ──
                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "4px 0" }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                    background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <CheckCircle size={20} color="#22c55e" />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#fff" }}>
                      StockSense installed!
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6b7280" }}>
                      Find it on your home screen.
                    </p>
                  </div>
                </div>
              ) : (
                // ── Prompt state ──
                <>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16 }}>
                    {/* App icon */}
                    <div style={{
                      width: 48, height: 48, borderRadius: 13, flexShrink: 0,
                      background: "linear-gradient(135deg,#8FFFD6,#00c896)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 0 20px rgba(143,255,214,0.25)",
                    }}>
                      <TrendingUp size={22} color="#0a0a0a" strokeWidth={2.5} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#fff" }}>
                        Add StockSense to your home screen
                      </p>
                      <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                        Get faster access, offline support, and a native app experience.
                      </p>
                    </div>

                    <button onClick={dismissInstall} style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "#4b5563", padding: 4, flexShrink: 0,
                      display: "flex", alignItems: "center",
                    }}>
                      <X size={15} />
                    </button>
                  </div>

                  {/* Feature pills */}
                  <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
                    {[
                      { icon: <Wifi size={10} />,        label: "Works offline"     },
                      { icon: <Bell size={10} />,         label: "Price alerts"      },
                      { icon: <Smartphone size={10} />,   label: "Native feel"       },
                    ].map(f => (
                      <span key={f.label} style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "4px 10px", borderRadius: 99, fontSize: 11,
                        background: `${ACCENT}0f`,
                        border: `1px solid ${ACCENT}22`,
                        color: ACCENT,
                      }}>
                        {f.icon} {f.label}
                      </span>
                    ))}
                  </div>

                  {/* Buttons */}
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={dismissInstall} style={{
                      flex: "0 0 auto", padding: "10px 16px", borderRadius: 10,
                      border: "1px solid #2a2a2a", background: "transparent",
                      color: "#6b7280", cursor: "pointer", fontSize: 13, fontWeight: 500,
                      fontFamily: "inherit",
                    }}>
                      Not now
                    </button>
                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={handleInstall}
                      disabled={installing}
                      style={{
                        flex: 1, padding: "10px 0", borderRadius: 10, border: "none",
                        background: ACCENT, color: "#0a0a0a",
                        fontWeight: 700, fontSize: 13, cursor: installing ? "not-allowed" : "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        fontFamily: "inherit", opacity: installing ? 0.7 : 1,
                      }}
                    >
                      {installing
                        ? "Installing…"
                        : <><Download size={14} /> Install app</>
                      }
                    </motion.button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Push notification prompt (bottom sheet) ── */}
        {banner === "push" && pushPermission === "default" && (
          <motion.div
            key="push"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0,  opacity: 1 }}
            exit={{   y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            style={{
              position: "fixed", bottom: 24, left: "50%",
              transform: "translateX(-50%)",
              zIndex: 9998,
              width: "min(440px, calc(100vw - 48px))",
              background: "rgba(14,14,14,0.97)",
              border: "1px solid rgba(245,158,11,0.3)",
              borderRadius: 16,
              boxShadow: "0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(245,158,11,0.08)",
              overflow: "hidden",
              fontFamily: "var(--font-gantari,'Gantari',sans-serif)",
            }}
          >
            {/* Amber top bar */}
            <div style={{ height: 2, background: "linear-gradient(90deg, #f59e0b, #d97706)" }} />

            <div style={{ padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  background: "rgba(245,158,11,0.12)",
                  border: "1px solid rgba(245,158,11,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Bell size={20} color="#f59e0b" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#fff" }}>
                    Enable price alerts
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                    Get notified instantly when your stocks hit target prices — even when the app is closed.
                  </p>
                </div>
                <button onClick={dismissPush} style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#4b5563", padding: 4, flexShrink: 0,
                  display: "flex", alignItems: "center",
                }}>
                  <X size={15} />
                </button>
              </div>

              {/* What you'll get */}
              <div style={{
                padding: "10px 14px", borderRadius: 10,
                background: "rgba(245,158,11,0.06)",
                border: "1px solid rgba(245,158,11,0.15)",
                marginBottom: 16,
              }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[
                    "Price alerts when stocks hit your target",
                    "Order execution confirmations",
                    "Important market events",
                  ].map(item => (
                    <div key={item} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#f59e0b", flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Buttons */}
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={dismissPush} style={{
                  flex: "0 0 auto", padding: "10px 16px", borderRadius: 10,
                  border: "1px solid #2a2a2a", background: "transparent",
                  color: "#6b7280", cursor: "pointer", fontSize: 13, fontWeight: 500,
                  fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6,
                }}>
                  <BellOff size={13} /> Not now
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={handlePushPermission}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 10, border: "none",
                    background: "#f59e0b", color: "#0a0a0a",
                    fontWeight: 700, fontSize: 13, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    fontFamily: "inherit",
                  }}
                >
                  <Bell size={14} /> Enable notifications
                </motion.button>
              </div>

              <p style={{ margin: "10px 0 0", fontSize: 10, color: "#4b5563", textAlign: "center" }}>
                You can change this anytime in Settings → Notifications
              </p>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </>
  );
}