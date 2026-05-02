"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { register, googleAuth } from "@/lib/auth";

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

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName]               = useState("");
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [confirm, setConfirm]         = useState("");
  const [showPw, setShowPw]           = useState(false);
  const [loading, setLoading]         = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const strength = getStrength(password);

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
      const btn = document.getElementById("google-btn-reg");
      if (btn) {
        window.google?.accounts.id.renderButton(btn, {
          theme: "filled_black",
          size: "large",
          width: btn.offsetWidth,
          text: "signup_with",
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
      router.push("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Google sign-up failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (strength.score < 2)   { setError("Password is too weak"); return; }
    setLoading(true);
    setError(null);
    try {
      await register(name, email, password);
      router.push("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Registration failed");
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
          <h1 className="text-white text-2xl font-semibold text-center mb-1">Create Account</h1>
          <p className="text-[#666] text-sm text-center mb-6">Start trading smarter with StockSense</p>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-950/40 border border-red-800/40 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-[#999] text-xs mb-1.5">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-4 py-3 text-white text-sm placeholder-[#444] outline-none transition-all"
                style={{ caretColor: "#8FFFD6" }}
                onFocus={e => (e.target.style.borderColor = "#8FFFD6")}
                onBlur={e  => (e.target.style.borderColor = "#1f1f1f")}
              />
            </div>

            {/* Email */}
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

            {/* Password */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[#999] text-xs">Password</label>
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="text-[#666] text-xs hover:text-[#8FFFD6] transition-colors"
                >
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
              <input
                type={showPw ? "text" : "password"}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-4 py-3 text-white text-sm placeholder-[#444] outline-none transition-all"
                style={{ caretColor: "#8FFFD6" }}
                onFocus={e => (e.target.style.borderColor = "#8FFFD6")}
                onBlur={e  => (e.target.style.borderColor = "#1f1f1f")}
              />
              {password.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map(i => (
                      <div
                        key={i}
                        className="h-1 flex-1 rounded-full transition-all duration-300"
                        style={{
                          background:
                            i < strength.score
                              ? strength.score <= 1 ? "#ef4444"
                              : strength.score <= 2 ? "#f59e0b"
                              : "#8FFFD6"
                              : "#1f1f1f",
                        }}
                      />
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: strength.color }}>{strength.label}</p>
                </div>
              )}
            </div>

            {/* Confirm */}
            <div>
              <label className="block text-[#999] text-xs mb-1.5">Confirm Password</label>
              <input
                type={showPw ? "text" : "password"}
                required
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat password"
                className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-4 py-3 text-white text-sm placeholder-[#444] outline-none transition-all"
                style={{
                  caretColor: "#8FFFD6",
                  borderColor: confirm && confirm !== password ? "#ef4444" : "#1f1f1f",
                }}
                onFocus={e => {
                  if (!confirm || confirm === password) e.target.style.borderColor = "#8FFFD6";
                }}
                onBlur={e => {
                  e.target.style.borderColor =
                    confirm && confirm !== password ? "#ef4444" : "#1f1f1f";
                }}
              />
              {confirm && confirm !== password && (
                <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg font-semibold text-sm text-[#0a0a0a] mt-2 transition-all"
              style={{
                background: loading ? "#5fa88a" : "#8FFFD6",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-[#1f1f1f]" />
            <span className="text-[#444] text-xs">or</span>
            <div className="flex-1 h-px bg-[#1f1f1f]" />
          </div>

          {GOOGLE_CLIENT_ID ? (
            <div
              id="google-btn-reg"
              className="w-full flex justify-center"
              style={{ minHeight: 44, visibility: googleReady ? "visible" : "hidden" }}
            />
          ) : (
            <button
              type="button"
              onClick={() =>
                setError("Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to .env.local to enable Google sign-up.")
              }
              className="w-full flex items-center justify-center gap-3 py-3 rounded-lg border border-[#1f1f1f] text-[#555] text-sm hover:border-[#333] hover:text-[#777] transition-all"
            >
              <GoogleIcon />
              Continue with Google
            </button>
          )}

          <p className="text-center text-[#555] text-sm mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-[#8FFFD6] hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-center text-[#333] text-xs mt-4">
          By creating an account you agree to our{" "}
          <span className="text-[#444]">Terms of Service</span> and{" "}
          <span className="text-[#444]">Privacy Policy</span>.
        </p>
      </div>
    </div>
  );
}

function getStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 8)        score++;
  if (/[A-Z]/.test(pw))      score++;
  if (/[0-9]/.test(pw))      score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score: 1, label: "Weak",   color: "#ef4444" };
  if (score === 2) return { score: 2, label: "Fair",   color: "#f59e0b" };
  if (score === 3) return { score: 3, label: "Good",   color: "#8FFFD6" };
  return               { score: 4, label: "Strong", color: "#8FFFD6" };
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