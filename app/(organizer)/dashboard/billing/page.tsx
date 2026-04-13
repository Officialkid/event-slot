"use client"

import React, { useEffect, useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"

interface BillingStatus {
  plan: string
  billingCycle: string | null
  planEndDate: string | null
  paystackSubscriptionCode: string | null
  creditBalance: number
}

interface CreditTx {
  id: string
  amount: number
  type: string
  description: string
  createdAt: string
  balance: number
}

function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="#C8F55A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 7l3.5 3.5L12 3" />
    </svg>
  )
}

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="11" height="11" viewBox="0 0 12 12" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.18s" }}
    >
      <path d="M2 4l4 4 4-4" />
    </svg>
  )
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

function fmtRenewal(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
}

function fmtCredits(n: number) {
  return n % 1 === 0 ? String(n) : n.toFixed(2)
}

function fmtAmt(n: number) {
  const abs = fmtCredits(Math.abs(n))
  return n >= 0 ? "+" + abs : "-" + abs
}

const PLAN_DISPLAY: Record<string, string> = {
  free: "Free Plan",
  pro: "Pro Plan",
  business: "Business Plan",
}

function PlanBadge({ plan, large }: { plan: string; large?: boolean }) {
  const s: Record<string, React.CSSProperties> = {
    free: { background: "rgba(240,237,230,0.06)", border: "0.5px solid rgba(240,237,230,0.15)", color: "rgba(240,237,230,0.55)" },
    pro: { background: "rgba(200,245,90,0.1)", border: "0.5px solid rgba(200,245,90,0.3)", color: "#C8F55A" },
    business: { background: "rgba(147,112,219,0.1)", border: "0.5px solid rgba(147,112,219,0.3)", color: "#9370DB" },
  }
  return (
    <span
      style={{
        ...(s[plan] ?? s.free),
        borderRadius: 100,
        fontSize: large ? "0.8rem" : "0.7rem",
        fontWeight: 500,
        padding: large ? "0.35rem 0.875rem" : "0.3rem 0.75rem",
        display: "inline-block",
        letterSpacing: "0.04em",
        fontFamily: "var(--font-dm-sans)",
      }}
    >
      {PLAN_DISPLAY[plan] ?? "Free Plan"}
    </span>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.1rem", fontWeight: 400, color: "#F0EDE6", margin: "0 0 1rem" }}>
      {children}
    </h2>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "1.5rem" }}>
      {children}
    </div>
  )
}

const PRO_FEATURES = [
  "Up to 5 active events",
  "500 free registrations per event",
  "Team members (up to 10)",
  "Export registrations",
  "Email reminders",
]

const BUSINESS_FEATURES = [
  "Unlimited active events",
  "Unlimited registrations",
  "Advanced analytics and insights",
  "Unlimited team members",
  "Priority support",
]

function PlanCard({
  plan, billingCycle, onUpgrade, loading, currentPlan,
}: {
  plan: "pro" | "business"
  billingCycle: "monthly" | "annual"
  onUpgrade: (p: "pro" | "business") => void
  loading: boolean
  currentPlan: string
}) {
  const isCurrent = currentPlan === plan
  const isBiz = plan === "business"
  const monthlyPrice = isBiz ? 19 : 9
  const annualPrice = isBiz ? 15 : 7
  const price = billingCycle === "annual" ? annualPrice : monthlyPrice
  const features = isBiz ? BUSINESS_FEATURES : PRO_FEATURES
  const accentHex = isBiz ? "#9370DB" : "#C8F55A"
  const borderColor = isBiz ? "rgba(147,112,219,0.35)" : "rgba(200,245,90,0.3)"
  return (
    <div style={{
      background: "#141414",
      border: isCurrent ? ("0.5px solid " + borderColor) : "0.5px solid rgba(240,237,230,0.1)",
      borderRadius: 12, padding: "1.25rem",
      display: "flex", flexDirection: "column", gap: "0.875rem", flex: 1, minWidth: 0,
    }}>
      <div>
        <div style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1rem", color: "#F0EDE6", marginBottom: "0.35rem" }}>
          {isBiz ? "Business" : "Pro"}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.2rem" }}>
          <span style={{ fontSize: "1.5rem", fontWeight: 700, color: "#F0EDE6", fontFamily: "var(--font-dm-sans)" }}>${price}</span>
          <span style={{ fontSize: "0.75rem", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)" }}>/mo</span>
        </div>
        {billingCycle === "annual" && (
          <div style={{ fontSize: "0.68rem", color: "rgba(200,245,90,0.75)", fontFamily: "var(--font-dm-sans)", marginTop: 2 }}>
            Billed annually - save 20%
          </div>
        )}
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        {features.map(f => (
          <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: "0.4rem" }}>
            <span style={{ marginTop: 1, flexShrink: 0 }}><IconCheck /></span>
            <span style={{ fontSize: "0.78rem", color: "rgba(240,237,230,0.6)", fontFamily: "var(--font-dm-sans)", lineHeight: 1.45 }}>{f}</span>
          </li>
        ))}
      </ul>
      {isCurrent ? (
        <div style={{ textAlign: "center", fontSize: "0.78rem", color: accentHex + "99", fontFamily: "var(--font-dm-sans)", padding: "0.4rem" }}>
          Current plan
        </div>
      ) : (
        <button onClick={() => onUpgrade(plan)} disabled={loading} style={{
          background: loading ? "rgba(200,245,90,0.4)" : "#C8F55A", border: "none", borderRadius: 8,
          padding: "0.55rem 1rem", fontSize: "0.8rem", fontWeight: 600, color: "#0A0A0A",
          cursor: loading ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)", width: "100%",
        }}>
          {loading ? "Redirecting..." : ("Upgrade to " + (isBiz ? "Business" : "Pro"))}
        </button>
      )}
    </div>
  )
}

const PAYG_ROWS = [
  { feature: "Remove EventSlot watermark (one event)", cost: "10 points" },
  { feature: "Export CSV", cost: "15 points" },
  { feature: "Generate Word report", cost: "100 points" },
  { feature: "Analytics tracking (one event)", cost: "150 points" },
  { feature: "Custom thank you message", cost: "20 points" },
]

const CREDITS_OPTS = [
  { label: "Ksh 1,000", sub: "100 points", amount: 100 },
  { label: "Ksh 4,500", sub: "500 points · save 10%", amount: 500 },
  { label: "Ksh 8,000", sub: "1,000 points · save 20%", amount: 1000 },
] as const

export default function BillingPage() {
  const searchParams = useSearchParams()
  const isSuccess = searchParams.get("success") === "true"
  const isCreditsAdded = searchParams.get("credits") === "added"
  const planParam = searchParams.get("plan") ?? ""

  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [transactions, setTransactions] = useState<CreditTx[]>([])
  const [successVisible, setSuccessVisible] = useState(isSuccess)
  const [creditsVisible, setCreditsVisible] = useState(isCreditsAdded)
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly")
  const [upgradeLoading, setUpgradeLoading] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelError, setCancelError] = useState("")
  const [creditsLoading, setCreditsLoading] = useState<number | null>(null)
  const [pricingOpen, setPricingOpen] = useState(false)

  useEffect(() => {
    if (isSuccess) {
      const t = setTimeout(() => setSuccessVisible(false), 5000)
      return () => clearTimeout(t)
    }
  }, [isSuccess])

  useEffect(() => {
    if (isCreditsAdded) {
      const t = setTimeout(() => setCreditsVisible(false), 5000)
      return () => clearTimeout(t)
    }
  }, [isCreditsAdded])

  const fetchStatus = useCallback(async () => {
    try { const res = await fetch("/api/billing/status"); const data = await res.json(); setStatus(data) } catch { /* ignore */ }
  }, [])

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await fetch("/api/billing/transactions")
      const data = await res.json()
      if (data.transactions) setTransactions(data.transactions)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchStatus(); fetchTransactions() }, [fetchStatus, fetchTransactions])

  async function handleUpgrade(plan: "pro" | "business") {
    setUpgradeLoading(true)
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, billingCycle }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else setUpgradeLoading(false)
    } catch { setUpgradeLoading(false) }
  }

  async function handleCancel() {
    if (!window.confirm("Cancel your subscription? You will keep access until end of the current billing period.")) return
    setCancelLoading(true); setCancelError("")
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" })
      const data = await res.json()
      if (res.ok) { await fetchStatus() }
      else { setCancelError(data.error ?? "Failed to cancel. Please try again.") }
    } catch { setCancelError("Network error. Please try again.") }
    finally { setCancelLoading(false) }
  }

  async function handleBuyCredits(amount: number) {
    setCreditsLoading(amount)
    try {
      const res = await fetch("/api/billing/credits", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits: amount }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else setCreditsLoading(null)
    } catch { setCreditsLoading(null) }
  }

  const plan = status?.plan ?? "free"
  const isPaid = plan === "pro" || plan === "business"
  const creditBalance = status?.creditBalance ?? 0
  const successPlanName = PLAN_DISPLAY[planParam] ?? PLAN_DISPLAY[plan] ?? "your new plan"

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <style>{`
        @keyframes bil-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
        .bil-in { animation: bil-in 0.22s ease; }
        @keyframes bil-spin { to { transform: rotate(360deg); } }
        .bil-row:hover td { background: rgba(240,237,230,0.02); }
        .bil-ghost:hover { background: rgba(240,237,230,0.07) !important; border-color: rgba(240,237,230,0.22) !important; }
        .bil-collapsible:hover { background: rgba(240,237,230,0.04) !important; }
      `}</style>

      <div style={{ marginBottom: "1.75rem" }}>
        <h1 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.6rem", fontWeight: 400, color: "#F0EDE6", margin: "0 0 0.25rem" }}>
          Billing
        </h1>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)" }}>
          Manage your plan, credits, and billing history.
        </p>
      </div>

      {successVisible && (
        <div className="bil-in" style={{
          background: "rgba(200,245,90,0.1)", border: "0.5px solid rgba(200,245,90,0.35)", borderRadius: 10,
          padding: "0.875rem 1.25rem", marginBottom: "1.25rem",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#C8F55A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="8" r="6.5" /><path d="M5 8l2 2 4-4" />
            </svg>
            <span style={{ fontSize: "0.875rem", color: "#C8F55A", fontFamily: "var(--font-dm-sans)", fontWeight: 500 }}>
              Payment successful. Welcome to {successPlanName}.
            </span>
          </div>
          <button onClick={() => setSuccessVisible(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(200,245,90,0.5)", fontSize: "1.1rem", lineHeight: 1, padding: 0 }}>x</button>
        </div>
      )}

      {creditsVisible && (
        <div className="bil-in" style={{
          background: "rgba(200,245,90,0.1)", border: "0.5px solid rgba(200,245,90,0.35)", borderRadius: 10,
          padding: "0.875rem 1.25rem", marginBottom: "1.25rem",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#C8F55A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="8" r="6.5" /><path d="M5 8l2 2 4-4" />
            </svg>
            <span style={{ fontSize: "0.875rem", color: "#C8F55A", fontFamily: "var(--font-dm-sans)", fontWeight: 500 }}>
              Points added to your account successfully.
            </span>
          </div>
          <button onClick={() => setCreditsVisible(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(200,245,90,0.5)", fontSize: "1.1rem", lineHeight: 1, padding: 0 }}>x</button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

        <section>
          <SectionHeading>Current Plan</SectionHeading>
          <Card>
            {!status ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(200,245,90,0.2)", borderTopColor: "#C8F55A", animation: "bil-spin 0.8s linear infinite" }} />
                <span style={{ fontSize: "0.875rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)" }}>Loading...</span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.875rem", flexWrap: "wrap" }}>
                  <PlanBadge plan={plan} large />
                  <span style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", color: "#F0EDE6" }}>
                    {PLAN_DISPLAY[plan] ?? "Free Plan"}
                  </span>
                </div>
                {isPaid && (
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "rgba(240,237,230,0.5)", fontFamily: "var(--font-dm-sans)" }}>
                    {"Billed "}
                    <span style={{ color: "rgba(240,237,230,0.75)" }}>
                      {status.billingCycle === "annual" ? "annually" : "monthly"}
                    </span>
                    {status.planEndDate && (
                      <>
                        {" - Renews "}
                        <span style={{ color: "rgba(240,237,230,0.75)" }}>{fmtRenewal(status.planEndDate)}</span>
                      </>
                    )}
                  </p>
                )}
                {!isPaid && (
                  <p style={{ margin: 0, fontSize: "0.82rem", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }}>
                    No active subscription - Free forever
                  </p>
                )}
                {cancelError && <p style={{ margin: 0, fontSize: "0.8rem", color: "#FF6B6B", fontFamily: "var(--font-dm-sans)" }}>{cancelError}</p>}
                {isPaid && (
                  <button onClick={handleCancel} disabled={cancelLoading} style={{
                    alignSelf: "flex-start", background: "transparent", border: "none", padding: 0,
                    cursor: cancelLoading ? "not-allowed" : "pointer",
                    fontSize: "0.78rem", color: "rgba(255,107,107,0.6)",
                    fontFamily: "var(--font-dm-sans)", textDecoration: "underline",
                    textDecorationColor: "rgba(255,107,107,0.25)",
                  }}>
                    {cancelLoading ? "Cancelling..." : "Cancel subscription"}
                  </button>
                )}
              </div>
            )}
          </Card>
        </section>

        <section>
          <SectionHeading>Points Balance</SectionHeading>
          <Card>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <div style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.6rem", color: "#C8F55A", lineHeight: 1 }}>
                  {status ? fmtCredits(creditBalance) : "..."} points
                </div>
                <p style={{ margin: "0.4rem 0 0", fontSize: "0.8rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)" }}>
                  Points power pay-as-you-go features. 100 Ksh = 10 points.
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.625rem", flexWrap: "wrap" }}>
                {CREDITS_OPTS.map(opt => (
                  <button key={opt.amount} onClick={() => handleBuyCredits(opt.amount)}
                    disabled={creditsLoading !== null} className="bil-ghost"
                    style={{
                      background: "transparent", border: "0.5px solid rgba(240,237,230,0.14)", borderRadius: 8,
                      padding: "0.55rem 1rem", cursor: creditsLoading !== null ? "not-allowed" : "pointer",
                      fontFamily: "var(--font-dm-sans)", display: "flex", flexDirection: "column",
                      alignItems: "flex-start", gap: "0.1rem",
                      opacity: (creditsLoading !== null && creditsLoading !== opt.amount) ? 0.45 : 1,
                      transition: "opacity 0.15s",
                    }}
                  >
                    <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "#F0EDE6" }}>
                      {creditsLoading === opt.amount ? "Redirecting..." : opt.label}
                    </span>
                    <span style={{ fontSize: "0.7rem", color: "rgba(240,237,230,0.4)" }}>{opt.sub}</span>
                  </button>
                ))}
              </div>
              <div style={{ borderTop: "0.5px solid rgba(240,237,230,0.06)", paddingTop: "0.875rem" }}>
                <button onClick={() => setPricingOpen(o => !o)} className="bil-collapsible" style={{
                  display: "flex", alignItems: "center", gap: "0.45rem",
                  background: "transparent", border: "none", cursor: "pointer",
                  padding: "0.3rem 0.5rem", borderRadius: 6, margin: "-0.3rem -0.5rem",
                  color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)", fontSize: "0.8rem",
                }}>
                  <IconChevron open={pricingOpen} />
                  What do points cost?
                </button>
                {pricingOpen && (
                  <div style={{ marginTop: "0.875rem", overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem", fontFamily: "var(--font-dm-sans)" }}>
                      <thead><tr>
                        {["Feature", "Cost"].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: "0 0.5rem 0.5rem",
                            color: "rgba(240,237,230,0.3)", fontWeight: 500, fontSize: "0.68rem",
                            textTransform: "uppercase" as const, letterSpacing: "0.05em",
                            borderBottom: "0.5px solid rgba(240,237,230,0.06)", whiteSpace: "nowrap" as const,
                          }}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {PAYG_ROWS.map(row => (
                          <tr key={row.feature}>
                            <td style={{ padding: "0.5rem", color: "rgba(240,237,230,0.55)", borderBottom: "0.5px solid rgba(240,237,230,0.04)" }}>
                              {row.feature}
                            </td>
                            <td style={{ padding: "0.5rem", color: "rgba(240,237,230,0.75)", borderBottom: "0.5px solid rgba(240,237,230,0.04)", whiteSpace: "nowrap" as const }}>
                              {row.cost}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </section>

        {status && plan !== "business" && (
          <section>
            <SectionHeading>{plan === "free" ? "Upgrade your plan" : "Plan options"}</SectionHeading>
            <div style={{ display: "inline-flex", gap: "0.25rem", background: "rgba(240,237,230,0.05)", borderRadius: 8, padding: "0.25rem", marginBottom: "1rem" }}>
              {(["monthly", "annual"] as const).map(cycle => (
                <button key={cycle} onClick={() => setBillingCycle(cycle)} style={{
                  padding: "0.35rem 0.875rem", borderRadius: 6, border: "none",
                  fontSize: "0.8rem", fontFamily: "var(--font-dm-sans)", cursor: "pointer",
                  fontWeight: billingCycle === cycle ? 600 : 400,
                  background: billingCycle === cycle ? "rgba(200,245,90,0.14)" : "transparent",
                  color: billingCycle === cycle ? "#C8F55A" : "rgba(240,237,230,0.45)",
                }}>
                  {cycle === "monthly" ? "Monthly" : "Annual"}
                  {cycle === "annual" && (
                    <span style={{ marginLeft: "0.3rem", fontSize: "0.68rem", color: "#C8F55A", opacity: billingCycle === "annual" ? 1 : 0.5 }}>
                      -20%
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              {plan === "free" && (
                <PlanCard plan="pro" billingCycle={billingCycle} onUpgrade={handleUpgrade} loading={upgradeLoading} currentPlan={plan} />
              )}
              <PlanCard plan="business" billingCycle={billingCycle} onUpgrade={handleUpgrade} loading={upgradeLoading} currentPlan={plan} />
            </div>
          </section>
        )}

        <section>
          <SectionHeading>Points history</SectionHeading>
          <Card>
            {transactions.length === 0 ? (
              <p style={{ margin: 0, fontSize: "0.875rem", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }}>
                No credit transactions yet.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", fontFamily: "var(--font-dm-sans)" }}>
                  <thead><tr>
                    {["Date", "Description", "Amount", "Balance"].map(h => (
                      <th key={h} style={{
                        textAlign: "left", padding: "0 0.75rem 0.75rem",
                        color: "rgba(240,237,230,0.3)", fontWeight: 500, fontSize: "0.68rem",
                        textTransform: "uppercase" as const, letterSpacing: "0.05em",
                        borderBottom: "0.5px solid rgba(240,237,230,0.06)", whiteSpace: "nowrap" as const,
                      }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {transactions.map(tx => {
                      const isPos = tx.amount >= 0
                      return (
                        <tr key={tx.id} className="bil-row" style={{ borderBottom: "0.5px solid rgba(240,237,230,0.04)" }}>
                          <td style={{ padding: "0.7rem 0.75rem", color: "rgba(240,237,230,0.5)", whiteSpace: "nowrap" as const }}>{fmtDate(tx.createdAt)}</td>
                          <td style={{ padding: "0.7rem 0.75rem", color: "rgba(240,237,230,0.65)", maxWidth: 220 }}>
                            <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{tx.description}</span>
                          </td>
                          <td style={{ padding: "0.7rem 0.75rem", whiteSpace: "nowrap" as const, fontWeight: 500, color: isPos ? "#C8F55A" : "rgba(255,107,107,0.75)" }}>{fmtAmt(tx.amount)}</td>
                          <td style={{ padding: "0.7rem 0.75rem", color: "rgba(240,237,230,0.45)", whiteSpace: "nowrap" as const }}>{fmtCredits(tx.balance)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </section>

      </div>
    </div>
  )
}