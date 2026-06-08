"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Sun, Moon, Eye, EyeOff, Fingerprint } from "lucide-react";
import { login, googleAuth } from "@/lib/auth";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (c: object) => void;
          renderButton: (el: HTMLElement, c: object) => void;
          prompt: () => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

// ── Biometric helpers ─────────────────────────────────────────────────────────

const BIOMETRIC_KEY = "ss_biometric_email";
const BIOMETRIC_DECLINED_KEY = "ss_biometric_declined";

/** Returns true if the browser supports the Credential Management API */
function isBiometricSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "credentials" in navigator &&
    typeof (navigator.credentials as any).store === "function"
  );
}

/** Returns the email that was last stored for biometric login, or null */
function getStoredBiometricEmail(): string | null {
  try { return localStorage.getItem(BIOMETRIC_KEY); }
  catch { return null; }
}

/** Stores an email for biometric re-login */
function storeBiometricEmail(email: string) {
  try { localStorage.setItem(BIOMETRIC_KEY, email); }
  catch { /* storage blocked */ }
}

/** Clears stored biometric email */
function clearBiometricEmail() {
  try { localStorage.removeItem(BIOMETRIC_KEY); }
  catch { /* storage blocked */ }
}

/**
 * Attempt biometric authentication via the Credential Management API.
 * On success, returns the stored PasswordCredential (which carries the email).
 * Returns null if the user cancels or the browser doesn't support it.
 */
async function requestBiometricCredential(): Promise<{ email: string; password: string } | null> {
  try {
    if (!("credentials" in navigator)) return null;
    const cred = await (navigator.credentials as any).get({
      password: true,
      mediation: "optional",
    }) as ({ id: string; password?: string }) | null;
    if (!cred) return null;
    return { email: cred.id, password: (cred as any).password ?? "" };
  } catch {
    return null;
  }
}

/**
 * Stores a PasswordCredential in the browser's credential manager.
 * Called after a successful email/password login when the user opts in.
 */
async function storeCredential(email: string, password: string): Promise<void> {
  try {
    if (!("credentials" in navigator) || !((window as any).PasswordCredential)) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const PC = (window as any).PasswordCredential as new (init: { id: string; password: string }) => Credential;
    const cred = new PC({ id: email, password });
    await navigator.credentials.store(cred);
    storeBiometricEmail(email);
  } catch { /* non-fatal */ }
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.583c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.583 9 3.583z"/>
    </svg>
  );
}

function BoltLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" fill="#8FFFD6"/>
    </svg>
  );
}

function VisaIcon() {
  return (
    <svg width="28" height="18" viewBox="0 0 50 16" aria-label="Visa">
      <text x="0" y="13" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="14" fill="#1a1f71" letterSpacing="-0.5">VISA</text>
    </svg>
  );
}

function MastercardIcon() {
  return (
    <svg width="26" height="18" viewBox="0 0 38 24" aria-label="Mastercard">
      <circle cx="14" cy="12" r="10" fill="#EB001B"/>
      <circle cx="24" cy="12" r="10" fill="#F79E1B"/>
      <path d="M19 4.8a10 10 0 0 1 0 14.4A10 10 0 0 1 19 4.8z" fill="#FF5F00"/>
    </svg>
  );
}

function FloatingThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  const isDark = resolvedTheme === "dark";
  return (
    <button onClick={() => setTheme(isDark ? "light" : "dark")} aria-label="Toggle theme"
      style={{ position: "fixed", top: 20, right: 20, zIndex: 100, width: 52, height: 28, borderRadius: 99, background: isDark ? "rgba(143,255,214,0.12)" : "#e5e7eb", border: isDark ? "1px solid rgba(143,255,214,0.25)" : "1px solid #d1d5db", cursor: "pointer", flexShrink: 0, transition: "background 0.2s, border-color 0.2s", display: "flex", alignItems: "center", padding: "0 3px" }}>
      <Sun  size={11} style={{ position: "absolute", left: 6,  color: isDark ? "transparent" : "#f59e0b", transition: "color 0.2s" }}/>
      <Moon size={11} style={{ position: "absolute", right: 6, color: isDark ? "#8FFFD6" : "transparent", transition: "color 0.2s" }}/>
      <span style={{ position: "relative", zIndex: 1, width: 22, height: 22, borderRadius: "50%", background: isDark ? "#8FFFD6" : "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", transform: isDark ? "translateX(24px)" : "translateX(0px)", transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1), background 0.2s" }}>
        {isDark ? <Moon size={11} style={{ color: "#0a0a0a" }} strokeWidth={2.5}/> : <Sun size={11} style={{ color: "#f59e0b" }} strokeWidth={2.5}/>}
      </span>
    </button>
  );
}

// ── Biometric button ──────────────────────────────────────────────────────────

function BiometricButton({ storedEmail, onSuccess, onError, T, isDark }: {
  storedEmail: string;
  onSuccess: (email: string, password: string) => void;
  onError: (msg: string) => void;
  T: Record<string, string>;
  isDark: boolean;
}) {
  const [loading,  setLoading]  = useState(false);
  const [hovered,  setHovered]  = useState(false);
  const [scanning, setScanning] = useState(false);

  const handleBiometric = async () => {
    setLoading(true);
    setScanning(true);
    try {
      const cred = await requestBiometricCredential();
      if (!cred || !cred.email) {
        onError("Biometric authentication cancelled or not available.");
        return;
      }
      onSuccess(cred.email, cred.password);
    } catch {
      onError("Biometric authentication failed. Please sign in manually.");
    } finally {
      setLoading(false);
      setScanning(false);
    }
  };

  const shortEmail = storedEmail.length > 22
    ? storedEmail.slice(0, 10) + "…" + storedEmail.slice(storedEmail.indexOf("@"))
    : storedEmail;

  return (
    <div style={{ marginBottom: 16 }}>
      <button
        type="button"
        onClick={handleBiometric}
        disabled={loading}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          padding: "12px 0", borderRadius: 10, cursor: loading ? "not-allowed" : "pointer",
          border: `1.5px solid ${hovered && !loading ? "#8FFFD6" : isDark ? "rgba(143,255,214,0.2)" : "rgba(143,255,214,0.4)"}`,
          background: hovered && !loading
            ? isDark ? "rgba(143,255,214,0.1)" : "rgba(143,255,214,0.08)"
            : isDark ? "rgba(143,255,214,0.05)" : "rgba(143,255,214,0.04)",
          transition: "all 0.18s",
          opacity: loading ? 0.7 : 1,
        }}>
        <div style={{ position: "relative", width: 20, height: 20 }}>
          <Fingerprint
            size={20}
            color={scanning ? "#8FFFD6" : "#8FFFD6"}
            style={{ animation: scanning ? "biometricPulse 1s ease-in-out infinite" : "none" }}
          />
          {scanning && (
            <span style={{ position: "absolute", inset: -4, borderRadius: "50%", border: "2px solid #8FFFD6", animation: "biometricRing 1s ease-out infinite", opacity: 0 }} />
          )}
        </div>
        <div style={{ textAlign: "left" }}>
          <p style={{ color: "#8FFFD6", fontSize: 13, fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>
            {loading ? "Authenticating…" : "Sign in with Biometrics"}
          </p>
          <p style={{ color: isDark ? "rgba(143,255,214,0.5)" : "rgba(0,150,100,0.6)", fontSize: 11, margin: "1px 0 0" }}>
            {shortEmail}
          </p>
        </div>
      </button>

      {/* "Not you?" link */}
      <p style={{ textAlign: "center", marginTop: 8, fontSize: 11, color: T.muted }}>
        Not {shortEmail}?{" "}
        <button
          type="button"
          onClick={() => { clearBiometricEmail(); window.location.reload(); }}
          style={{ background: "none", border: "none", color: T.linkColor, fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0 }}>
          Use a different account
        </button>
      </p>
    </div>
  );
}

// ── Main login form ───────────────────────────────────────────────────────────

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const redirectTo   = searchParams.get("redirect") ?? "/dashboard";
  const expired      = searchParams.get("reason") === "session_expired";

  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  const T = {
    pageBg:       isDark ? "#0a0a0a"               : "#F3F2F2",
    cardBg:       isDark ? "#111111"               : "#ffffff",
    cardBorder:   isDark ? "rgba(255,255,255,0.06)": "transparent",
    cardShadow:   isDark
      ? "0 0 0 1px rgba(255,255,255,0.04), 0 24px 48px rgba(0,0,0,0.4)"
      : "0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
    primary:      isDark ? "#ffffff"               : "#18181A",
    muted:        isDark ? "#6b7280"               : "#9ca3af",
    inputBg:      isDark ? "#0d0d0d"               : "#f9fafb",
    inputBorder:  isDark ? "rgba(255,255,255,0.08)": "#e5e7eb",
    inputFocus:   isDark ? "#8FFFD6"               : "#18181A",
    inputColor:   isDark ? "#ffffff"               : "#18181A",
    divider:      isDark ? "rgba(255,255,255,0.07)": "#f0f0f0",
    btnBg:        isDark ? "#8FFFD6"               : "#18181A",
    btnColor:     isDark ? "#0a0a0a"               : "#ffffff",
    btnHover:     isDark ? "#a5ffe1"               : "#2a2a2a",
    googleBg:     isDark ? "#181818"               : "#ffffff",
    googleBorder: isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb",
    googleHover:  isDark ? "#1f1f1f"               : "#f9fafb",
    googleColor:  isDark ? "#ffffff"               : "#18181A",
    linkColor:    isDark ? "#8FFFD6"               : "#18181A",
    errorBg:      isDark ? "rgba(127,29,29,0.25)"  : "#fef2f2",
    errorBorder:  isDark ? "rgba(239,68,68,0.3)"   : "rgba(239,68,68,0.25)",
    warnBg:       isDark ? "rgba(120,83,14,0.2)"   : "#fffbeb",
    warnBorder:   isDark ? "rgba(245,158,11,0.3)"  : "rgba(245,158,11,0.3)",
  };

  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [showPw,      setShowPw]      = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [btnHovered,  setBtnHovered]  = useState(false);
  const [emailFocus,  setEmailFocus]  = useState(false);
  const [pwFocus,     setPwFocus]     = useState(false);

  // Biometric state
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [storedEmail,        setStoredEmail]        = useState<string | null>(null);
  const [offerBiometric,     setOfferBiometric]     = useState(false); // shown after successful login

  useEffect(() => {
    setBiometricSupported(isBiometricSupported());
    setStoredEmail(getStoredBiometricEmail());
  }, []);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true; script.defer = true;
    script.onload = () => {
      window.google?.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCallback });
      const btn = document.getElementById("google-btn");
      if (btn) {
        window.google?.accounts.id.renderButton(btn, { theme: isDark ? "filled_black" : "outline", size: "large", width: btn.offsetWidth, text: "continue_with" });
        setGoogleReady(true);
      }
    };
    document.head.appendChild(script);
    return () => { try { document.head.removeChild(script); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark]);

  async function handleGoogleCallback(response: { credential: string }) {
    setLoading(true); setError(null);
    try   { await googleAuth(response.credential); router.push(redirectTo); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Google sign-in failed"); }
    finally { setLoading(false); }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setError(null);
    try {
      await login(email, password);
      const alreadyDeclined = localStorage.getItem(BIOMETRIC_DECLINED_KEY);
      // Offer biometric after successful login if supported, not already stored, and not declined
      if (biometricSupported && !storedEmail && !alreadyDeclined) {
        setOfferBiometric(true);
        return; // Don't redirect yet — wait for biometric offer response
      }
      router.push(redirectTo);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  async function handleBiometricSuccess(bioEmail: string, bioPassword: string) {
    if (!bioEmail) { setError("No stored credentials found. Please sign in manually."); return; }
    setLoading(true); setError(null);
    try {
      // Use the stored email; password may be empty if browser only stored identity
      if (bioPassword) {
        await login(bioEmail, bioPassword);
      } else {
        // Credential stored identity only — pre-fill email and let user enter password
        setEmail(bioEmail);
        setError(null);
        setLoading(false);
        return;
      }
      router.push(redirectTo);
    } catch {
      setError("Biometric sign-in failed. Please enter your password manually.");
      setEmail(bioEmail);
    } finally {
      setLoading(false);
    }
  }

  async function acceptBiometricOffer() {
    await storeCredential(email, password);
    setStoredEmail(email);
    setOfferBiometric(false);
    router.push(redirectTo);
  }

  function declineBiometricOffer() {
    localStorage.setItem(BIOMETRIC_DECLINED_KEY, "1");
    setOfferBiometric(false);
    router.push(redirectTo);
  }

  // ── Biometric offer screen ────────────────────────────────────────────────
  if (offerBiometric) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Gantari:wght@400;500;600;700;800&display=swap');
          *, *::before, *::after { box-sizing: border-box; }
          @keyframes fadeIn { from { opacity:0; transform:translateY(10px) scale(0.98); } to { opacity:1; transform:none; } }
          @keyframes biometricPulse { 0%,100%{opacity:1;transform:scale(1);} 50%{opacity:0.6;transform:scale(1.1);} }
          @keyframes biometricRing  { 0%{transform:scale(0.8);opacity:0.8;} 100%{transform:scale(2.2);opacity:0;} }
        `}</style>
        <div style={{ minHeight: "100vh", background: T.pageBg, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", fontFamily: "var(--font-gantari,'Gantari',system-ui,sans-serif)" }}>
          <FloatingThemeToggle />
          <div style={{ width: "100%", maxWidth: 420 }}>
            <div style={{ background: T.cardBg, borderRadius: 20, padding: "40px 36px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, animation: "fadeIn 0.35s cubic-bezier(0.22,1,0.36,1) both" }}>
              <div style={{ textAlign: "center", marginBottom: 28 }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: isDark ? "rgba(143,255,214,0.1)" : "rgba(143,255,214,0.12)", border: "2px solid rgba(143,255,214,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <Fingerprint size={28} color="#8FFFD6" />
                </div>
                <h2 style={{ color: T.primary, fontSize: 20, fontWeight: 800, margin: "0 0 8px", letterSpacing: "-0.03em" }}>Enable Biometric Login?</h2>
                <p style={{ color: T.muted, fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                  Use Face ID, Touch ID, or your device fingerprint to sign in faster next time.
                </p>
              </div>
              <div style={{ background: isDark ? "rgba(143,255,214,0.05)" : "rgba(143,255,214,0.06)", border: "1px solid rgba(143,255,214,0.15)", borderRadius: 10, padding: "12px 16px", marginBottom: 24 }}>
                <p style={{ color: T.muted, fontSize: 12, margin: 0, lineHeight: 1.6 }}>
                  Your credentials will be securely stored in your browser's credential manager — StockSense never sees your biometric data.
                </p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button onClick={acceptBiometricOffer}
                  style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "none", background: isDark ? "#8FFFD6" : "#18181A", color: isDark ? "#0a0a0a" : "#fff", cursor: "pointer", fontWeight: 700, fontSize: 14, fontFamily: "inherit" }}>
                  Enable Biometric Login
                </button>
                <button onClick={declineBiometricOffer}
                  style={{ width: "100%", padding: "11px 0", borderRadius: 10, border: `1px solid ${T.inputBorder}`, background: "transparent", color: T.muted, cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit" }}>
                  Not now
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Main login UI ─────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Gantari:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(10px) scale(0.98); } to { opacity:1; transform:none; } }
        @keyframes biometricPulse { 0%,100%{opacity:1;transform:scale(1);} 50%{opacity:0.6;transform:scale(1.1);} }
        @keyframes biometricRing  { 0%{transform:scale(0.8);opacity:0.8;} 100%{transform:scale(2.2);opacity:0;} }

        .login-input { width:100%; padding:11px 14px; border-radius:10px; font-size:13.5px; font-family:var(--font-gantari,'Gantari',system-ui,sans-serif); outline:none; transition:border-color 0.15s,box-shadow 0.15s,background 0.15s; appearance:none; -webkit-appearance:none; }
        .login-input::placeholder { color:#6b7280; }
        .login-btn-primary { width:100%; padding:12px 0; border:none; border-radius:10px; font-size:14px; font-weight:700; font-family:var(--font-gantari,'Gantari',system-ui,sans-serif); cursor:pointer; transition:background 0.15s,transform 0.1s,box-shadow 0.15s; letter-spacing:-0.01em; }
        .login-btn-primary:active { transform:scale(0.985); }
        .login-btn-primary:disabled { opacity:0.6; cursor:not-allowed; transform:none; }
        .login-btn-google { width:100%; display:flex; align-items:center; justify-content:center; gap:10px; padding:11px 0; border-radius:10px; font-size:13.5px; font-weight:600; font-family:var(--font-gantari,'Gantari',system-ui,sans-serif); cursor:pointer; transition:background 0.15s,border-color 0.15s,transform 0.1s; letter-spacing:-0.01em; }
        .login-btn-google:active { transform:scale(0.985); }
        .pw-toggle { position:absolute; right:12px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; padding:2px; display:flex; align-items:center; transition:opacity 0.15s; }
        .pw-toggle:hover { opacity:0.7; }
      `}</style>

      <div style={{ minHeight: "100vh", background: T.pageBg, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", fontFamily: "var(--font-gantari,'Gantari',system-ui,sans-serif)", transition: "background 0.25s" }}>
        <FloatingThemeToggle />

        <div style={{ width: "100%", maxWidth: 420 }}>
          <div style={{ background: T.cardBg, borderRadius: 20, padding: "40px 36px 36px", boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}`, transition: "background 0.25s, box-shadow 0.25s", animation: "fadeIn 0.35s cubic-bezier(0.22,1,0.36,1) both" }}>

            {/* Logo */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
              <div style={{ width: 44, height: 44, background: "#18181A", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, boxShadow: isDark ? "0 0 20px rgba(143,255,214,0.15)" : "0 4px 12px rgba(0,0,0,0.12)" }}>
                <BoltLogo size={20} />
              </div>
              <span style={{ color: T.primary, fontWeight: 700, fontSize: 15, letterSpacing: "-0.02em" }}>StockSense</span>
            </div>

            <h1 style={{ color: T.primary, fontSize: 24, fontWeight: 800, textAlign: "center", margin: "0 0 6px", letterSpacing: "-0.03em", lineHeight: 1.2 }}>
              Welcome Back
            </h1>
            <p style={{ color: T.muted, fontSize: 13, textAlign: "center", margin: "0 0 24px", lineHeight: 1.5 }}>
              Sign in to your account
            </p>

            {/* Alerts */}
            {expired && (
              <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 10, background: T.warnBg, border: `1px solid ${T.warnBorder}`, color: "#b45309", fontSize: 13, lineHeight: 1.4 }}>
                Your session expired. Please sign in again.
              </div>
            )}
            {error && (
              <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 10, background: T.errorBg, border: `1px solid ${T.errorBorder}`, color: "#dc2626", fontSize: 13, lineHeight: 1.4 }}>
                {error}
              </div>
            )}

            {/* ── Biometric button (shown when stored credential exists) ── */}
            {biometricSupported && storedEmail && (
              <BiometricButton
                storedEmail={storedEmail}
                onSuccess={handleBiometricSuccess}
                onError={msg => setError(msg)}
                T={T}
                isDark={isDark}
              />
            )}

            {/* Divider between biometric and form — only when biometric is shown */}
            {biometricSupported && storedEmail && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ flex: 1, height: 1, background: T.divider }} />
                <span style={{ color: T.muted, fontSize: 11 }}>or sign in with password</span>
                <div style={{ flex: 1, height: 1, background: T.divider }} />
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", color: T.primary, fontSize: 12, fontWeight: 600, marginBottom: 7, letterSpacing: "0.01em" }}>Email Address</label>
                <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="login-input"
                  onFocus={() => setEmailFocus(true)} onBlur={() => setEmailFocus(false)}
                  style={{ background: T.inputBg, border: `1.5px solid ${emailFocus ? T.inputFocus : T.inputBorder}`, color: T.inputColor, boxShadow: emailFocus ? isDark ? "0 0 0 3px rgba(143,255,214,0.1)" : "0 0 0 3px rgba(24,24,26,0.08)" : "none" }} />
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                  <label style={{ color: T.primary, fontSize: 12, fontWeight: 600, letterSpacing: "0.01em" }}>Password</label>
                  <span style={{ color: T.muted, fontSize: 12 }}>Show Password</span>
                </div>
                <div style={{ position: "relative" }}>
                  <input type={showPw ? "text" : "password"} required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="login-input"
                    onFocus={() => setPwFocus(true)} onBlur={() => setPwFocus(false)}
                    style={{ background: T.inputBg, border: `1.5px solid ${pwFocus ? T.inputFocus : T.inputBorder}`, color: T.inputColor, paddingRight: 44, boxShadow: pwFocus ? isDark ? "0 0 0 3px rgba(143,255,214,0.1)" : "0 0 0 3px rgba(24,24,26,0.08)" : "none" }} />
                  <button type="button" onClick={() => setShowPw(v => !v)} className="pw-toggle" aria-label={showPw ? "Hide password" : "Show password"} style={{ color: T.muted }}>
                    {showPw ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="login-btn-primary"
                onMouseEnter={() => setBtnHovered(true)} onMouseLeave={() => setBtnHovered(false)}
                style={{ background: btnHovered && !loading ? T.btnHover : T.btnBg, color: T.btnColor, marginTop: 2, boxShadow: isDark ? "0 4px 16px rgba(143,255,214,0.18)" : "0 4px 12px rgba(0,0,0,0.15)" }}>
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
              <div style={{ flex: 1, height: 1, background: T.divider }} />
              <span style={{ color: T.muted, fontSize: 12, letterSpacing: "0.02em" }}>or</span>
              <div style={{ flex: 1, height: 1, background: T.divider }} />
            </div>

            {/* Google */}
            {GOOGLE_CLIENT_ID ? (
              <div id="google-btn" style={{ width: "100%", display: "flex", justifyContent: "center", minHeight: 44, visibility: googleReady ? "visible" : "hidden" }} />
            ) : (
              <GoogleFallbackButton T={T} />
            )}

            <p style={{ textAlign: "center", color: T.muted, fontSize: 13, marginTop: 20, marginBottom: 0, lineHeight: 1.5 }}>
              Don&apos;t have an account?{" "}
              <Link href="/register" style={{ color: T.linkColor, fontWeight: 700, textDecoration: "none", letterSpacing: "-0.01em" }}>
                Sign Up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function GoogleFallbackButton({ T }: { T: Record<string, string> }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button type="button" onClick={() => (window.location.href = "http://localhost:8081/oauth2/authorization/google")}
      className="login-btn-google" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ background: hovered ? T.googleHover : T.googleBg, border: `1.5px solid ${T.googleBorder}`, color: T.googleColor }}>
      <GoogleIcon />
      Continue with Google
    </button>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

export { GoogleIcon, BoltLogo, VisaIcon, MastercardIcon };