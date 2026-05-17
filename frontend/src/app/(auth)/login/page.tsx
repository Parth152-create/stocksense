"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { login, googleAuth } from "@/lib/auth";

declare global {
  interface Window {
    google?: { accounts: { id: { initialize: (c: object) => void; renderButton: (el: HTMLElement, c: object) => void; }; }; };
  }
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

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

// ── Floating theme toggle ────────────────────────────────────────────────────
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
        background: isDark ? "rgba(143,255,214,0.15)" : "#e5e7eb",
        border: isDark ? "1px solid rgba(143,255,214,0.3)" : "1px solid #d1d5db",
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
        {isDark ? <Moon size={11} style={{ color: "#0a0a0a" }} strokeWidth={2.5}/> : <Sun size={11} style={{ color: "#f59e0b" }} strokeWidth={2.5}/>}
      </span>
    </button>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/dashboard";
  const expired    = searchParams.get("reason") === "session_expired";
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const T = {
    pageBg:      isDark ? "#0a0a0a"  : "#F3F2F2",
    cardBg:      isDark ? "#111111"  : "#ffffff",
    cardBorder:  isDark ? "#1f1f1f"  : "transparent",
    cardShadow:  isDark ? "none"     : "0 2px 16px rgba(0,0,0,0.06)",
    primary:     isDark ? "#ffffff"  : "#18181A",
    muted:       isDark ? "#6b7280"  : "#9ca3af",
    inputBg:     isDark ? "#0a0a0a"  : "#ffffff",
    inputBorder: isDark ? "#2a2a2a"  : "#e5e7eb",
    inputFocus:  isDark ? "#8FFFD6"  : "#18181A",
    divider:     isDark ? "#1f1f1f"  : "#f3f4f6",
    btnBg:       isDark ? "#8FFFD6"  : "#18181A",
    btnColor:    isDark ? "#0a0a0a"  : "#ffffff",
    googleBg:    isDark ? "#1a1a1a"  : "#ffffff",
    googleBorder:isDark ? "#2a2a2a"  : "#e5e7eb",
    googleHover: isDark ? "#222222"  : "#f9fafb",
    googleColor: isDark ? "#ffffff"  : "#18181A",
    linkColor:   isDark ? "#8FFFD6"  : "#18181A",
  };

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
    return () => { document.head.removeChild(script); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark]);

  async function handleGoogleCallback(response: { credential: string }) {
    setLoading(true); setError(null);
    try { await googleAuth(response.credential); router.push(redirectTo); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Google sign-in failed"); }
    finally { setLoading(false); }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setError(null);
    try { await login(email, password); router.push(redirectTo); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "Login failed"); }
    finally { setLoading(false); }
  }

  return (
    <>
      <style>{`
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.97);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>

      <div style={{ minHeight:"100vh", background:T.pageBg, display:"flex", alignItems:"center", justifyContent:"center", padding:"24px 16px", fontFamily:"var(--font-geist-sans,'Geist',sans-serif)", transition:"background 0.2s" }}>
        <FloatingThemeToggle/>
        <div style={{ width:"100%", maxWidth:400 }}>
          <div
            style={{
              background:T.cardBg,
              borderRadius:20,
              padding:"36px 32px",
              boxShadow:T.cardShadow,
              border:`1px solid ${T.cardBorder}`,
              transition:"background 0.2s",
              animation:"scaleIn 0.3s ease both",
            }}
          >

            {/* Logo */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginBottom:24 }}>
              <div style={{ width:32, height:32, background:"#18181A", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" fill="#8FFFD6"/></svg>
              </div>
              <span style={{ color:T.primary, fontWeight:700, fontSize:16, letterSpacing:-0.3 }}>StockSense</span>
            </div>

            <h1 style={{ color:T.primary, fontSize:22, fontWeight:700, textAlign:"center", margin:"0 0 6px" }}>Welcome Back</h1>
            <p style={{ color:T.muted, fontSize:13, textAlign:"center", margin:"0 0 24px" }}>Sign in to your StockSense account</p>

            {expired && <div style={{ marginBottom:16, padding:"10px 14px", borderRadius:10, background:isDark?"#78350f22":"#fff8e1", border:"1px solid #f59e0b44", color:"#b45309", fontSize:13 }}>Your session expired. Please sign in again.</div>}
            {error   && <div style={{ marginBottom:16, padding:"10px 14px", borderRadius:10, background:isDark?"#7f1d1d22":"#fef2f2", border:"1px solid #ef444444", color:"#dc2626", fontSize:13 }}>{error}</div>}

            <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label style={{ display:"block", color:T.primary, fontSize:12, fontWeight:500, marginBottom:6 }}>Email Address</label>
                <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address.com"
                  style={{ width:"100%", boxSizing:"border-box", background:T.inputBg, border:`1px solid ${T.inputBorder}`, borderRadius:10, padding:"10px 14px", fontSize:13, color:T.primary, outline:"none", transition:"border-color 0.15s" }}
                  onFocus={e=>(e.target.style.borderColor=T.inputFocus)} onBlur={e=>(e.target.style.borderColor=T.inputBorder)}/>
              </div>

              <div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                  <label style={{ color:T.primary, fontSize:12, fontWeight:500 }}>Password</label>
                  <button type="button" onClick={()=>setShowPw(v=>!v)} style={{ background:"none", border:"none", cursor:"pointer", color:T.muted, fontSize:12 }}>
                    {showPw?"Hide Password":"Show Password"}
                  </button>
                </div>
                <div style={{ position:"relative" }}>
                  <input type={showPw?"text":"password"} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password"
                    style={{ width:"100%", boxSizing:"border-box", background:T.inputBg, border:`1px solid ${T.inputBorder}`, borderRadius:10, padding:"10px 40px 10px 14px", fontSize:13, color:T.primary, outline:"none", transition:"border-color 0.15s" }}
                    onFocus={e=>(e.target.style.borderColor=T.inputFocus)} onBlur={e=>(e.target.style.borderColor=T.inputBorder)}/>
                  <button type="button" onClick={()=>setShowPw(v=>!v)} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:T.muted, padding:0 }}>
                    {showPw
                      ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading}
                style={{ width:"100%", padding:"11px 0", background:T.btnBg, color:T.btnColor, border:"none", borderRadius:10, fontSize:14, fontWeight:600, cursor:loading?"not-allowed":"pointer", transition:"background 0.15s", marginTop:4 }}>
                {loading?"Signing in…":"Sign in"}
              </button>
            </form>

            <div style={{ display:"flex", alignItems:"center", gap:12, margin:"20px 0" }}>
              <div style={{ flex:1, height:1, background:T.divider }}/><span style={{ color:T.muted, fontSize:12 }}>or</span><div style={{ flex:1, height:1, background:T.divider }}/>
            </div>

            {GOOGLE_CLIENT_ID ? (
              <div id="google-btn" style={{ width:"100%", display:"flex", justifyContent:"center", minHeight:44, visibility:googleReady?"visible":"hidden" }}/>
            ) : (
              <button type="button" onClick={()=>window.location.href="http://localhost:8081/oauth2/authorization/google"}
                style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:10, padding:"10px 0", borderRadius:10, background:T.googleBg, border:`1px solid ${T.googleBorder}`, fontSize:13, fontWeight:500, color:T.googleColor, cursor:"pointer", transition:"background 0.15s" }}
                onMouseEnter={e=>(e.currentTarget.style.background=T.googleHover)} onMouseLeave={e=>(e.currentTarget.style.background=T.googleBg)}>
                <GoogleIcon/> Continue with Google
              </button>
            )}

            <p style={{ textAlign:"center", color:T.muted, fontSize:13, marginTop:20 }}>
              Don&apos;t have an account?{" "}
              <Link href="/register" style={{ color:T.linkColor, fontWeight:600, textDecoration:"none" }}>Sign Up</Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm/></Suspense>;
}