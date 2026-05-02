"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { login, googleAuth } from "@/lib/auth";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: object) => void;
          renderButton: (el: HTMLElement, config: object) => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/dashboard";
  const expired = searchParams.get("reason") === "session_expired";

  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [showPw, setShowPw]           = useState(false);
  const [loading, setLoading]         = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCallback,
      });
      const btn = document.getElementById("google-btn");
      if (btn) {
        window.google?.accounts.id.renderButton(btn, {
          theme: "filled_black",
          size: "large",
          width: btn.offsetWidth,
          text: "continue_with",
        });
        setGoogleReady(true);
      }
    };
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  async function handleGoogleCallback(response: { credential: string }) {
    setLoading(true);
    setError(null);
    try {
      await googleAuth(response.credential);
      router.push(redirectTo);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      router.push(redirectTo);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(143,255,214,0.07) 0%, transparent 70%)",
        }}
      />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex items-center gap-2 justify-center mb-8">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" fill="#8FFFD6" />
          </svg>
          <span className="text-white font-semibold text-lg tracking-tight">StockSense</span>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8" style={{ background: "#111111", border: "1px solid #1f1f1f" }}>
          <h1 className="text-white text-2xl font-semibold text-center mb-1">Welcome Back</h1>
          <p className="text-[#666] text-sm text-center mb-6">Sign in to your StockSense account</p>

          {expired && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-amber-950/40 border border-amber-800/40 text-amber-400 text-sm">
              Your session expired. Please sign in again.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[#999] text-xs mb-1.5">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-4 py-3 text-white text-sm placeholder-[#444] outline-none transition-all"
                style={{ caretColor: "#8FFFD6" }}
                onFocus={e => (e.target.style.borderColor = "#8FFFD6")}
                onBlur={e  => (e.target.style.borderColor = "#1f1f1f")}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[#999] text-xs">Password</label>
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="text-[#666] text-xs hover:text-[#8FFFD6] transition-colors"
                >
                  {showPw ? "Hide" : "Show"} Password
                </button>
              </div>
              <input
                type={showPw ? "text" : "password"}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-4 py-3 text-white text-sm placeholder-[#444] outline-none transition-all"
                style={{ caretColor: "#8FFFD6" }}
                onFocus={e => (e.target.style.borderColor = "#8FFFD6")}
                onBlur={e  => (e.target.style.borderColor = "#1f1f1f")}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg font-semibold text-sm text-[#0a0a0a] transition-all mt-2"
              style={{
                background: loading ? "#5fa88a" : "#8FFFD6",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          {/* Error — shown below form, not at top */}
          {error && (
            <div className="mt-4 px-4 py-3 rounded-lg bg-red-950/40 border border-red-800/40 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-[#1f1f1f]" />
            <span className="text-[#444] text-xs">or</span>
            <div className="flex-1 h-px bg-[#1f1f1f]" />
          </div>

          {GOOGLE_CLIENT_ID ? (
            <div
              id="google-btn"
              className="w-full flex justify-center"
              style={{ minHeight: 44, visibility: googleReady ? "visible" : "hidden" }}
            />
          ) : (
            <button
              type="button"
              onClick={() =>
                setError("Google sign-in is not configured. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to .env.local.")
              }
              className="w-full flex items-center justify-center gap-3 py-3 rounded-lg border border-[#1f1f1f] text-[#555] text-sm hover:border-[#2a2a2a] hover:text-[#777] transition-all"
            >
              <GoogleIcon />
              Continue with Google
            </button>
          )}

          <p className="text-center text-[#555] text-sm mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-[#8FFFD6] hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.583c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.583 9 3.583z"/>
    </svg>
  );
}