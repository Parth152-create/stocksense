"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "next-themes";
import { register, googleAuth } from "@/lib/auth";

declare global {
  interface Window {
    google?: {
      accounts: { id: { initialize: (c: object) => void; renderButton: (el: HTMLElement, c: object) => void; }; };
    };
  }
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

function getStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 8)           score++;
  if (/[A-Z]/.test(pw))         score++;
  if (/[0-9]/.test(pw))         score++;
  if (/[^A-Za-z0-9]/.test(pw))  score++;
  if (score <= 1) return { score: 1, label: "Weak",   color: "#ef4444" };
  if (score === 2) return { score: 2, label: "Fair",   color: "#f59e0b" };
  if (score === 3) return { score: 3, label: "Good",   color: "#10b981" };
  return               { score: 4, label: "Strong", color: "#10b981" };
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

export default function RegisterPage() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [name, setName]               = useState("");
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [confirm, setConfirm]         = useState("");
  const [showPw, setShowPw]           = useState(false);
  const [loading, setLoading]         = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const strength = getStrength(password);

  // ── Theme tokens ──────────────────────────────────────────────────────────
  const isDark = mounted && resolvedTheme === "dark";
  const T = {
    pageBg:     isDark ? "#0a0a0a"  : "#F3F2F2",
    cardBg:     isDark ? "#111111"  : "#ffffff",
    cardBorder: isDark ? "#1f1f1f"  : "transparent",
    cardShadow: isDark ? "none"     : "0 2px 16px rgba(0,0,0,0.06)",
    primary:    isDark ? "#ffffff"  : "#18181A",
    muted:      isDark ? "#6b7280"  : "#9ca3af",
    inputBg:    isDark ? "#0a0a0a"  : "#ffffff",
    inputBorder:isDark ? "#2a2a2a"  : "#e5e7eb",
    inputFocus: isDark ? "#8FFFD6"  : "#18181A",
    strengthBg: isDark ? "#1f1f1f"  : "#e5e7eb",
    divider:    isDark ? "#1f1f1f"  : "#f3f4f6",
    logoBg:     "#18181A",
    btnBg:      isDark ? "#8FFFD6"  : "#18181A",
    btnColor:   isDark ? "#0a0a0a"  : "#ffffff",
    googleBg:   isDark ? "#1a1a1a"  : "#ffffff",
    googleBorder:isDark ? "#2a2a2a" : "#e5e7eb",
    googleHover: isDark ? "#222222" : "#f9fafb",
    googleColor: isDark ? "#ffffff" : "#18181A",
    linkColor:  isDark ? "#8FFFD6"  : "#18181A",
    footerColor:isDark ? "#4b5563"  : "#9ca3af",
    footerSpan: isDark ? "#6b7280"  : "#6b7280",
  };

  const inputStyle: React.CSSProperties = {
    width:"100%", boxSizing:"border-box",
    background:T.inputBg, border:`1px solid ${T.inputBorder}`,
    borderRadius:10, padding:"10px 14px",
    fontSize:13, color:T.primary,
    outline:"none", transition:"border-color 0.15s",
  };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true; script.defer = true;
    script.onload = () => {
      window.google?.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCallback });
      const btn = document.getElementById("google-btn-reg");
      if (btn) {
        window.google?.accounts.id.renderButton(btn, { theme: isDark ? "filled_black" : "outline", size: "large", width: btn.offsetWidth, text: "signup_with" });
        setGoogleReady(true);
      }
    };
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark]);

  async function handleGoogleCallback(response: { credential: string }) {
    setLoading(true); setError(null);
    try { await googleAuth(response.credential); router.push("/dashboard"); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Google sign-up failed"); }
    finally { setLoading(false); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (strength.score < 2)   { setError("Password is too weak"); return; }
    setLoading(true); setError(null);
    try { await register(name, email, password); router.push("/dashboard"); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Registration failed"); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight:"100vh", background:T.pageBg, display:"flex", alignItems:"center", justifyContent:"center", padding:"24px 16px", fontFamily:"var(--font-geist-sans,'Geist',sans-serif)", transition:"background 0.2s" }}>
      <div style={{ width:"100%", maxWidth:400 }}>

        <div style={{ background:T.cardBg, borderRadius:20, padding:"36px 32px", boxShadow:T.cardShadow, border:`1px solid ${T.cardBorder}`, transition:"background 0.2s, border-color 0.2s" }}>

          {/* Logo */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginBottom:24 }}>
            <div style={{ width:32, height:32, background:T.logoBg, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" fill="#8FFFD6"/>
              </svg>
            </div>
            <span style={{ color:T.primary, fontWeight:700, fontSize:16, letterSpacing:-0.3 }}>StockSense</span>
          </div>

          <h1 style={{ color:T.primary, fontSize:22, fontWeight:700, textAlign:"center", margin:"0 0 6px" }}>Create Account</h1>
          <p style={{ color:T.muted, fontSize:13, textAlign:"center", margin:"0 0 24px" }}>Start trading smarter with StockSense</p>

          {error && (
            <div style={{ marginBottom:16, padding:"10px 14px", borderRadius:10, background:isDark?"#7f1d1d22":"#fef2f2", border:"1px solid #ef444444", color:"#dc2626", fontSize:13 }}>
              {error}
            </div>
          )}

          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

            {/* Name */}
            <div>
              <label style={{ display:"block", color:T.primary, fontSize:12, fontWeight:500, marginBottom:6 }}>Full Name</label>
              <input type="text" required value={name} onChange={e=>setName(e.target.value)} placeholder="John Doe" style={inputStyle}
                onFocus={e=>(e.target.style.borderColor=T.inputFocus)} onBlur={e=>(e.target.style.borderColor=T.inputBorder)}/>
            </div>

            {/* Email */}
            <div>
              <label style={{ display:"block", color:T.primary, fontSize:12, fontWeight:500, marginBottom:6 }}>Email Address</label>
              <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle}
                onFocus={e=>(e.target.style.borderColor=T.inputFocus)} onBlur={e=>(e.target.style.borderColor=T.inputBorder)}/>
            </div>

            {/* Password */}
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                <label style={{ color:T.primary, fontSize:12, fontWeight:500 }}>Password</label>
                <button type="button" onClick={()=>setShowPw(v=>!v)} style={{ background:"none", border:"none", cursor:"pointer", color:T.muted, fontSize:12 }}>
                  {showPw?"Hide":"Show"}
                </button>
              </div>
              <input type={showPw?"text":"password"} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Min. 8 characters" style={inputStyle}
                onFocus={e=>(e.target.style.borderColor=T.inputFocus)} onBlur={e=>(e.target.style.borderColor=T.inputBorder)}/>
              {password.length > 0 && (
                <div style={{ marginTop:8 }}>
                  <div style={{ display:"flex", gap:4, marginBottom:4 }}>
                    {[0,1,2,3].map(i=>(
                      <div key={i} style={{ flex:1, height:3, borderRadius:99, background:i<strength.score?strength.color:T.strengthBg, transition:"background 0.2s" }}/>
                    ))}
                  </div>
                  <p style={{ fontSize:11, color:strength.color, margin:0 }}>{strength.label}</p>
                </div>
              )}
            </div>

            {/* Confirm */}
            <div>
              <label style={{ display:"block", color:T.primary, fontSize:12, fontWeight:500, marginBottom:6 }}>Confirm Password</label>
              <input type={showPw?"text":"password"} required value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Repeat password"
                style={{ ...inputStyle, borderColor:confirm&&confirm!==password?"#ef4444":T.inputBorder }}
                onFocus={e=>{if(!confirm||confirm===password) e.target.style.borderColor=T.inputFocus;}}
                onBlur={e=>{e.target.style.borderColor=confirm&&confirm!==password?"#ef4444":T.inputBorder;}}/>
              {confirm && confirm !== password && (
                <p style={{ color:"#ef4444", fontSize:11, marginTop:4 }}>Passwords do not match</p>
              )}
            </div>

            {/* Submit */}
            <button type="button" disabled={loading} onClick={handleSubmit as unknown as React.MouseEventHandler}
              style={{ width:"100%", padding:"11px 0", background:loading?"#374151":T.btnBg, color:T.btnColor, border:"none", borderRadius:10, fontSize:14, fontWeight:600, cursor:loading?"not-allowed":"pointer", transition:"background 0.15s", marginTop:4 }}>
              {loading?"Creating account…":"Create Account"}
            </button>
          </div>

          {/* Divider */}
          <div style={{ display:"flex", alignItems:"center", gap:12, margin:"20px 0" }}>
            <div style={{ flex:1, height:1, background:T.divider }}/>
            <span style={{ color:T.muted, fontSize:12 }}>or</span>
            <div style={{ flex:1, height:1, background:T.divider }}/>
          </div>

          {/* Google */}
          {GOOGLE_CLIENT_ID ? (
            <div id="google-btn-reg" style={{ width:"100%", display:"flex", justifyContent:"center", minHeight:44, visibility:googleReady?"visible":"hidden" }}/>
          ) : (
            <button type="button" onClick={()=>window.location.href="http://localhost:8081/oauth2/authorization/google"}
              style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:10, padding:"10px 0", borderRadius:10, background:T.googleBg, border:`1px solid ${T.googleBorder}`, fontSize:13, fontWeight:500, color:T.googleColor, cursor:"pointer", transition:"background 0.15s" }}
              onMouseEnter={e=>(e.currentTarget.style.background=T.googleHover)}
              onMouseLeave={e=>(e.currentTarget.style.background=T.googleBg)}>
              <GoogleIcon/>
              Continue with Google
            </button>
          )}

          <p style={{ textAlign:"center", color:T.muted, fontSize:13, marginTop:20 }}>
            Already have an account?{" "}
            <Link href="/login" style={{ color:T.linkColor, fontWeight:600, textDecoration:"none" }}>Sign in</Link>
          </p>
        </div>

        <p style={{ textAlign:"center", color:T.footerColor, fontSize:11, marginTop:16 }}>
          By creating an account you agree to our{" "}
          <span style={{ color:T.footerSpan }}>Terms of Service</span> and{" "}
          <span style={{ color:T.footerSpan }}>Privacy Policy</span>.
        </p>
      </div>
    </div>
  );
}