"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, Clock3, Lock, Play, XCircle } from "lucide-react"

type Scenario = {
  key: "standard-main" | "free-mini" | "pro-mini" | "business-mini"
  label: string
  eventTitle: string
  eventSlug: string
  eventId: string
  tierId: string
  tierName: string
  amountKes: number
  capacity: number
  soldCount: number
  waitlistCount: number
  organizerPlan: string
  organizerEmail: string
  expectedCommissionRate: number
  defaultCount: number
}

type RunItem = {
  step: number
  attendeeNumber: number
  attendeeName: string
  attendeePhone: string
  orderId?: string
  status: "waiting" | "pending" | "success" | "failed" | "timed_out"
  secondsLeft?: number
  amountKes?: number
  organizerPlan?: string
  expectedCommissionRate?: number
  mpesaRef?: string | null
  failureReason?: string | null
  commission?: {
    rate: number
    expectedCommission: number
    expectedNet: number
    storedCommission: number | null
    storedNet: number | null
    correct: boolean
  }
  ticket?: {
    id: string
    code: string
    qrGenerated: boolean
  } | null
  registration?: {
    id: string
    status: string
    confirmationCode: string | null
  } | null
  emailSent?: boolean
  gapChecks?: Array<{
    key: string
    name: string
    passed: boolean
    fix: string
  }>
}

type ConfigResponse = {
  success: boolean
  scenarios: Scenario[]
  liveProvider: string
  note: string
  error?: string
}

function formatRate(rate: number) {
  return `${Math.round(rate * 100)}%`
}

function statusIcon(status: RunItem["status"]) {
  if (status === "success") return <CheckCircle2 size={18} className="text-[var(--success)]" />
  if (status === "failed") return <XCircle size={18} className="text-[var(--error)]" />
  if (status === "timed_out") return <Clock3 size={18} className="text-[var(--warning)]" />
  if (status === "pending") return <Clock3 size={18} className="text-[var(--warning)]" />
  return <Lock size={18} className="text-[var(--text-muted)]" />
}

function labelForStatus(item: RunItem) {
  if (item.status === "success") return "SUCCESS"
  if (item.status === "failed") return "FAILED"
  if (item.status === "timed_out") return "TIMED OUT (60s)"
  if (item.status === "pending") return `Pending STK Push${typeof item.secondsLeft === "number" ? ` | ${item.secondsLeft}s` : ""}`
  return "Waiting"
}

export default function AdminPaymentTestPage() {
  const [config, setConfig] = useState<ConfigResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [phone, setPhone] = useState("")
  const [error, setError] = useState("")
  const [activeScenario, setActiveScenario] = useState<string | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [results, setResults] = useState<Record<string, RunItem[]>>({})

  useEffect(() => {
    fetch("/api/admin/test/payments")
      .then((res) => res.json())
      .then((data: ConfigResponse) => {
        setConfig(data)
        if (!data.success) {
          setError(data.error || "Unable to load payment test config.")
          return
        }
        const initialCounts = Object.fromEntries((data.scenarios ?? []).map((scenario) => [scenario.key, scenario.defaultCount]))
        setCounts(initialCounts)
      })
      .catch(() => setError("Unable to load payment test config."))
      .finally(() => setLoading(false))
  }, [])

  const phoneValid = /^(07\d{8}|01\d{8})$/.test(phone.trim())

  const runSummary = useMemo(() => {
    return Object.fromEntries(
      Object.entries(results).map(([scenarioKey, items]) => {
        const finalized = items.filter((item) => item.gapChecks)
        const allChecks = finalized.flatMap((item) => item.gapChecks ?? [])
        const grouped = new Map<string, { name: string; passed: number; total: number; fix: string }>()
        for (const check of allChecks) {
          const current = grouped.get(check.key) ?? { name: check.name, passed: 0, total: 0, fix: check.fix }
          current.total += 1
          if (check.passed) current.passed += 1
          grouped.set(check.key, current)
        }
        return [scenarioKey, Array.from(grouped.values())]
      })
    )
  }, [results])

  async function fetchOrderTerminalResult(orderId: string) {
    const res = await fetch(`/api/admin/test/payments/${orderId}`)
    if (!res.ok) throw new Error("Unable to load payment result details.")
    return await res.json()
  }

  async function wait(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms))
  }

  async function runScenario(scenario: Scenario) {
    if (!phoneValid) {
      setError("Enter a valid Kenyan M-Pesa number first.")
      return
    }

    setError("")
    setActiveScenario(scenario.key)
    const count = counts[scenario.key] ?? scenario.defaultCount
    const initialItems = Array.from({ length: count }, (_, index) => ({
      step: index + 1,
      attendeeNumber: index + 1,
      attendeeName: `Attendee ${String(index + 1).padStart(2, "0")}`,
      attendeePhone: `071200${String(index + 1).padStart(4, "0")}`,
      status: index === 0 ? "pending" : "waiting",
      secondsLeft: index === 0 ? 60 : undefined,
    } satisfies RunItem))
    setResults((prev) => ({ ...prev, [scenario.key]: initialItems }))

    for (const index of Array.from({ length: count }, (_, itemIndex) => itemIndex)) {
      const attendeeNumber = index + 1
      const startRes = await fetch("/api/admin/test/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          scenarioKey: scenario.key,
          phone,
          attendeeNumber,
          resetScenario: index === 0,
        }),
      })

      const startData = await startRes.json()
      if (!startRes.ok || !startData.success) {
        setResults((prev) => ({
          ...prev,
          [scenario.key]: (prev[scenario.key] ?? []).map((item, itemIndex) => {
            if (itemIndex === index) {
              return {
                ...item,
                status: "failed",
                failureReason: startData.error ?? "Unable to start STK Push.",
              }
            }
            if (itemIndex === index + 1) return { ...item, status: "waiting" }
            return item
          }),
        }))
        break
      }

      const orderId = startData.orderId as string
      setResults((prev) => ({
        ...prev,
        [scenario.key]: (prev[scenario.key] ?? []).map((item, itemIndex) => {
          if (itemIndex === index) {
            return {
              ...item,
              orderId,
              amountKes: startData.amountKes,
              organizerPlan: startData.organizerPlan,
              expectedCommissionRate: startData.expectedCommissionRate,
              status: "pending",
              secondsLeft: 60,
            }
          }
          return item
        }),
      }))

      let finalPayload: Awaited<ReturnType<typeof fetchOrderTerminalResult>> | null = null

      for (const secondsLeft of Array.from({ length: 61 }, (_, elapsed) => 60 - elapsed)) {
        if (secondsLeft % 3 === 0) {
          const statusRes = await fetch(`/api/paid-events/orders/${orderId}`)
          const statusData = await statusRes.json()
          if (statusData.status === "PAID" || statusData.status === "FAILED" || statusData.status === "CANCELLED" || statusData.status === "EXPIRED") {
            finalPayload = await fetchOrderTerminalResult(orderId)
            break
          }
        }

        setResults((prev) => ({
          ...prev,
          [scenario.key]: (prev[scenario.key] ?? []).map((item, itemIndex) => {
            if (itemIndex === index && item.status === "pending") {
              return { ...item, secondsLeft }
            }
            return item
          }),
        }))

        if (secondsLeft > 0) {
          await wait(1000)
        }
      }

      if (!finalPayload) {
        await fetch("/api/admin/test/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "expire", orderId }),
        })
        finalPayload = await fetchOrderTerminalResult(orderId)
      }

      setResults((prev) => ({
        ...prev,
        [scenario.key]: (prev[scenario.key] ?? []).map((item, itemIndex) => {
          if (itemIndex === index) {
            const mappedStatus =
              finalPayload.status === "PAID"
                ? "success"
                : finalPayload.status === "EXPIRED"
                  ? "timed_out"
                  : "failed"

            return {
              ...item,
              status: mappedStatus,
              amountKes: finalPayload.amountKes,
              organizerPlan: finalPayload.organizerPlan,
              mpesaRef: finalPayload.mpesaRef,
              failureReason: finalPayload.failureReason,
              commission: finalPayload.commission,
              ticket: finalPayload.ticket,
              registration: finalPayload.registration,
              emailSent: finalPayload.emailSent,
              gapChecks: finalPayload.gapChecks,
              secondsLeft: undefined,
            }
          }
          if (itemIndex === index + 1) {
            return { ...item, status: "pending", secondsLeft: 60 }
          }
          return item
        }),
      }))
    }

    setActiveScenario(null)
  }

  if (loading) {
    return <div className="text-[var(--text-primary)]">Loading payment test panel...</div>
  }

  if (!config?.success) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.07)] p-5 text-[var(--text-primary)]">
        <div className="text-sm uppercase tracking-[0.18em] text-[var(--error)]">Payment Tests Unavailable</div>
        <div className="mt-3 text-lg font-medium text-[var(--error)]">
          {error || config?.error || "Unable to load payment test panel."}
        </div>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          This usually means the production project does not have the seeded payment test fixtures that this admin tool expects.
        </p>
        <p className="mt-2 text-xs text-[var(--text-secondary)]">
          Safe next step: run the payment test seed in the target environment before using this panel.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl text-[var(--text-primary)]">
      <div className="mb-8 flex items-start gap-4 rounded-2xl border border-[rgba(250,204,21,0.28)] bg-[rgba(250,204,21,0.06)] p-5">
        <AlertTriangle className="mt-0.5 text-[var(--warning)]" size={20} />
        <div>
          <h1 className="text-2xl font-semibold">EventSlot | Payment Test Panel</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            This fires real M-Pesa STK Push requests. The live codebase currently uses the IntaSend-backed M-Pesa flow.
          </p>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">{config.note}</p>
        </div>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
          <label className="mb-2 block text-sm font-medium">Your M-Pesa Number</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            inputMode="numeric"
            placeholder="0712345678"
            className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 py-3 text-base outline-none focus:border-[rgba(200,245,90,0.45)]"
          />
          <p className={`mt-2 text-xs ${phone.length === 0 || phoneValid ? "text-[var(--text-muted)]" : "text-[var(--error)]"}`}>
            Use a Kenyan 07XX or 01XX number. You approve each STK Push on your phone.
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Provider</div>
          <div className="mt-3 text-lg font-medium">{config.liveProvider}</div>
          <div className="mt-1 text-sm text-[var(--text-secondary)]">Sequential runs only</div>
        </div>
      </div>

      {error && <div className="mb-6 rounded-xl border border-[rgba(248,113,113,0.26)] bg-[rgba(248,113,113,0.08)] px-4 py-3 text-sm text-[var(--error)]">{error}</div>}

      <div className="space-y-6">
        {config.scenarios.map((scenario) => {
          const scenarioResults = results[scenario.key] ?? []
          const summary = runSummary[scenario.key] ?? []
          const isRunning = activeScenario === scenario.key

          return (
            <section key={scenario.key} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">{scenario.label}</div>
                  <h2 className="mt-2 text-xl font-medium">{scenario.eventTitle}</h2>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    Tier: {scenario.tierName} | KES {scenario.amountKes.toLocaleString()} | Organiser plan: {scenario.organizerPlan} ({formatRate(scenario.expectedCommissionRate)})
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="text-sm text-[var(--text-secondary)]">
                    Payments to run
                    <select
                      value={counts[scenario.key] ?? scenario.defaultCount}
                      onChange={(e) => setCounts((prev) => ({ ...prev, [scenario.key]: Number(e.target.value) }))}
                      disabled={isRunning}
                      className="ml-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm"
                    >
                      {Array.from({ length: scenario.defaultCount === 10 ? 10 : 2 }, (_, i) => i + 1).map((num) => (
                        <option key={num} value={num}>{num}</option>
                      ))}
                    </select>
                  </label>

                  <button
                    onClick={() => runScenario(scenario)}
                    disabled={!phoneValid || Boolean(activeScenario)}
                    className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#0A0A0A] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Play size={16} />
                    {isRunning ? "Running..." : "Start Test"}
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-4">
                  <div className="mb-4 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Results</div>
                  <div className="space-y-3">
                    {scenarioResults.length === 0 && (
                      <div className="rounded-xl border border-dashed border-[var(--border-subtle)] p-4 text-sm text-[var(--text-muted)]">
                        No payments run yet.
                      </div>
                    )}

                    {scenarioResults.map((item) => (
                      <div key={`${scenario.key}-${item.step}`} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
                        <div className="flex items-center gap-3">
                          {statusIcon(item.status)}
                          <div className="text-sm font-medium">
                            Payment {item.step} - {labelForStatus(item)}
                          </div>
                        </div>

                        <div className="mt-3 grid gap-2 text-sm text-[var(--text-secondary)] md:grid-cols-2">
                          <div>Attendee: <span className="text-[var(--text-primary)]">{item.attendeeName}</span></div>
                          <div>Phone: <span className="text-[var(--text-primary)]">{item.attendeePhone}</span></div>
                          {item.amountKes ? <div>Amount paid: <span className="text-[var(--text-primary)]">KES {item.amountKes.toLocaleString()}</span></div> : null}
                          {item.commission ? (
                            <>
                              <div>Commission ({formatRate(item.commission.rate)}): <span className="text-[var(--text-primary)]">KES {item.commission.expectedCommission}</span></div>
                              <div>Organiser nets: <span className="text-[var(--text-primary)]">KES {item.commission.expectedNet}</span></div>
                            </>
                          ) : null}
                          {item.mpesaRef ? <div>M-Pesa Ref: <span className="text-[var(--text-primary)]">{item.mpesaRef}</span></div> : null}
                          {item.ticket?.code ? <div>Ticket ID: <span className="text-[var(--text-primary)]">{item.ticket.code}</span></div> : null}
                          {item.ticket ? <div>QR Generated: <span className={item.ticket.qrGenerated ? "text-[var(--success)]" : "text-[var(--error)]"}>{item.ticket.qrGenerated ? "Yes" : "No"}</span></div> : null}
                          {typeof item.emailSent === "boolean" ? <div>Email sent: <span className={item.emailSent ? "text-[var(--success)]" : "text-[var(--error)]"}>{item.emailSent ? "Yes" : "No"}</span></div> : null}
                        </div>

                        {item.failureReason ? (
                          <div className="mt-3 rounded-lg border border-[rgba(248,113,113,0.2)] bg-[rgba(248,113,113,0.07)] px-3 py-2 text-sm text-[var(--error)]">
                            Reason: {item.failureReason}
                          </div>
                        ) : null}

                        {item.gapChecks && item.gapChecks.length > 0 ? (
                          <div className="mt-4">
                            <div className="mb-2 text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Gaps Detected</div>
                            <div className="space-y-2">
                              {item.gapChecks.filter((check) => !check.passed).map((check) => (
                                <div key={check.key} className="rounded-lg border border-[rgba(248,113,113,0.18)] bg-[rgba(248,113,113,0.05)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                                  <div className="font-medium text-[var(--error)]">{check.name}: not found</div>
                                  <div className="mt-1 text-xs text-[var(--text-secondary)]">{check.fix}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-4">
                  <div className="mb-4 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Gap Report{scenarioResults.length > 0 ? ` - ${scenarioResults.filter((item) => item.gapChecks).length} Payments Tested` : ""}
                  </div>
                  {summary.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--border-subtle)] p-4 text-sm text-[var(--text-muted)]">
                      Run at least one payment to build the gap summary.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {summary.map((row) => (
                        <div key={row.name} className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3">
                          <div>
                            <div className="text-sm font-medium">{row.name}</div>
                            {row.passed !== row.total ? (
                              <div className="mt-1 text-xs text-[var(--text-secondary)]">{row.fix}</div>
                            ) : null}
                          </div>
                          <div className={row.passed === row.total ? "text-[var(--success)]" : "text-[var(--error)]"}>
                            {row.passed}/{row.total}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
