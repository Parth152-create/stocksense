"use client";

import { useState, useEffect } from "react";
import { useMarket } from "@/hooks/useMarket";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Plus, Link2, Trash2, ArrowUpRight, ArrowDownLeft, RefreshCw } from "lucide-react";
import { fetchWithAuth } from "@/lib/auth";

// ─── Types ───────────────────────────────────────────────────────────────────

interface WalletBalance {
  balance: number;
  currency: string;
  lastUpdated: string;
}

interface Transaction {
  id: string;
  type: "deposit" | "withdrawal";
  amount: number;
  description: string;
  status: "completed" | "pending" | "failed";
  createdAt: string;
}

interface BankAccount {
  id: string; name: string; bank: string; balance: number;
  color: string; bg: string; letter: string; accountNo: string;
}

// ─── Static mock accounts (no DB table yet) ───────────────────────────────────

const MOCK_ACCOUNTS: BankAccount[] = [
  { id: "1", name: "Primary Checking",  bank: "Chase",       balance: 1133, color: "#8FFFD6", bg: "#8FFFD618", letter: "C", accountNo: "****4821" },
  { id: "2", name: "Savings",           bank: "Wells Fargo", balance: 1797, color: "#3b82f6", bg: "#3b82f618", letter: "W", accountNo: "****2291" },
  { id: "3", name: "Business Account",  bank: "Citi",        balance: 350,  color: "#8b5cf6", bg: "#8b5cf618", letter: "B", accountNo: "****9034" },
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
  page:    "var(--color-page)",
  card:    "var(--color-card)",
  line:    "var(--color-line)",
  hover:   "var(--color-surface-hover)",
  primary: "var(--color-primary)",
  muted:   "var(--color-muted)",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function AccountCard({ acc, currency, onUnlink }: { acc: BankAccount; currency: string; onUnlink: (id: string) => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ background: C.card, border: `1px solid ${hovered ? acc.color + "44" : C.line}`, borderRadius: 14, padding: "18px 20px", transition: "all 0.2s", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, right: 0, width: 80, height: 80, background: `radial-gradient(circle, ${acc.color}11 0%, transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: acc.bg, border: `1px solid ${acc.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: acc.color, flexShrink: 0 }}>
            {acc.letter || acc.name.charAt(0)}
          </div>
          <div>
            <p style={{ color: C.primary, fontWeight: 600, fontSize: 13, margin: 0 }}>{acc.name}</p>
            <p style={{ color: C.muted, fontSize: 11, margin: "2px 0 0" }}>{acc.bank}</p>
          </div>
        </div>
        <button onClick={() => onUnlink(acc.id)} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Trash2 size={12} />
        </button>
      </div>
      <p style={{ color: C.muted, fontSize: 11, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: 0.5 }}>Balance</p>
      <p style={{ color: C.primary, fontWeight: 800, fontSize: 22, margin: 0, letterSpacing: -0.5 }}>
        {currency}{acc.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
      </p>
      <p style={{ color: C.muted, fontSize: 10, margin: "6px 0 0", opacity: 0.5 }}>{acc.accountNo}</p>
    </div>
  );
}

function LinkNewCard({ onLink }: { onLink: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onLink}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ background: hovered ? C.hover : "transparent", border: `1px dashed ${hovered ? "#8FFFD644" : C.line}`, borderRadius: 14, padding: "18px 20px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, minHeight: 130, transition: "all 0.2s", width: "100%" }}>
      <div style={{ width: 36, height: 36, borderRadius: "50%", background: hovered ? "#8FFFD618" : C.hover, border: `1px solid ${hovered ? "#8FFFD644" : C.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Plus size={16} color={hovered ? "#8FFFD6" : "var(--color-muted)"} />
      </div>
      <span style={{ color: hovered ? "#8FFFD6" : C.muted, fontSize: 13, fontWeight: 500 }}>Link New Account</span>
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

// ─── Transfer Modal ───────────────────────────────────────────────────────────

function TransferModal({ type, onClose, onSuccess, currency }: {
  type: "deposit" | "withdrawal"; onClose: () => void;
  onSuccess: (newBalance: number) => void; currency: string;
}) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handle = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError("Enter a valid amount"); return; }
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/wallet/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onSuccess(data.newBalance);
        onClose();
      } else {
        setError(data.error || "Transaction failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const isDeposit = type === "deposit";
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: "28px 32px", width: 360 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: isDeposit ? "#22c55e18" : "#ef444418", border: `1px solid ${isDeposit ? "#22c55e33" : "#ef444433"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {isDeposit ? <ArrowDownLeft size={16} color="#22c55e" /> : <ArrowUpRight size={16} color="#ef4444" />}
          </div>
          <h3 style={{ color: C.primary, fontWeight: 700, fontSize: 15, margin: 0, textTransform: "capitalize" }}>{type}</h3>
        </div>
        <label style={{ color: C.muted, fontSize: 12, display: "block", marginBottom: 6 }}>Amount ({currency})</label>
        <input
          type="number" value={amount} onChange={e => { setAmount(e.target.value); setError(""); }}
          placeholder="0.00" autoFocus
          style={{ width: "100%", background: C.page, border: `1px solid ${error ? "#ef4444" : C.line}`, borderRadius: 8, color: C.primary, fontSize: 18, fontWeight: 700, padding: "12px 14px", outline: "none", boxSizing: "border-box" }} />
        {error && <p style={{ color: "#ef4444", fontSize: 12, margin: "6px 0 0" }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Cancel</button>
          <button onClick={handle} disabled={loading}
            style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: isDeposit ? "#22c55e" : "#ef4444", color: "#fff", cursor: loading ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 13, opacity: loading ? 0.7 : 1 }}>
            {loading ? "Processing…" : isDeposit ? "Deposit" : "Withdraw"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WalletPage() {
  const { market } = useMarket();
  const currency = market.currency || "$";

  const [balance,      setBalance]      = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts,     setAccounts]     = useState<BankAccount[]>(MOCK_ACCOUNTS);
  const [loadingBal,   setLoadingBal]   = useState(true);
  const [showLinkModal,setShowLinkModal] = useState(false);
  const [transferType, setTransferType] = useState<"deposit" | "withdrawal" | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "deposit" | "withdrawal">("all");

  // ── Load balance + transactions ──────────────────────────────────────────
  const loadWallet = async () => {
    setLoadingBal(true);
    try {
      const [balRes, txRes] = await Promise.all([
        fetchWithAuth("/api/wallet/balance"),
        fetchWithAuth("/api/wallet/transactions"),
      ]);
      if (balRes.ok) {
        const b: WalletBalance = await balRes.json();
        setBalance(b.balance);
      }
      if (txRes.ok) {
        const txs: Transaction[] = await txRes.json();
        setTransactions(txs);
      }
    } catch { /* non-fatal */ }
    finally { setLoadingBal(false); }
  };

  useEffect(() => { loadWallet(); }, []);

  const handleUnlink = (id: string) => setAccounts(prev => prev.filter(a => a.id !== id));

  const filteredTx = transactions.filter(t =>
    activeFilter === "all" || t.type === activeFilter
  );

  const totalLinked = accounts.reduce((s, a) => s + a.balance, 0);
  const walletBalance = balance ?? 0;

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    } catch { return iso; }
  };

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1100, margin: "0 auto", fontFamily: "'Geist','Inter',sans-serif", background: C.page, minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ color: C.primary, fontWeight: 700, fontSize: 20, margin: 0, letterSpacing: -0.3 }}>Wallet &amp; Funding</h1>
          <p style={{ color: C.muted, fontSize: 12, margin: "4px 0 0" }}>Manage your linked accounts and fund transfers</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={loadWallet} style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <RefreshCw size={14} />
          </button>
          <button onClick={() => setShowLinkModal(true)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", background: "#8FFFD6", borderRadius: 10, border: "none", cursor: "pointer", color: "#0a0a0a", fontWeight: 700, fontSize: 13 }}>
            <Plus size={14} /> Link Account
          </button>
        </div>
      </div>

      {/* Balance banner */}
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: "22px 28px", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 200, background: "radial-gradient(ellipse at right, #8FFFD608 0%, transparent 70%)", pointerEvents: "none" }} />
        <div>
          <p style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 6px" }}>Wallet Balance</p>
          {loadingBal ? (
            <div style={{ width: 160, height: 40, background: C.hover, borderRadius: 8, animation: "pulse 1.5s ease infinite" }} />
          ) : (
            <p style={{ color: C.primary, fontWeight: 800, fontSize: 36, margin: 0, letterSpacing: -1 }}>
              {currency}{walletBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          )}
          <p style={{ color: "#22c55e", fontSize: 12, margin: "6px 0 0", fontWeight: 500 }}>
            Linked accounts: {currency}{totalLinked.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setTransferType("deposit")} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", background: "#22c55e18", borderRadius: 10, border: "1px solid #22c55e33", cursor: "pointer", color: "#22c55e", fontWeight: 600, fontSize: 13 }}>
            <ArrowDownLeft size={14} /> Deposit
          </button>
          <button onClick={() => setTransferType("withdrawal")} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", background: C.hover, borderRadius: 10, border: `1px solid ${C.line}`, cursor: "pointer", color: C.muted, fontWeight: 600, fontSize: 13 }}>
            <ArrowUpRight size={14} /> Withdraw
          </button>
        </div>
      </div>

      {/* Linked accounts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 24 }}>
        {accounts.map(acc => <AccountCard key={acc.id} acc={acc} currency={currency} onUnlink={handleUnlink} />)}
        <LinkNewCard onLink={() => setShowLinkModal(true)} />
      </div>

      {/* Chart + Transactions */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 380px", gap: 20 }}>

        {/* Funding History Chart — height={220} NOT height="100%" */}
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: "22px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
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
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={FUNDING_HISTORY} barGap={4} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fill: "var(--color-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--color-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-surface-hover)" }} />
              <Bar dataKey="deposit"    name="Deposit"    radius={[4, 4, 0, 0]} maxBarSize={18}>
                {FUNDING_HISTORY.map((_, i) => <Cell key={i} fill={["#8FFFD6", "#6366f1", "#f59e0b"][i % 3]} />)}
              </Bar>
              <Bar dataKey="withdrawal" name="Withdrawal" radius={[4, 4, 0, 0]} maxBarSize={18}>
                {FUNDING_HISTORY.map((_, i) => <Cell key={i} fill={["#8FFFD655", "#6366f155", "#f59e0b55"][i % 3]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Transactions */}
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: "22px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <p style={{ color: C.primary, fontWeight: 600, fontSize: 14, margin: 0 }}>Recent Transfers</p>
            <div style={{ display: "flex", gap: 4 }}>
              {(["all", "deposit", "withdrawal"] as const).map(f => (
                <button key={f} onClick={() => setActiveFilter(f)} style={{ padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 10, fontWeight: 600, textTransform: "capitalize", background: activeFilter === f ? "#8FFFD618" : "transparent", color: activeFilter === f ? "#8FFFD6" : C.muted }}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {loadingBal ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[1, 2, 3].map(i => <div key={i} style={{ height: 56, borderRadius: 10, background: C.hover, animation: "pulse 1.5s ease infinite" }} />)}
            </div>
          ) : filteredTx.length === 0 ? (
            <div style={{ padding: "32px 0", textAlign: "center" }}>
              <p style={{ color: C.muted, fontSize: 13 }}>No transactions yet.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {filteredTx.map(tx => (
                <div key={tx.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 10, background: C.hover, border: `1px solid ${C.line}` }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: tx.type === "deposit" ? "#22c55e18" : "#ef444418", border: `1px solid ${tx.type === "deposit" ? "#22c55e33" : "#ef444433"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {tx.type === "deposit"
                      ? <ArrowDownLeft size={13} color="#22c55e" />
                      : <ArrowUpRight size={13} color="#ef4444" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: C.primary, fontSize: 12, fontWeight: 600, margin: 0, textTransform: "capitalize" }}>{tx.type}</p>
                    <p style={{ color: C.muted, fontSize: 10, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {tx.description} · {formatDate(tx.createdAt)}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
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

      {/* Link Account Modal */}
      {showLinkModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowLinkModal(false)}>
          <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: "28px 32px", width: 420 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#8FFFD618", border: "1px solid #8FFFD633", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Link2 size={16} color="#8FFFD6" />
              </div>
              <h3 style={{ color: C.primary, fontWeight: 700, fontSize: 16, margin: 0 }}>Link New Account</h3>
            </div>
            {[
              { label: "Bank Name",       placeholder: "e.g. Chase, Wells Fargo" },
              { label: "Account Number",  placeholder: "Enter account number" },
              { label: "Routing Number",  placeholder: "Enter routing number" },
            ].map(({ label, placeholder }) => (
              <div key={label} style={{ marginBottom: 14 }}>
                <label style={{ color: C.muted, fontSize: 12, display: "block", marginBottom: 6 }}>{label}</label>
                <input placeholder={placeholder} style={{ width: "100%", background: C.page, border: `1px solid ${C.line}`, borderRadius: 8, color: C.primary, fontSize: 13, padding: "10px 14px", outline: "none", boxSizing: "border-box" }} />
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowLinkModal(false)} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Cancel</button>
              <button onClick={() => setShowLinkModal(false)} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: "#8FFFD6", color: "#0a0a0a", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Link Account</button>
            </div>
          </div>
        </div>
      )}

      {/* Deposit / Withdraw Modal */}
      {transferType && (
        <TransferModal
          type={transferType}
          currency={currency}
          onClose={() => setTransferType(null)}
          onSuccess={newBalance => setBalance(newBalance)} />
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg);}} @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.5;}}`}</style>
    </div>
  );
}