"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Sun, Moon, Eye, EyeOff } from "lucide-react";
import { register, getToken } from "@/lib/auth";

// ── Shared icons (same as login) ──────────────────────────────────────────────
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

function BoltLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" fill="#8FFFD6"/>
    </svg>
  );
}

// ── Floating theme toggle (identical to login) ────────────────────────────────
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

// ── Register page ─────────────────────────────────────────────────────────────
export default function RegisterPage() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [showPw,      setShowPw]      = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [btnHovered,  setBtnHovered]  = useState(false);

  // focus states
  const [focus, setFocus] = useState({ name: false, email: false, pw: false, confirm: false });

  useEffect(() => {
    if (getToken()) router.replace("/dashboard");
  }, [router]);

  // ── theme tokens ──────────────────────────────────────────────────────────
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
  };

  function focusStyle(field: keyof typeof focus) {
    return {
      background:  T.inputBg,
      border:      `1.5px solid ${focus[field] ? T.inputFocus : T.inputBorder}`,
      color:       T.inputColor,
      boxShadow:   focus[field]
        ? isDark
          ? "0 0 0 3px rgba(143,255,214,0.1)"
          : "0 0 0 3px rgba(24,24,26,0.08)"
        : "none",
    };
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirm) { setError("Passwords do not match"); return; }
    if (form.password.length < 8)       { setError("Password must be at least 8 characters"); return; }

    setLoading(true);
    try {
      await register(form.email, form.password, form.name);
      router.replace("/onboarding");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed. Email may already be in use.");
    } finally {
      setLoading(false);
    }
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const [googleHovered, setGoogleHovered] = useState(false);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Gantari:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }

        .reg-input {
          width: 100%;
          padding: 11px 14px;
          border-radius: 10px;
          font-size: 13.5px;
          font-family: var(--font-gantari, 'Gantari', system-ui, sans-serif);
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          appearance: none;
          -webkit-appearance: none;
        }

        .reg-input::placeholder { color: #6b7280; }

        .reg-btn {
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

        .reg-btn:active   { transform: scale(0.985); }
        .reg-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

        .pw-toggle {
          position: absolute; right: 12px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none; cursor: pointer; padding: 2px;
          display: flex; align-items: center;
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
                background: "#18181A",
                borderRadius: 12,
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 12,
                boxShadow: isDark
                  ? "0 0 20px rgba(143,255,214,0.15)"
                  : "0 4px 12px rgba(0,0,0,0.12)",
              }}>
                <BoltLogo size={20} />
              </div>
              <span style={{ color: T.primary, fontWeight: 700, fontSize: 15, letterSpacing: "-0.02em" }}>
                StockSense
              </span>
            </div>

            {/* ── Heading ── */}
            <h1 style={{
              color: T.primary, fontSize: 24, fontWeight: 800,
              textAlign: "center", margin: "0 0 6px",
              letterSpacing: "-0.03em", lineHeight: 1.2,
            }}>
              Create your account
            </h1>
            <p style={{
              color: T.muted, fontSize: 13, textAlign: "center",
              margin: "0 0 28px", lineHeight: 1.5,
            }}>
              Start trading smarter with StockSense
            </p>

            {/* ── Error ── */}
            {error && (
              <div style={{
                marginBottom: 16, padding: "10px 14px", borderRadius: 10,
                background: T.errorBg, border: `1px solid ${T.errorBorder}`,
                color: "#dc2626", fontSize: 13, lineHeight: 1.4,
              }}>
                {error}
              </div>
            )}

            {/* ── Form ── */}
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Full name */}
              <div>
                <label style={{ display: "block", color: T.primary, fontSize: 12, fontWeight: 600, marginBottom: 7, letterSpacing: "0.01em" }}>
                  Full Name
                </label>
                <input
                  type="text" required autoComplete="name"
                  value={form.name} onChange={set("name")}
                  placeholder="Jane Doe"
                  className="reg-input"
                  onFocus={() => setFocus(f => ({ ...f, name: true  }))}
                  onBlur ={() => setFocus(f => ({ ...f, name: false }))}
                  style={focusStyle("name")}
                />
              </div>

              {/* Email */}
              <div>
                <label style={{ display: "block", color: T.primary, fontSize: 12, fontWeight: 600, marginBottom: 7, letterSpacing: "0.01em" }}>
                  Email Address
                </label>
                <input
                  type="email" required autoComplete="email"
                  value={form.email} onChange={set("email")}
                  placeholder="Email address.com"
                  className="reg-input"
                  onFocus={() => setFocus(f => ({ ...f, email: true  }))}
                  onBlur ={() => setFocus(f => ({ ...f, email: false }))}
                  style={focusStyle("email")}
                />
              </div>

              {/* Password */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                  <label style={{ color: T.primary, fontSize: 12, fontWeight: 600, letterSpacing: "0.01em" }}>
                    Password
                  </label>
                  <span style={{ color: T.muted, fontSize: 12 }}>Min. 8 characters</span>
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPw ? "text" : "password"} required autoComplete="new-password"
                    value={form.password} onChange={set("password")}
                    placeholder="Create a password"
                    className="reg-input"
                    onFocus={() => setFocus(f => ({ ...f, pw: true  }))}
                    onBlur ={() => setFocus(f => ({ ...f, pw: false }))}
                    style={{ ...focusStyle("pw"), paddingRight: 44 }}
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="pw-toggle" aria-label={showPw ? "Hide password" : "Show password"}
                    style={{ color: T.muted }}>
                    {showPw ? <EyeOff size={16} strokeWidth={2}/> : <Eye size={16} strokeWidth={2}/>}
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                  <label style={{ color: T.primary, fontSize: 12, fontWeight: 600, letterSpacing: "0.01em" }}>
                    Confirm Password
                  </label>
                  {form.confirm && form.password && (
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: form.confirm === form.password ? "#22c55e" : "#ef4444",
                    }}>
                      {form.confirm === form.password ? "✓ Match" : "✗ Mismatch"}
                    </span>
                  )}
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    type={showConfirm ? "text" : "password"} required autoComplete="new-password"
                    value={form.confirm} onChange={set("confirm")}
                    placeholder="Repeat password"
                    className="reg-input"
                    onFocus={() => setFocus(f => ({ ...f, confirm: true  }))}
                    onBlur ={() => setFocus(f => ({ ...f, confirm: false }))}
                    style={{
                      ...focusStyle("confirm"),
                      paddingRight: 44,
                      borderColor: form.confirm && form.password && form.confirm !== form.password
                        ? "#ef444466"
                        : focus.confirm ? T.inputFocus : T.inputBorder,
                    }}
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)}
                    className="pw-toggle" aria-label={showConfirm ? "Hide password" : "Show password"}
                    style={{ color: T.muted }}>
                    {showConfirm ? <EyeOff size={16} strokeWidth={2}/> : <Eye size={16} strokeWidth={2}/>}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="reg-btn"
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
                {loading ? "Creating account…" : "Create Account"}
              </button>
            </form>

            {/* ── Divider ── */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "22px 0" }}>
              <div style={{ flex: 1, height: 1, background: T.divider }}/>
              <span style={{ color: T.muted, fontSize: 12, letterSpacing: "0.02em" }}>or</span>
              <div style={{ flex: 1, height: 1, background: T.divider }}/>
            </div>

            {/* ── Google ── */}
            <button
              type="button"
              onClick={() => (window.location.href = "http://localhost:8081/oauth2/authorization/google")}
              onMouseEnter={() => setGoogleHovered(true)}
              onMouseLeave={() => setGoogleHovered(false)}
              style={{
                width: "100%",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                padding: "11px 0", borderRadius: 10,
                background:   googleHovered ? T.googleHover : T.googleBg,
                border:       `1.5px solid ${T.googleBorder}`,
                color:        T.googleColor,
                fontSize:     13.5, fontWeight: 600,
                fontFamily:   "var(--font-gantari,'Gantari',system-ui,sans-serif)",
                cursor:       "pointer",
                transition:   "background 0.15s, transform 0.1s",
                letterSpacing: "-0.01em",
              }}
            >
              <GoogleIcon />
              Continue with Google
            </button>

            {/* ── Login link ── */}
            <p style={{
              textAlign: "center", color: T.muted, fontSize: 13,
              marginTop: 22, marginBottom: 0, lineHeight: 1.5,
            }}>
              Already have an account?{" "}
              <Link href="/login" style={{
                color: T.linkColor, fontWeight: 700,
                textDecoration: "none", letterSpacing: "-0.01em",
              }}>
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}