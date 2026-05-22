"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Sun, Moon, Eye, EyeOff } from "lucide-react";
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

// ── Google "G" SVG ────────────────────────────────────────────────────────────
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

// ── StockSense bolt logo ──────────────────────────────────────────────────────
function BoltLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" fill="#8FFFD6"/>
    </svg>
  );
}

// ── Visa SVG ─────────────────────────────────────────────────────────────────
function VisaIcon() {
  return (
    <svg width="28" height="18" viewBox="0 0 50 16" aria-label="Visa">
      <text x="0" y="13" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="14" fill="#1a1f71" letterSpacing="-0.5">VISA</text>
    </svg>
  );
}

// ── Mastercard SVG ────────────────────────────────────────────────────────────
function MastercardIcon() {
  return (
    <svg width="26" height="18" viewBox="0 0 38 24" aria-label="Mastercard">
      <circle cx="14" cy="12" r="10" fill="#EB001B"/>
      <circle cx="24" cy="12" r="10" fill="#F79E1B"/>
      <path d="M19 4.8a10 10 0 0 1 0 14.4A10 10 0 0 1 19 4.8z" fill="#FF5F00"/>
    </svg>
  );
}

// ── Floating theme toggle ─────────────────────────────────────────────────────
function FloatingThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle theme"
      style={{
        position: "fixed", top: 20, right: 20, zIndex: 100,
        width: 52, height: 28, borderRadius: 99,
        background: isDark ? "rgba(143,255,214,0.12)" : "#e5e7eb",
        border: isDark ? "1px solid rgba(143,255,214,0.25)" : "1px solid #d1d5db",
        cursor: "pointer", flexShrink: 0,
        transition: "background 0.2s, border-color 0.2s",
        display: "flex", alignItems: "center", padding: "0 3px",
      }}
    >
      <Sun  size={11} style={{ position: "absolute", left: 6,  color: isDark ? "transparent" : "#f59e0b", transition: "color 0.2s" }}/>
      <Moon size={11} style={{ position: "absolute", right: 6, color: isDark ? "#8FFFD6" : "transparent", transition: "color 0.2s" }}/>
      <span style={{
        position: "relative", zIndex: 1, width: 22, height: 22, borderRadius: "50%",
        background: isDark ? "#8FFFD6" : "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        transform: isDark ? "translateX(24px)" : "translateX(0px)",
        transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1), background 0.2s",
      }}>
        {isDark
          ? <Moon size={11} style={{ color: "#0a0a0a" }} strokeWidth={2.5}/>
          : <Sun  size={11} style={{ color: "#f59e0b" }} strokeWidth={2.5}/>
        }
      </span>
    </button>
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

  // ── theme tokens ──────────────────────────────────────────────────────────
  const T = {
    pageBg:       isDark ? "#0a0a0a"               : "#F3F2F2",
    cardBg:       isDark ? "#111111"               : "#ffffff",
    cardBorder:   isDark ? "rgba(255,255,255,0.06)": "transparent",
    cardShadow:   isDark ? "0 0 0 1px rgba(255,255,255,0.04), 0 24px 48px rgba(0,0,0,0.4)"
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

  // focus state per-field
  const [emailFocus, setEmailFocus] = useState(false);
  const [pwFocus,    setPwFocus]    = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const script = document.createElement("script");
    script.src   = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback:  handleGoogleCallback,
      });
      const btn = document.getElementById("google-btn");
      if (btn) {
        window.google?.accounts.id.renderButton(btn, {
          theme: isDark ? "filled_black" : "outline",
          size:  "large",
          width: btn.offsetWidth,
          text:  "continue_with",
        });
        setGoogleReady(true);
      }
    };
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
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
    try   { await login(email, password); router.push(redirectTo); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "Invalid email or password"); }
    finally { setLoading(false); }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Gantari:wght@400;500;600;700;800&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }

        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }

        .login-input {
          width: 100%;
          padding: 11px 14px;
          border-radius: 10px;
          font-size: 13.5px;
          font-family: var(--font-gantari, 'Gantari', system-ui, sans-serif);
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
          appearance: none;
          -webkit-appearance: none;
        }

        .login-input::placeholder { color: #6b7280; }

        .login-btn-primary {
          width: 100%;
          padding: 12px 0;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 700;
          font-family: var(--font-gantari, 'Gantari', system-ui, sans-serif);
          cursor: pointer;
          transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
          letter-spacing: -0.01em;
        }

        .login-btn-primary:active { transform: scale(0.985); }
        .login-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

        .login-btn-google {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 11px 0;
          border-radius: 10px;
          font-size: 13.5px;
          font-weight: 600;
          font-family: var(--font-gantari, 'Gantari', system-ui, sans-serif);
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s, transform 0.1s;
          letter-spacing: -0.01em;
        }

        .login-btn-google:active { transform: scale(0.985); }

        .pw-toggle {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          padding: 2px;
          display: flex;
          align-items: center;
          transition: opacity 0.15s;
        }

        .pw-toggle:hover { opacity: 0.7; }
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: T.pageBg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        fontFamily: "var(--font-gantari,'Gantari',system-ui,sans-serif)",
        transition: "background 0.25s",
      }}>
        <FloatingThemeToggle />

        <div style={{ width: "100%", maxWidth: 420 }}>

          {/* ── Card ── */}
          <div style={{
            background: T.cardBg,
            borderRadius: 20,
            padding: "40px 36px 36px",
            boxShadow: T.cardShadow,
            border: `1px solid ${T.cardBorder}`,
            transition: "background 0.25s, box-shadow 0.25s",
            animation: "fadeIn 0.35s cubic-bezier(0.22,1,0.36,1) both",
          }}>

            {/* ── Logo ── */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
              <div style={{
                width: 44, height: 44,
                background: isDark ? "#18181A" : "#18181A",
                borderRadius: 12,
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 12,
                boxShadow: isDark
                  ? "0 0 20px rgba(143,255,214,0.15)"
                  : "0 4px 12px rgba(0,0,0,0.12)",
              }}>
                <BoltLogo size={20} />
              </div>
              <span style={{
                color: T.primary,
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: "-0.02em",
              }}>StockSense</span>
            </div>

            {/* ── Heading ── */}
            <h1 style={{
              color: T.primary,
              fontSize: 24,
              fontWeight: 800,
              textAlign: "center",
              margin: "0 0 6px",
              letterSpacing: "-0.03em",
              lineHeight: 1.2,
            }}>
              Welcome Back to StockSense
            </h1>
            <p style={{
              color: T.muted,
              fontSize: 13,
              textAlign: "center",
              margin: "0 0 28px",
              lineHeight: 1.5,
            }}>
              Sign in to your account
            </p>

            {/* ── Alerts ── */}
            {expired && (
              <div style={{
                marginBottom: 16,
                padding: "10px 14px",
                borderRadius: 10,
                background: T.warnBg,
                border: `1px solid ${T.warnBorder}`,
                color: "#b45309",
                fontSize: 13,
                lineHeight: 1.4,
              }}>
                Your session expired. Please sign in again.
              </div>
            )}
            {error && (
              <div style={{
                marginBottom: 16,
                padding: "10px 14px",
                borderRadius: 10,
                background: T.errorBg,
                border: `1px solid ${T.errorBorder}`,
                color: "#dc2626",
                fontSize: 13,
                lineHeight: 1.4,
              }}>
                {error}
              </div>
            )}

            {/* ── Form ── */}
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Email */}
              <div>
                <label style={{
                  display: "block",
                  color: T.primary,
                  fontSize: 12,
                  fontWeight: 600,
                  marginBottom: 7,
                  letterSpacing: "0.01em",
                }}>
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Email address.com"
                  className="login-input"
                  onFocus={() => setEmailFocus(true)}
                  onBlur={() => setEmailFocus(false)}
                  style={{
                    background:  T.inputBg,
                    border:      `1.5px solid ${emailFocus ? T.inputFocus : T.inputBorder}`,
                    color:       T.inputColor,
                    boxShadow:   emailFocus
                      ? isDark
                        ? "0 0 0 3px rgba(143,255,214,0.1)"
                        : "0 0 0 3px rgba(24,24,26,0.08)"
                      : "none",
                  }}
                />
              </div>

              {/* Password */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                  <label style={{ color: T.primary, fontSize: 12, fontWeight: 600, letterSpacing: "0.01em" }}>
                    Password
                  </label>
                  <span style={{ color: T.muted, fontSize: 12, letterSpacing: "-0.01em" }}>
                    Show Password
                  </span>
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPw ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Password"
                    className="login-input"
                    onFocus={() => setPwFocus(true)}
                    onBlur={() => setPwFocus(false)}
                    style={{
                      background:   T.inputBg,
                      border:       `1.5px solid ${pwFocus ? T.inputFocus : T.inputBorder}`,
                      color:        T.inputColor,
                      paddingRight: 44,
                      boxShadow:    pwFocus
                        ? isDark
                          ? "0 0 0 3px rgba(143,255,214,0.1)"
                          : "0 0 0 3px rgba(24,24,26,0.08)"
                        : "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="pw-toggle"
                    aria-label={showPw ? "Hide password" : "Show password"}
                    style={{ color: T.muted }}
                  >
                    {showPw
                      ? <EyeOff size={16} strokeWidth={2}/>
                      : <Eye    size={16} strokeWidth={2}/>
                    }
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="login-btn-primary"
                onMouseEnter={() => setBtnHovered(true)}
                onMouseLeave={() => setBtnHovered(false)}
                style={{
                  background: btnHovered && !loading ? T.btnHover : T.btnBg,
                  color:      T.btnColor,
                  marginTop:  2,
                  boxShadow:  isDark
                    ? "0 4px 16px rgba(143,255,214,0.18)"
                    : "0 4px 12px rgba(0,0,0,0.15)",
                }}
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>

            {/* ── Divider ── */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "22px 0" }}>
              <div style={{ flex: 1, height: 1, background: T.divider }}/>
              <span style={{ color: T.muted, fontSize: 12, letterSpacing: "0.02em" }}>or</span>
              <div style={{ flex: 1, height: 1, background: T.divider }}/>
            </div>

            {/* ── Google button ── */}
            {GOOGLE_CLIENT_ID ? (
              <div
                id="google-btn"
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "center",
                  minHeight: 44,
                  visibility: googleReady ? "visible" : "hidden",
                }}
              />
            ) : (
              <GoogleFallbackButton T={T} />
            )}

            {/* ── Sign up link ── */}
            <p style={{
              textAlign: "center",
              color: T.muted,
              fontSize: 13,
              marginTop: 22,
              marginBottom: 0,
              lineHeight: 1.5,
            }}>
              Don&apos;t have an account?{" "}
              <Link href="/register" style={{
                color: T.linkColor,
                fontWeight: 700,
                textDecoration: "none",
                letterSpacing: "-0.01em",
              }}>
                Sign Up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Google fallback button (no client id configured) ──────────────────────────
function GoogleFallbackButton({ T }: { T: Record<string, string> }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={() => (window.location.href = "http://localhost:8081/oauth2/authorization/google")}
      className="login-btn-google"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:   hovered ? T.googleHover : T.googleBg,
        border:       `1.5px solid ${T.googleBorder}`,
        color:        T.googleColor,
      }}
    >
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

// Re-export helpers so register page can import them too
export { GoogleIcon, BoltLogo, VisaIcon, MastercardIcon };