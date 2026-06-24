"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import type {
  OrganizerPaymentsDashboardData,
  OrganizerWithdrawalRow,
  SupportedCurrency,
} from "@/lib/organizerPayments"
import { TierBadge } from "@/components/TierBadge"

type PaymentsPageProps = {
  data: OrganizerPaymentsDashboardData
}

type WithdrawalMethodKey = "MPESA" | "PAYBILL" | "BANK"

type WithdrawalDraft = {
  amount: string
  method: WithdrawalMethodKey
  mpesaPhone: string
  mpesaAccountName: string
  paybillNumber: string
  paybillAccountNumber: string
  paybillBusinessName: string
  bankName: string
  bankAccountNumber: string
  bankAccountName: string
  bankBranchCode: string
}

const KENYAN_BANKS = [
  "Absa Bank Kenya",
  "Co-operative Bank",
  "DTB Kenya",
  "Equity Bank",
  "Family Bank",
  "KCB Bank",
  "NCBA Bank",
  "Standard Chartered Kenya",
]

const WITHDRAWAL_MINIMUM: Record<SupportedCurrency, number> = {
  KES: 100,
  USD: 1,
}

function formatMoney(currency: SupportedCurrency, amount: number) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "USD" ? 2 : 0,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  }).format(amount)
}

function formatDateTime(value: string | null) {
  if (!value) return "Not recorded"
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value))
}

function formatDate(value: string | null) {
  if (!value) return "Date pending"
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

function statusLabel(status: OrganizerWithdrawalRow["status"]) {
  switch (status) {
    case "COMPLETED":
      return "Completed"
    case "FAILED":
      return "Failed"
    case "CANCELLED":
      return "Cancelled"
    default:
      return "Processing"
  }
}

function payoutLabel(status: "ACTIVE" | "ENDED" | "PAID_OUT") {
  if (status === "PAID_OUT") return "Paid Out"
  if (status === "ENDED") return "Ended"
  return "Active"
}

function trendIcon(color: string) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 11.5 6.8 7.7l2.2 2.2L13 5.9" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.5 5.9H13v2.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function pillStyle(active: boolean): React.CSSProperties {
  return {
    border: active ? "0.5px solid rgba(200,245,90,0.38)" : "0.5px solid rgba(240,237,230,0.12)",
    background: active ? "rgba(200,245,90,0.08)" : "transparent",
    color: active ? "#C8F55A" : "rgba(240,237,230,0.7)",
    borderRadius: 999,
    padding: "0.55rem 0.95rem",
    fontSize: "0.82rem",
    fontFamily: "var(--font-dm-sans)",
    fontWeight: 600,
    cursor: "pointer",
  }
}

function emptyDraft(): WithdrawalDraft {
  return {
    amount: "",
    method: "MPESA",
    mpesaPhone: "",
    mpesaAccountName: "",
    paybillNumber: "",
    paybillAccountNumber: "",
    paybillBusinessName: "",
    bankName: KENYAN_BANKS[0],
    bankAccountNumber: "",
    bankAccountName: "",
      bankBranchCode: "",
  }
}

function WithdrawalModal({
  currency,
  available,
  onClose,
}: {
  currency: SupportedCurrency
  available: number
  onClose: () => void
}) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [draft, setDraft] = useState<WithdrawalDraft>(emptyDraft)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ reference: string; destination: string; processingTime: string } | null>(null)

  const amount = Number(draft.amount)
  const minimum = WITHDRAWAL_MINIMUM[currency]
  const amountIsValid = Number.isFinite(amount) && amount >= minimum && amount <= available

  const destinationLabel = useMemo(() => {
    if (draft.method === "MPESA") return draft.mpesaPhone
    if (draft.method === "PAYBILL") return `${draft.paybillNumber} / ${draft.paybillAccountNumber}`
    return `${draft.bankName} / ${draft.bankAccountNumber}`
  }, [draft])

  function validateCurrentStep(nextStep: 2 | 3 | 4 | 5) {
    if (nextStep === 2) {
      if (!amountIsValid) {
        setError(`Enter an amount between ${formatMoney(currency, minimum)} and ${formatMoney(currency, available)}.`)
        return false
      }
    }
    if (nextStep === 4) {
      if (draft.method === "MPESA" && !draft.mpesaPhone.trim()) {
        setError("Enter the M-Pesa phone number.")
        return false
      }
      if (draft.method === "PAYBILL" && (!draft.paybillNumber.trim() || !draft.paybillAccountNumber.trim() || !draft.paybillBusinessName.trim())) {
        setError("Enter the PayBill destination details.")
        return false
      }
      if (draft.method === "BANK" && (!draft.bankName.trim() || !draft.bankAccountNumber.trim() || !draft.bankAccountName.trim() || !draft.bankBranchCode.trim())) {
        setError("Enter the bank transfer details.")
        return false
      }
    }
    setError("")
    setStep(nextStep)
    return true
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch("/api/organizer/payments/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currency,
          amount,
          method: draft.method,
          destination: {
            mpesaPhone: draft.mpesaPhone,
            mpesaAccountName: draft.mpesaAccountName,
            paybillNumber: draft.paybillNumber,
            paybillAccountNumber: draft.paybillAccountNumber,
            paybillBusinessName: draft.paybillBusinessName,
            bankName: draft.bankName,
            bankAccountNumber: draft.bankAccountNumber,
            bankAccountName: draft.bankAccountName,
            bankBranchCode: draft.bankBranchCode,
          },
        }),
      })
      const payload = await res.json()
      if (!res.ok) {
        setError(payload.error || "Withdrawal failed. Please try again.")
        return
      }
      setResult({
        reference: payload.reference,
        destination: payload.destinationLabel,
        processingTime: payload.processingTime,
      })
      setStep(5)
      router.refresh()
    } catch {
      setError("Withdrawal failed. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 90 }} />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(92vw, 560px)",
          maxHeight: "85vh",
          overflowY: "auto",
          background: "#121212",
          border: "0.5px solid rgba(240,237,230,0.12)",
          borderRadius: 18,
          padding: "1.35rem",
          zIndex: 91,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "1rem" }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: "var(--font-instrument-serif)", fontSize: "1.3rem", fontWeight: 400, color: "#F0EDE6" }}>
              Withdraw Funds
            </h2>
            <p style={{ margin: "0.35rem 0 0", fontSize: "0.86rem", color: "rgba(240,237,230,0.52)", fontFamily: "var(--font-dm-sans)" }}>
              Available balance: {formatMoney(currency, available)}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "rgba(240,237,230,0.5)", cursor: "pointer", fontSize: "1.6rem", lineHeight: 1 }}>
            ×
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: "1rem", flexWrap: "wrap" }}>
          {[1, 2, 3, 4, 5].map((item) => (
            <div
              key={item}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: step >= item ? "rgba(200,245,90,0.12)" : "rgba(240,237,230,0.05)",
                border: step >= item ? "0.5px solid rgba(200,245,90,0.28)" : "0.5px solid rgba(240,237,230,0.12)",
                color: step >= item ? "#C8F55A" : "rgba(240,237,230,0.42)",
                fontFamily: "var(--font-dm-sans)",
                fontSize: "0.78rem",
                fontWeight: 700,
              }}
            >
              {item}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div style={{ display: "grid", gap: "0.85rem" }}>
            <label style={{ fontSize: "0.82rem", color: "rgba(240,237,230,0.72)", fontFamily: "var(--font-dm-sans)" }}>
              Amount to withdraw
            </label>
            <input
              type="number"
              min={minimum}
              max={available}
              value={draft.amount}
              onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))}
              placeholder={`${currency} ${minimum}`}
              style={{
                width: "100%",
                borderRadius: 10,
                background: "#181818",
                border: "0.5px solid rgba(240,237,230,0.12)",
                color: "#F0EDE6",
                padding: "0.9rem 1rem",
                fontSize: "0.98rem",
              }}
            />
            <p style={{ margin: 0, fontSize: "0.8rem", color: "rgba(240,237,230,0.46)", fontFamily: "var(--font-dm-sans)" }}>
              Maximum: {formatMoney(currency, available)}
            </p>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: "grid", gap: "0.8rem" }}>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)" }}>How would you like to receive your funds?</p>
            {([
              { key: "MPESA", title: "M-Pesa", description: "Send to a Safaricom mobile number" },
              { key: "PAYBILL", title: "PayBill", description: "Send to a business PayBill number" },
              { key: "BANK", title: "Bank Transfer", description: "Send to a local bank account" },
            ] as const).map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setDraft((current) => ({ ...current, method: option.key }))}
                style={{
                  textAlign: "left",
                  borderRadius: 12,
                  border: draft.method === option.key ? "0.5px solid rgba(200,245,90,0.36)" : "0.5px solid rgba(240,237,230,0.12)",
                  background: draft.method === option.key ? "rgba(200,245,90,0.07)" : "#181818",
                  color: "#F0EDE6",
                  padding: "0.95rem 1rem",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: "0.92rem", fontWeight: 600, fontFamily: "var(--font-dm-sans)" }}>{option.title}</div>
                <div style={{ marginTop: 4, fontSize: "0.8rem", color: "rgba(240,237,230,0.5)", fontFamily: "var(--font-dm-sans)" }}>{option.description}</div>
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div style={{ display: "grid", gap: "0.8rem" }}>
            {draft.method === "MPESA" && (
              <>
                <input
                  value={draft.mpesaPhone}
                  onChange={(event) => setDraft((current) => ({ ...current, mpesaPhone: event.target.value }))}
                  placeholder="M-Pesa Phone Number"
                  style={inputStyle}
                />
                <input
                  value={draft.mpesaAccountName}
                  onChange={(event) => setDraft((current) => ({ ...current, mpesaAccountName: event.target.value }))}
                  placeholder="Account Name"
                  style={inputStyle}
                />
              </>
            )}

            {draft.method === "PAYBILL" && (
              <>
                <input value={draft.paybillNumber} onChange={(event) => setDraft((current) => ({ ...current, paybillNumber: event.target.value }))} placeholder="PayBill Number" style={inputStyle} />
                <input value={draft.paybillAccountNumber} onChange={(event) => setDraft((current) => ({ ...current, paybillAccountNumber: event.target.value }))} placeholder="Account Number" style={inputStyle} />
                <input value={draft.paybillBusinessName} onChange={(event) => setDraft((current) => ({ ...current, paybillBusinessName: event.target.value }))} placeholder="Business Name" style={inputStyle} />
              </>
            )}

            {draft.method === "BANK" && (
              <>
                <select value={draft.bankName} onChange={(event) => setDraft((current) => ({ ...current, bankName: event.target.value }))} style={inputStyle}>
                  {KENYAN_BANKS.map((bank) => <option key={bank} value={bank}>{bank}</option>)}
                </select>
                <input value={draft.bankAccountNumber} onChange={(event) => setDraft((current) => ({ ...current, bankAccountNumber: event.target.value }))} placeholder="Account Number" style={inputStyle} />
                <input value={draft.bankAccountName} onChange={(event) => setDraft((current) => ({ ...current, bankAccountName: event.target.value }))} placeholder="Account Name" style={inputStyle} />
                <input value={draft.bankBranchCode} onChange={(event) => setDraft((current) => ({ ...current, bankBranchCode: event.target.value }))} placeholder="Branch Code" style={inputStyle} />
              </>
            )}
          </div>
        )}

        {step === 4 && (
          <div style={{ display: "grid", gap: "0.8rem", padding: "0.4rem 0" }}>
            <SummaryLine label="Amount" value={formatMoney(currency, amount)} />
            <SummaryLine label="Method" value={draft.method === "MPESA" ? "M-Pesa" : draft.method === "PAYBILL" ? "PayBill" : "Bank Transfer"} />
            <SummaryLine label="Destination" value={destinationLabel} />
            <SummaryLine label="Fee" value={formatMoney(currency, 0)} />
            <SummaryLine label="You receive" value={formatMoney(currency, amount)} accent />
          </div>
        )}

        {step === 5 && result && (
          <div style={{ display: "grid", gap: "0.8rem", padding: "0.5rem 0" }}>
            <div style={{ fontSize: "1rem", color: "#C8F55A", fontWeight: 700, fontFamily: "var(--font-dm-sans)" }}>Withdrawal Initiated</div>
            <p style={{ margin: 0, fontSize: "0.92rem", lineHeight: 1.7, color: "rgba(240,237,230,0.75)", fontFamily: "var(--font-dm-sans)" }}>
              {formatMoney(currency, amount)} has been queued for {result.destination}.
            </p>
            <SummaryLine label="Reference" value={result.reference} />
            <SummaryLine label="Processing time" value={result.processingTime} />
          </div>
        )}

        {error ? <p style={{ margin: "1rem 0 0", color: "#FF6B6B", fontSize: "0.82rem", fontFamily: "var(--font-dm-sans)" }}>{error}</p> : null}

        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", marginTop: "1.2rem", flexWrap: "wrap" }}>
          <button type="button" onClick={onClose} style={secondaryButtonStyle}>Cancel</button>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            {step > 1 && step < 5 ? (
              <button type="button" onClick={() => { setError(""); setStep((current) => (current - 1) as 1 | 2 | 3 | 4 | 5) }} style={secondaryButtonStyle}>
                Back
              </button>
            ) : null}
            {step === 1 && <button type="button" onClick={() => validateCurrentStep(2)} style={primaryButtonStyle}>Continue</button>}
            {step === 2 && <button type="button" onClick={() => validateCurrentStep(3)} style={primaryButtonStyle}>Continue</button>}
            {step === 3 && <button type="button" onClick={() => validateCurrentStep(4)} style={primaryButtonStyle}>Continue</button>}
            {step === 4 && (
              <button type="button" onClick={handleSubmit} disabled={submitting} style={{ ...primaryButtonStyle, opacity: submitting ? 0.65 : 1 }}>
                {submitting ? "Submitting..." : "Confirm Withdrawal"}
              </button>
            )}
            {step === 5 && <button type="button" onClick={onClose} style={primaryButtonStyle}>Done</button>}
          </div>
        </div>
      </div>
    </>
  )
}

function SummaryLine({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", fontFamily: "var(--font-dm-sans)", fontSize: "0.86rem" }}>
      <span style={{ color: "rgba(240,237,230,0.52)" }}>{label}</span>
      <span style={{ color: accent ? "#C8F55A" : "#F0EDE6", textAlign: "right" }}>{value}</span>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 10,
  background: "#181818",
  border: "0.5px solid rgba(240,237,230,0.12)",
  color: "#F0EDE6",
  padding: "0.9rem 1rem",
  fontSize: "0.9rem",
  fontFamily: "var(--font-dm-sans)",
}

const primaryButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 999,
  background: "#C8F55A",
  color: "#0A0A0A",
  padding: "0.8rem 1.15rem",
  fontSize: "0.82rem",
  fontWeight: 700,
  fontFamily: "var(--font-dm-sans)",
  cursor: "pointer",
}

const secondaryButtonStyle: React.CSSProperties = {
  border: "0.5px solid rgba(240,237,230,0.14)",
  borderRadius: 999,
  background: "transparent",
  color: "#F0EDE6",
  padding: "0.8rem 1.15rem",
  fontSize: "0.82rem",
  fontWeight: 600,
  fontFamily: "var(--font-dm-sans)",
  cursor: "pointer",
}

export function OrganizerPaymentsPage({ data }: PaymentsPageProps) {
  const [currency, setCurrency] = useState<SupportedCurrency>(data.defaultCurrency)
  const [expandedEventIds, setExpandedEventIds] = useState<string[]>([])
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [activeLedgerTab, setActiveLedgerTab] = useState<"transactions" | "withdrawals">("transactions")
  const [eventFilter, setEventFilter] = useState("all")
  const [tierFilter, setTierFilter] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const summary = data.summaryByCurrency[currency]
  const events = useMemo(() => data.events.filter((event) => event.currency === currency), [data.events, currency])
  const eventOptions = useMemo(() => {
    return Array.from(new Set(data.transactions.filter((item) => item.currency === currency).map((item) => item.eventTitle)))
  }, [data.transactions, currency])
  const tierOptions = useMemo(() => {
    return Array.from(new Set(data.transactions.filter((item) => item.currency === currency).map((item) => item.tierName)))
  }, [data.transactions, currency])

  const filteredTransactions = useMemo(() => {
    return data.transactions.filter((item) => {
      if (item.currency !== currency) return false
      if (eventFilter !== "all" && item.eventTitle !== eventFilter) return false
      if (tierFilter !== "all" && item.tierName !== tierFilter) return false
      if (dateFrom && (!item.paidAt || new Date(item.paidAt) < new Date(`${dateFrom}T00:00:00`))) return false
      if (dateTo && (!item.paidAt || new Date(item.paidAt) > new Date(`${dateTo}T23:59:59`))) return false
      return true
    })
  }, [currency, data.transactions, dateFrom, dateTo, eventFilter, tierFilter])

  const withdrawals = useMemo(() => data.withdrawals.filter((item) => item.currency === currency), [data.withdrawals, currency])

  if (!data.sidebar.visible) {
    return (
      <div className="dashboard-page-shell" style={{ maxWidth: 960 }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 className="dashboard-page-title">My Payments</h1>
          <p className="dashboard-page-intro">Track your event earnings and withdraw your balance.</p>
        </div>
        <section className="dashboard-surface" style={{ padding: "1.3rem" }}>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "rgba(240,237,230,0.62)", fontFamily: "var(--font-dm-sans)", lineHeight: 1.7 }}>
            This section appears once your paid events start receiving successful ticket payments.
          </p>
        </section>
      </div>
    )
  }

  return (
    <div className="dashboard-page-shell" style={{ maxWidth: 1160 }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 className="dashboard-page-title">My Payments</h1>
        <p className="dashboard-page-intro">Track your event earnings and withdraw your balance.</p>
      </div>

      {data.availableCurrencies.length > 1 && (
        <div style={{ display: "flex", gap: 10, marginBottom: "1rem", flexWrap: "wrap" }}>
          {data.availableCurrencies.map((item) => (
            <button key={item} type="button" onClick={() => setCurrency(item)} style={pillStyle(currency === item)}>
              {item}
            </button>
          ))}
        </div>
      )}

      <section style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginBottom: "1rem" }}>
        {[
          { label: "Total Gross", value: formatMoney(currency, summary.gross), accent: "#C8F55A", icon: trendIcon("#C8F55A") },
          { label: "Commission Deducted", value: formatMoney(currency, summary.commission), accent: "rgba(240,237,230,0.72)", icon: null },
          { label: "Net Earnings", value: formatMoney(currency, summary.net), accent: "#C8F55A", icon: trendIcon("#C8F55A") },
          { label: "Withdrawable Balance", value: formatMoney(currency, summary.withdrawable), accent: "#C8F55A", icon: null },
        ].map((card) => (
          <div key={card.label} className="dashboard-surface" style={{ padding: "1.1rem 1.15rem", background: "#141414" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "0.7rem" }}>
              <span style={{ fontSize: "0.72rem", color: "rgba(240,237,230,0.42)", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-dm-sans)", fontWeight: 700 }}>
                {card.label}
              </span>
              {card.icon}
            </div>
            <div style={{ fontSize: "1.55rem", color: card.accent, fontFamily: "var(--font-dm-sans)", fontWeight: 700 }}>
              {card.value}
            </div>
          </div>
        ))}
      </section>

      <section className="dashboard-surface" style={{ padding: "1rem 1.1rem", marginBottom: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "0.8rem", color: "rgba(240,237,230,0.46)", fontFamily: "var(--font-dm-sans)" }}>Available</div>
          <div style={{ marginTop: 4, fontSize: "1rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", fontWeight: 600 }}>
            {formatMoney(currency, summary.withdrawable)}
          </div>
        </div>
        <button
          type="button"
          disabled={summary.withdrawable <= 0}
          onClick={() => setShowWithdrawModal(true)}
          style={{
            border: "none",
            borderRadius: 999,
            background: summary.withdrawable > 0 ? "#C8F55A" : "rgba(240,237,230,0.12)",
            color: summary.withdrawable > 0 ? "#0A0A0A" : "rgba(240,237,230,0.4)",
            padding: "0.85rem 1.25rem",
            fontSize: "0.84rem",
            fontWeight: 700,
            fontFamily: "var(--font-dm-sans)",
            cursor: summary.withdrawable > 0 ? "pointer" : "not-allowed",
          }}
        >
          Withdraw Funds
        </button>
      </section>

      <section className="dashboard-surface" style={{ padding: "1rem 1.1rem", marginBottom: "1rem", background: "rgba(255,184,77,0.05)", borderColor: "rgba(255,184,77,0.18)" }}>
        <p style={{ margin: 0, fontSize: "0.84rem", lineHeight: 1.7, color: "rgba(240,237,230,0.7)", fontFamily: "var(--font-dm-sans)" }}>
          EventSlot&apos;s platform commission is non-refundable. If you issue a refund to an attendee, the commission amount is deducted from your net balance.
        </p>
      </section>

      <section className="dashboard-surface" style={{ padding: "1rem 0", marginBottom: "1rem" }}>
        <div style={{ padding: "0 1.1rem 0.9rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.05rem", color: "#F0EDE6", fontFamily: "var(--font-instrument-serif)", fontWeight: 400 }}>Per-event earnings</h2>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Date</th>
                <th>Currency</th>
                <th>Gross</th>
                <th>Commission</th>
                <th>Net</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const expanded = expandedEventIds.includes(event.id)
                return (
                  <FragmentRow
                    key={event.id}
                    summaryRow={
                      <tr
                        onClick={() => setExpandedEventIds((current) => current.includes(event.id) ? current.filter((item) => item !== event.id) : [...current, event.id])}
                        style={{ cursor: "pointer" }}
                      >
                        <td>
                          <div style={{ display: "grid", gap: 4 }}>
                            <Link href={`/dashboard/events/${event.slug}`} style={{ color: "#F0EDE6", textDecoration: "none", fontFamily: "var(--font-dm-sans)", fontWeight: 600 }}>
                              {event.title}
                            </Link>
                            <span style={{ fontSize: "0.78rem", color: "rgba(240,237,230,0.42)", fontFamily: "var(--font-dm-sans)" }}>
                              {expanded ? "Hide tier breakdown" : "Show tier breakdown"}
                            </span>
                          </div>
                        </td>
                        <td>{formatDate(event.eventDate)}</td>
                        <td>{event.currency}</td>
                        <td>{formatMoney(event.currency, event.gross)}</td>
                        <td>{formatMoney(event.currency, event.commission)} · {Math.round(event.commissionRate * 100)}%</td>
                        <td>{formatMoney(event.currency, event.net)}</td>
                        <td>{payoutLabel(event.status)}</td>
                      </tr>
                    }
                    expanded={expanded}
                    detailRow={
                      <tr>
                        <td colSpan={7} style={{ background: "rgba(240,237,230,0.015)" }}>
                          <div style={{ padding: "0.35rem 0" }}>
                            <div className="table-wrapper">
                              <table>
                                <thead>
                                  <tr>
                                    <th>Tier</th>
                                    <th>Tickets Sold</th>
                                    <th>Price</th>
                                    <th>Gross</th>
                                    <th>Commission</th>
                                    <th>Net</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {event.tiers.map((tier) => {
                                    return (
                                      <tr key={tier.id}>
                                        <td>
                                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                            <TierBadge
                                              name={tier.name}
                                              badgeColor={tier.badgeColor}
                                              textColor={tier.textColor}
                                              metallic={tier.metallic}
                                              size="sm"
                                            />
                                          </div>
                                        </td>
                                        <td>{tier.ticketsSold}</td>
                                        <td>{formatMoney(event.currency, tier.price)}</td>
                                        <td>{formatMoney(event.currency, tier.gross)}</td>
                                        <td>{formatMoney(event.currency, tier.commission)}</td>
                                        <td>{formatMoney(event.currency, tier.net)}</td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    }
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dashboard-surface" style={{ padding: "1rem 1.1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.05rem", color: "#F0EDE6", fontFamily: "var(--font-instrument-serif)", fontWeight: 400 }}>
            {activeLedgerTab === "transactions" ? "Transaction log" : "Withdrawal history"}
          </h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => setActiveLedgerTab("transactions")} style={pillStyle(activeLedgerTab === "transactions")}>Transactions</button>
            <button type="button" onClick={() => setActiveLedgerTab("withdrawals")} style={pillStyle(activeLedgerTab === "withdrawals")}>Withdrawals</button>
          </div>
        </div>

        {activeLedgerTab === "transactions" && (
          <>
            <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginBottom: "1rem" }}>
              <select value={eventFilter} onChange={(event) => setEventFilter(event.target.value)} style={inputStyle}>
                <option value="all">All events</option>
                {eventOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select value={tierFilter} onChange={(event) => setTierFilter(event.target.value)} style={inputStyle}>
                <option value="all">All tiers</option>
                {tierOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} style={inputStyle} />
              <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} style={inputStyle} />
            </div>
            <div className="table-wrapper" style={{ maxHeight: 420 }}>
              <table>
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Attendee</th>
                    <th>Event</th>
                    <th>Tier</th>
                    <th>Amount Paid</th>
                    <th>Commission</th>
                    <th>You Received</th>
                    <th>M-Pesa Ref</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDateTime(item.paidAt)}</td>
                      <td>{item.attendeeName}</td>
                      <td>{item.eventTitle}</td>
                      <td>{item.tierName}</td>
                      <td>{formatMoney(item.currency, item.amount)}</td>
                      <td>{formatMoney(item.currency, item.commission)}</td>
                      <td>{formatMoney(item.currency, item.net)}</td>
                      <td>{item.mpesaRef ?? "—"}</td>
                    </tr>
                  ))}
                  {filteredTransactions.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ color: "rgba(240,237,230,0.46)", fontFamily: "var(--font-dm-sans)" }}>
                        No transactions match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeLedgerTab === "withdrawals" && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Reference</th>
                  <th>Destination</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDateTime(item.createdAt)}</td>
                    <td>{formatMoney(item.currency, item.amount)}</td>
                    <td>{item.method === "MPESA" ? "M-Pesa" : item.method === "PAYBILL" ? "PayBill" : "Bank Transfer"}</td>
                    <td>{statusLabel(item.status)}</td>
                    <td>{item.providerRef ?? "Pending"}</td>
                    <td>{item.destination}</td>
                  </tr>
                ))}
                {withdrawals.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ color: "rgba(240,237,230,0.46)", fontFamily: "var(--font-dm-sans)" }}>
                      No withdrawal requests yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showWithdrawModal ? (
        <WithdrawalModal
          currency={currency}
          available={summary.withdrawable}
          onClose={() => setShowWithdrawModal(false)}
        />
      ) : null}
    </div>
  )
}

function FragmentRow({
  summaryRow,
  detailRow,
  expanded,
}: {
  summaryRow: React.ReactNode
  detailRow: React.ReactNode
  expanded: boolean
}) {
  return (
    <>
      {summaryRow}
      {expanded ? detailRow : null}
    </>
  )
}
