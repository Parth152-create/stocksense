"use client";

import { useState, useEffect } from "react";
import { useMarket } from "@/hooks/useMarket";
import { useSearchParams } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Plus, Link2, Trash2, ArrowUpRight, ArrowDownLeft, RefreshCw, CreditCard, Smartphone } from "lucide-react";
import { fetchWithAuth } from "@/lib/auth";
import { useToast } from "@/components/ToastContext";

interface WalletBalance { balance: number; currency: string; lastUpdated: string; }
interface Transaction {
  id: string; type: "deposit" | "withdrawal"; amount: number;
  description: string; status: "completed" | "pending" | "failed"; createdAt: string;
}
interface BankAccount {
  id: string; name: string; bank: string; balance: number;
  color: string; bg: string; letter: string; accountNo: string;
}

const MOCK_ACCOUNTS: BankAccount[] = [
  { id: "1", name: "Primary Checking", bank: "Chase",       balance: 1133, color: "#8FFFD6", bg: "#8FFFD618", letter: "C", accountNo: "****4821" },
  { id: "2", name: "Savings",          bank: "Wells Fargo", balance: 1797, color: "#3b82f6", bg: "#3b82f618", letter: "W", accountNo: "****2291" },
  { id: "3", name: "Business Account", bank: "Citi",        balance: 350,  color: "#8b5cf6", bg: "#8b5cf618", letter: "B", accountNo: "****9034" },
];

const FUNDING_HISTORY = [
  { month: "Oct", deposit: 380, withdrawal: 220 },
  { month: "Nov", deposit: 490, withdrawal: 150 },
  { month: "Dec", deposit: 340, withdrawal: 280 },
  { month: "Jan", deposit: 460, withdrawal: 190 },
  { month: "Feb", deposit: 500, withdrawal: 240 },
  { month: "Mar", deposit: 420, withdrawal: 160 },
  { month: "Apr", deposit: 480, withdrawal: 200 },
  { month: "May", deposit: 560, withdrawal: 180 },
];

const C = {
  page: "var(--color-page)", card: "var(--color-card)",
  line: "var(--color-line)", hover: "var(--color-surface-hover)",
  primary: "var(--color-primary)", muted: "var(--color-muted)",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function AccountCard({ acc, currency, onUnlink }: { acc: BankAccount; currency: string; onUnlink: (id: string) => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ background: C.card, border: `1px solid ${hovered ? acc.color + "44" : C.line}`, borderRadius: 14, padding: "16px 18px", transition: "all 0.2s", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, right: 0, width: 70, height: 70, background: `radial-gradient(circle, ${acc.color}11 0%, transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: acc.bg, border: `1px solid ${acc.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: acc.color }}>
            {acc.letter}
          </div>
          <div>
            <p style={{ color: C.primary, fontWeight: 600, fontSize: 13, margin: 0 }}>{acc.name}</p>
            <p style={{ color: C.muted, fontSize: 11, margin: "2px 0 0" }}>{acc.bank}</p>
          </div>
        </div>
        <button onClick={() => onUnlink(acc.id)} style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Trash2 size={11} />
        </button>
      </div>
      <p style={{ color: C.muted, fontSize: 10, margin: "0 0 3px", textTransform: "uppercase", letterSpacing: 0.5 }}>Balance</p>
      <p style={{ color: C.primary, fontWeight: 800, fontSize: 20, margin: 0, letterSpacing: -0.5 }}>
        {currency}{acc.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
      </p>
      <p style={{ color: C.muted, fontSize: 10, margin: "4px 0 0", opacity: 0.5 }}>{acc.accountNo}</p>
    </div>
  );
}

function LinkNewCard({ onLink }: { onLink: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button onClick={onLink} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ background: hovered ? C.hover : "transparent", border: `1px dashed ${hovered ? "#8FFFD644" : C.line}`, borderRadius: 14, padding: "16px 18px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 110, transition: "all 0.2s", width: "100%" }}>
      <div style={{ width: 34, height: 34, borderRadius: "50%", background: hovered ? "#8FFFD618" : C.hover, border: `1px solid ${hovered ? "#8FFFD644" : C.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Plus size={15} color={hovered ? "#8FFFD6" : "var(--color-muted)"} />
      </div>
      <span style={{ color: hovered ? "#8FFFD6" : C.muted, fontSize: 12, fontWeight: 500 }}>Link New Account</span>
    </button>
  );
}

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 14px", fontSize: 12 }}>
      <p style={{ color: C.muted, marginBottom: 6 }}>{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: p.fill }} />
          <span style={{ color: C.muted }}>{p.name}:</span>
          <span style={{ color: C.primary, fontWeight: 600 }}>${p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ── Transfer Modal ────────────────────────────────────────────────────────────
function TransferModal({ type, onClose, onSuccess, currency }: {
  type: "deposit" | "withdrawal"; onClose: () => void;
  onSuccess: (newBalance: number) => void; currency: string;
}) {
  const [amount, setAmount]     = useState("");
  const [loading, setLoading]   = useState(false);
  const [fieldError, setFieldError] = useState("");
  const isDeposit = type === "deposit";

  const handle = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setFieldError("Enter a valid amount"); return; }
    setLoading(true);
    try {
      const res  = await fetchWithAuth(`/api/wallet/${type}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: amt }) });
      const data = await res.json();
      if (res.ok && data.success) { onSuccess(data.newBalance); onClose(); }
      else setFieldError(data.error || "Transaction failed");
    } catch { setFieldError("Network error"); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: "26px 28px", width: "100%", maxWidth: 360 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: isDeposit ? "#22c55e18" : "#ef444418", border: `1px solid ${isDeposit ? "#22c55e33" : "#ef444433"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {isDeposit ? <ArrowDownLeft size={15} color="#22c55e" /> : <ArrowUpRight size={15} color="#ef4444" />}
          </div>
          <h3 style={{ color: C.primary, fontWeight: 700, fontSize: 15, margin: 0, textTransform: "capitalize" }}>{type}</h3>
        </div>
        <label style={{ color: C.muted, fontSize: 12, display: "block", marginBottom: 6 }}>Amount ({currency})</label>
        <input type="number" value={amount} onChange={e => { setAmount(e.target.value); setFieldError(""); }}
          placeholder="0.00" autoFocus
          style={{ width: "100%", background: C.page, border: `1px solid ${fieldError ? "#ef4444" : C.line}`, borderRadius: 8, color: C.primary, fontSize: 18, fontWeight: 700, padding: "11px 14px", outline: "none", boxSizing: "border-box" }} />
        {fieldError && <p style={{ color: "#ef4444", fontSize: 12, margin: "6px 0 0" }}>{fieldError}</p>}
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Cancel</button>
          <button onClick={handle} disabled={loading} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: isDeposit ? "#22c55e" : "#ef4444", color: "#fff", cursor: loading ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 13, opacity: loading ? 0.7 : 1 }}>
            {loading ? "Processing…" : isDeposit ? "Deposit" : "Withdraw"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Top-up Modal ──────────────────────────────────────────────────────────────
function TopUpModal({ onClose, currency, isIndia, onSuccess }: {
  onClose: () => void; currency: string; isIndia: boolean; onSuccess: (newBalance: number) => void;
}) {
  const [amount,  setAmount]  = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const presets = isIndia ? [500, 1000, 2000, 5000] : [10, 25, 50, 100];

  const handleStripe = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError("Enter a valid amount"); return; }
    setLoading(true); setError("");
    try {
      const res  = await fetchWithAuth("/api/payments/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: amt, currency: "usd" }) });
      const data = await res.json();
      if (res.ok && data.url) window.location.href = data.url;
      else setError(data.error || "Failed to create checkout session");
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  };

  const handleRazorpay = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError("Enter a valid amount"); return; }
    setLoading(true); setError("");
    try {
      const res  = await fetchWithAuth("/api/payments/razorpay/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: amt }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to create order"); setLoading(false); return; }
      const options = {
        key: data.keyId, amount: data.amount, currency: data.currency,
        name: "StockSense", description: "Wallet Top-up", order_id: data.orderId,
        handler: async (response: any) => {
          const verifyRes  = await fetchWithAuth("/api/payments/razorpay/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: response.razorpay_order_id, paymentId: response.razorpay_payment_id, signature: response.razorpay_signature, amount: amt }) });
          const verifyData = await verifyRes.json();
          if (verifyRes.ok && verifyData.success) { onSuccess(verifyData.newBalance); onClose(); }
          else setError(verifyData.error || "Payment verification failed");
        },
        prefill: { name: "StockSense User" }, theme: { color: "#8FFFD6" },
      };
      if (!(window as any).Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = () => resolve(); script.onerror = () => reject(new Error("Failed to load Razorpay"));
          document.body.appendChild(script);
        });
      }
      new (window as any).Razorpay(options).open();
    } catch (e: any) { setError(e.message || "Payment failed"); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: "26px 28px", width: "100%", maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "#8FFFD618", border: "1px solid #8FFFD633", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {isIndia ? <Smartphone size={15} color="#8FFFD6" /> : <CreditCard size={15} color="#8FFFD6" />}
          </div>
          <div>
            <h3 style={{ color: C.primary, fontWeight: 700, fontSize: 15, margin: 0 }}>Add Funds</h3>
            <p style={{ color: C.muted, fontSize: 11, margin: 0 }}>{isIndia ? "Razorpay — UPI, cards, netbanking" : "Stripe — cards, Apple Pay, Google Pay"}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {presets.map(p => (
            <button key={p} onClick={() => setAmount(String(p))}
              style={{ flex: 1, minWidth: 60, padding: "7px 0", borderRadius: 8, border: `1px solid ${amount === String(p) ? "#8FFFD6" : C.line}`, background: amount === String(p) ? "#8FFFD618" : "transparent", color: amount === String(p) ? "#8FFFD6" : C.muted, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              {currency}{p}
            </button>
          ))}
        </div>
        <label style={{ color: C.muted, fontSize: 12, display: "block", marginBottom: 6 }}>Custom Amount ({currency})</label>
        <input type="number" value={amount} onChange={e => { setAmount(e.target.value); setError(""); }} placeholder="0.00"
          style={{ width: "100%", background: C.page, border: `1px solid ${error ? "#ef4444" : C.line}`, borderRadius: 8, color: C.primary, fontSize: 20, fontWeight: 700, padding: "11px 14px", outline: "none", boxSizing: "border-box", marginBottom: 6 }} />
        {error && <p style={{ color: "#ef4444", fontSize: 12, margin: "0 0 10px" }}>{error}</p>}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16, padding: "8px 12px", background: C.hover, borderRadius: 8, border: `1px solid ${C.line}` }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
          <span style={{ color: C.muted, fontSize: 11 }}>{isIndia ? "🇮🇳 Razorpay — UPI, Cards, Net Banking" : "🌍 Stripe — Visa, Mastercard, Apple Pay"}</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Cancel</button>
          <button onClick={isIndia ? handleRazorpay : handleStripe} disabled={loading || !amount}
            style={{ flex: 2, padding: "10px 0", borderRadius: 10, border: "none", background: loading || !amount ? C.hover : "#8FFFD6", color: loading || !amount ? C.muted : "#0a0a0a", cursor: loading || !amount ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 13 }}>
            {loading ? "Processing…" : `Pay ${currency}${amount || "0"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function WalletPage() {
  const { market }   = useMarket();
  const { toast }    = useToast();
  const searchParams = useSearchParams();
  const currency     = market.currency || "$";
  const isIndia      = market.id === "IN";

  const [balance,       setBalance]       = useState<number | null>(null);
  const [transactions,  setTransactions]  = useState<Transaction[]>([]);
  const [accounts,      setAccounts]      = useState(MOCK_ACCOUNTS);
  const [loadingBal,    setLoadingBal]    = useState(true);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [transferType,  setTransferType]  = useState<"deposit" | "withdrawal" | null>(null);
  const [showTopUp,     setShowTopUp]     = useState(false);
  const [activeFilter,  setActiveFilter]  = useState<"all" | "deposit" | "withdrawal">("all");

  const loadWallet = async () => {
    setLoadingBal(true);
    try {
      const [balRes, txRes] = await Promise.all([fetchWithAuth("/api/wallet/balance"), fetchWithAuth("/api/wallet/transactions")]);
      if (balRes.ok) { const b: WalletBalance = await balRes.json(); setBalance(b.balance); }
      if (txRes.ok)  setTransactions(await txRes.json());
    } catch { }
    finally { setLoadingBal(false); }
  };

  useEffect(() => { loadWallet(); }, []);

  useEffect(() => {
    const payment = searchParams.get("payment");
    const sessionId = searchParams.get("session_id");
    if (payment === "success" && sessionId) {
      fetchWithAuth(`/api/payments/stripe/verify?session_id=${sessionId}`)
        .then(r => r.json())
        .then(data => { if (data.paid) { setBalance(data.newBalance); loadWallet(); toast(`Payment successful! ${currency}${data.amount} added`, "success"); } })
        .catch(() => {});
    } else if (payment === "cancelled") {
      toast("Payment cancelled", "info");
    }
  }, []);

  const handleUnlink = (id: string) => {
    const acc = accounts.find(a => a.id === id);
    setAccounts(prev => prev.filter(a => a.id !== id));
    if (acc) toast(`${acc.name} unlinked`, "info");
  };

  const handleTransferSuccess = (newBalance: number, type: "deposit" | "withdrawal") => {
    setBalance(newBalance); loadWallet();
    toast(`${type === "deposit" ? "Deposit" : "Withdrawal"} successful — balance ${currency}${newBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, "success");
  };

  const handleTopUpSuccess = (newBalance: number) => {
    setBalance(newBalance); loadWallet();
    toast(`Wallet topped up! Balance: ${currency}${newBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, "success");
  };

  const filteredTx   = transactions.filter(t => activeFilter === "all" || t.type === activeFilter);
  const totalLinked  = accounts.reduce((s, a) => s + a.balance, 0);
  const walletBalance = balance ?? 0;

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
    catch { return iso; }
  };

  return (
    <div style={{ padding: "16px", maxWidth: 1100, margin: "0 auto", fontFamily: "'Geist','Inter',sans-serif", background: C.page, minHeight: "100vh", boxSizing: "border-box" }}>
      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.5;} }

        /* Balance banner buttons: wrap on mobile */
        .wallet-banner { flex-wrap: nowrap; gap: 10px; }
        @media (max-width: 640px) { .wallet-banner { flex-direction: column; align-items: flex-start !important; } .wallet-btns { flex-wrap: wrap; } }

        /* Accounts grid: 3 → 2 → 1 */
        .wallet-accounts { grid-template-columns: repeat(3, 1fr); }
        @media (max-width: 900px) { .wallet-accounts { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 480px) { .wallet-accounts { grid-template-columns: 1fr; } }

        /* Chart + Transactions: side-by-side → stacked */
        .wallet-bottom { grid-template-columns: minmax(0,1fr) 360px; }
        @media (max-width: 860px) { .wallet-bottom { grid-template-columns: 1fr; } }

        /* Header: wrap */
        .wallet-header { flex-wrap: wrap; gap: 10px; }
      `}</style>

      {/* Header */}
      <div className="wallet-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ color: C.primary, fontWeight: 700, fontSize: 20, margin: 0, letterSpacing: -0.3 }}>Wallet &amp; Funding</h1>
          <p style={{ color: C.muted, fontSize: 12, margin: "4px 0 0" }}>Manage your linked accounts and fund transfers</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={loadWallet} style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <RefreshCw size={14} />
          </button>
          <button onClick={() => setShowLinkModal(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", background: "#8FFFD6", borderRadius: 10, border: "none", cursor: "pointer", color: "#0a0a0a", fontWeight: 700, fontSize: 13 }}>
            <Plus size={13} /> Link Account
          </button>
        </div>
      </div>

      {/* Balance banner */}
      <div className="wallet-banner" style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: "20px 22px", marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 180, background: "radial-gradient(ellipse at right, #8FFFD608 0%, transparent 70%)", pointerEvents: "none" }} />
        <div>
          <p style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 6px" }}>Wallet Balance</p>
          {loadingBal
            ? <div style={{ width: 150, height: 36, background: C.hover, borderRadius: 8, animation: "pulse 1.5s ease infinite" }} />
            : <p style={{ color: C.primary, fontWeight: 800, fontSize: 32, margin: 0, letterSpacing: -1 }}>{currency}{walletBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
          }
          <p style={{ color: "#22c55e", fontSize: 12, margin: "4px 0 0", fontWeight: 500 }}>
            Linked: {currency}{totalLinked.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="wallet-btns" style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowTopUp(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", background: "#8FFFD6", borderRadius: 10, border: "none", cursor: "pointer", color: "#0a0a0a", fontWeight: 700, fontSize: 13 }}>
            {isIndia ? <Smartphone size={13} /> : <CreditCard size={13} />}
            {isIndia ? "Razorpay" : "Stripe"}
          </button>
          <button onClick={() => setTransferType("deposit")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", background: "#22c55e18", borderRadius: 10, border: "1px solid #22c55e33", cursor: "pointer", color: "#22c55e", fontWeight: 600, fontSize: 13 }}>
            <ArrowDownLeft size={13} /> Deposit
          </button>
          <button onClick={() => setTransferType("withdrawal")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", background: C.hover, borderRadius: 10, border: `1px solid ${C.line}`, cursor: "pointer", color: C.muted, fontWeight: 600, fontSize: 13 }}>
            <ArrowUpRight size={13} /> Withdraw
          </button>
        </div>
      </div>

      {/* Linked accounts */}
      <div className="wallet-accounts" style={{ display: "grid", gap: 12, marginBottom: 18 }}>
        {accounts.map(acc => <AccountCard key={acc.id} acc={acc} currency={currency} onUnlink={handleUnlink} />)}
        <LinkNewCard onLink={() => setShowLinkModal(true)} />
      </div>

      {/* Chart + Transactions */}
      <div className="wallet-bottom" style={{ display: "grid", gap: 16 }}>

        {/* Funding History */}
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <p style={{ color: C.primary, fontWeight: 600, fontSize: 14, margin: 0 }}>Funding History</p>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {[{ color: "#8FFFD6", label: "Deposit" }, { color: "#6366f1", label: "Withdrawal" }].map(l => (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
                  <span style={{ color: C.muted, fontSize: 11 }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={FUNDING_HISTORY} barGap={4} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fill: "var(--color-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--color-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-surface-hover)" }} />
              <Bar dataKey="deposit"    name="Deposit"    radius={[4,4,0,0]} maxBarSize={16}>
                {FUNDING_HISTORY.map((_, i) => <Cell key={i} fill={["#8FFFD6","#6366f1","#f59e0b"][i%3]} />)}
              </Bar>
              <Bar dataKey="withdrawal" name="Withdrawal" radius={[4,4,0,0]} maxBarSize={16}>
                {FUNDING_HISTORY.map((_, i) => <Cell key={i} fill={["#8FFFD655","#6366f155","#f59e0b55"][i%3]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Transactions */}
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <p style={{ color: C.primary, fontWeight: 600, fontSize: 14, margin: 0 }}>Recent Transfers</p>
            <div style={{ display: "flex", gap: 3 }}>
              {(["all", "deposit", "withdrawal"] as const).map(f => (
                <button key={f} onClick={() => setActiveFilter(f)}
                  style={{ padding: "4px 9px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 10, fontWeight: 600, textTransform: "capitalize", background: activeFilter === f ? "#8FFFD618" : "transparent", color: activeFilter === f ? "#8FFFD6" : C.muted }}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          {loadingBal ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[1,2,3].map(i => <div key={i} style={{ height: 54, borderRadius: 10, background: C.hover, animation: "pulse 1.5s ease infinite" }} />)}
            </div>
          ) : filteredTx.length === 0 ? (
            <div style={{ padding: "28px 0", textAlign: "center" }}>
              <p style={{ color: C.muted, fontSize: 13 }}>No transactions yet.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {filteredTx.map(tx => (
                <div key={tx.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: C.hover, border: `1px solid ${C.line}` }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, background: tx.type === "deposit" ? "#22c55e18" : "#ef444418", border: `1px solid ${tx.type === "deposit" ? "#22c55e33" : "#ef444433"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {tx.type === "deposit" ? <ArrowDownLeft size={12} color="#22c55e" /> : <ArrowUpRight size={12} color="#ef4444" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: C.primary, fontSize: 12, fontWeight: 600, margin: 0, textTransform: "capitalize" }}>{tx.type}</p>
                    <p style={{ color: C.muted, fontSize: 10, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {tx.description} · {formatDate(tx.createdAt)}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ color: tx.type === "deposit" ? "#22c55e" : "#ef4444", fontWeight: 700, fontSize: 13, margin: 0 }}>
                      {tx.type === "deposit" ? "+" : "-"}{currency}{tx.amount.toLocaleString()}
                    </p>
                    <p style={{ fontSize: 9, margin: "2px 0 0", fontWeight: 600, textTransform: "uppercase", color: tx.status === "completed" ? "#22c55e" : tx.status === "pending" ? "#f59e0b" : "#ef4444" }}>
                      {tx.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Link Modal */}
      {showLinkModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setShowLinkModal(false)}>
          <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: "26px 28px", width: "100%", maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "#8FFFD618", border: "1px solid #8FFFD633", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Link2 size={15} color="#8FFFD6" />
              </div>
              <h3 style={{ color: C.primary, fontWeight: 700, fontSize: 15, margin: 0 }}>Link New Account</h3>
            </div>
            {[{ label: "Bank Name", placeholder: "e.g. Chase, SBI" }, { label: "Account Number", placeholder: "Enter account number" }, { label: "Routing Number", placeholder: "Enter routing/IFSC number" }].map(({ label, placeholder }) => (
              <div key={label} style={{ marginBottom: 12 }}>
                <label style={{ color: C.muted, fontSize: 12, display: "block", marginBottom: 5 }}>{label}</label>
                <input placeholder={placeholder} style={{ width: "100%", background: C.page, border: `1px solid ${C.line}`, borderRadius: 8, color: C.primary, fontSize: 13, padding: "10px 14px", outline: "none", boxSizing: "border-box" }} />
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={() => setShowLinkModal(false)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Cancel</button>
              <button onClick={() => { setShowLinkModal(false); toast("Account linked successfully", "success"); }} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: "#8FFFD6", color: "#0a0a0a", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Link Account</button>
            </div>
          </div>
        </div>
      )}

      {transferType && (
        <TransferModal type={transferType} currency={currency} onClose={() => setTransferType(null)}
          onSuccess={newBalance => handleTransferSuccess(newBalance, transferType!)} />
      )}
      {showTopUp && (
        <TopUpModal currency={currency} isIndia={isIndia} onClose={() => setShowTopUp(false)} onSuccess={handleTopUpSuccess} />
      )}
    </div>
  );
}