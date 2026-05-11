"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { register, getToken } from "@/lib/auth";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Already logged in → skip to dashboard
  useEffect(() => {
    if (getToken()) router.replace("/dashboard");
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirm) {
      setError("Passwords do not match");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      // register() in lib/auth.ts calls POST /api/auth/register,
      // receives { accessToken, email }, stores token, sets cookie.
      await register(form.email, form.password, form.name);

      // Auto-login: token is now in sessionStorage (set by register())
      // → redirect straight into the dashboard
      router.replace("/dashboard");
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Registration failed. Email may already be in use."
      );
    } finally {
      setLoading(false);
    }
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--color-page)", padding: 24,
    }}>
      <div style={{
        width: "100%", maxWidth: 400,
        background: "var(--color-card)", border: "1px solid var(--color-line)",
        borderRadius: 16, padding: "36px 32px",
      }}>
        {/* Logo / brand */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>
            Stock<span style={{ color: "var(--color-primary)" }}>Sense</span>
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--color-muted)" }}>
            Create your account
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Name */}
          <div>
            <label style={{ fontSize: 12, color: "var(--color-muted)", display: "block", marginBottom: 5 }}>
              Full Name
            </label>
            <input
              type="text"
              required
              autoComplete="name"
              value={form.name}
              onChange={set("name")}
              placeholder="Jane Doe"
              style={inputStyle}
            />
          </div>

          {/* Email */}
          <div>
            <label style={{ fontSize: 12, color: "var(--color-muted)", display: "block", marginBottom: 5 }}>
              Email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={set("email")}
              placeholder="jane@example.com"
              style={inputStyle}
            />
          </div>

          {/* Password */}
          <div>
            <label style={{ fontSize: 12, color: "var(--color-muted)", display: "block", marginBottom: 5 }}>
              Password
            </label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={form.password}
              onChange={set("password")}
              placeholder="Min. 8 characters"
              style={inputStyle}
            />
          </div>

          {/* Confirm password */}
          <div>
            <label style={{ fontSize: 12, color: "var(--color-muted)", display: "block", marginBottom: 5 }}>
              Confirm Password
            </label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={form.confirm}
              onChange={set("confirm")}
              placeholder="Repeat password"
              style={inputStyle}
            />
          </div>

          {/* Error */}
          {error && (
            <p style={{
              margin: 0, padding: "10px 12px", borderRadius: 8, fontSize: 13,
              background: "color-mix(in srgb, var(--color-bear) 12%, transparent)",
              border: "1px solid color-mix(in srgb, var(--color-bear) 30%, transparent)",
              color: "var(--color-bear)",
            }}>
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "11px", borderRadius: 8, border: "none", cursor: "pointer",
              background: "var(--color-primary)", color: "#000",
              fontWeight: 700, fontSize: 14, marginTop: 4,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        {/* Divider */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          margin: "20px 0", color: "var(--color-muted)", fontSize: 12,
        }}>
          <div style={{ flex: 1, height: 1, background: "var(--color-line)" }} />
          or
          <div style={{ flex: 1, height: 1, background: "var(--color-line)" }} />
        </div>

        {/* Google OAuth button */}
        <GoogleSignInButton />

        {/* Login link */}
        <p style={{ margin: "20px 0 0", textAlign: "center", fontSize: 13, color: "var(--color-muted)" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--color-primary)", fontWeight: 600, textDecoration: "none" }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

// ─── Google Sign-In button ────────────────────────────────────────────────────
// Uses the standard Google Identity Services SDK loaded via _document or layout

function GoogleSignInButton() {
  const router = useRouter();

  const handleGoogleClick = () => {
    // This triggers the Google one-tap / popup flow.
    // google.accounts.id.initialize should be called in your layout with
    // callback: async ({ credential }) => { await googleAuth(credential); router.replace("/dashboard"); }
    //
    // If you're using the @react-oauth/google package:
    // <GoogleLogin onSuccess={async (res) => { await googleAuth(res.credential!); router.replace("/dashboard"); }} />
    //
    // For now this button is a placeholder that can be wired to your Google SDK init.
    if (typeof window !== "undefined" && (window as unknown as { google?: { accounts: { id: { prompt: () => void } } } }).google) {
      (window as unknown as { google: { accounts: { id: { prompt: () => void } } } }).google.accounts.id.prompt();
    } else {
      console.warn("Google Identity Services not loaded");
    }
    void router; // suppress unused warning — router used in the real callback
  };

  return (
    <button
      type="button"
      onClick={handleGoogleClick}
      style={{
        width: "100%", padding: "10px", borderRadius: 8, cursor: "pointer",
        background: "transparent",
        border: "1px solid var(--color-line)",
        color: "inherit", fontSize: 13, fontWeight: 600,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      }}
    >
      <GoogleIcon />
      Continue with Google
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  fontSize: 14,
  background: "var(--color-page)",
  border: "1px solid var(--color-line)",
  color: "inherit",
  boxSizing: "border-box",
  outline: "none",
};