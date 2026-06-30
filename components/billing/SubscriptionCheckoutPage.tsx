"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { CreditCard, Loader2, ShieldCheck, Smartphone } from "lucide-react"
import type { SubscriptionPlanDefinition } from "@/lib/subscriptionPlans"
import {
  formatKes,
  formatUsd,
  getSubscriptionBillingQuote,
  normalizeBillingCycle,
  normalizePaymentMethod,
  type SubscriptionBillingCycle,
  type SubscriptionPaymentMethod,
} from "@/lib/subscriptionBilling"

type SubscriptionCheckoutPageProps = {
  plans: SubscriptionPlanDefinition[]
  currentPlanKey: string
  initialPlanKey: string
  initialBillingCycle: SubscriptionBillingCycle
  accountName: string
  accountEmail: string
}

export function SubscriptionCheckoutPage({
  plans,
  currentPlanKey,
  initialPlanKey,
  initialBillingCycle,
  accountName,
  accountEmail,
}: SubscriptionCheckoutPageProps) {
  const [planKey, setPlanKey] = useState(initialPlanKey)
  const [billingCycle, setBillingCycle] = useState<SubscriptionBillingCycle>(
    normalizeBillingCycle(initialBillingCycle)
  )
  const [paymentMethod, setPaymentMethod] = useState<SubscriptionPaymentMethod>("card")
  const [payerName, setPayerName] = useState(accountName)
  const [mpesaPhone, setMpesaPhone] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.key === planKey) ?? plans.find((plan) => plan.key === "pro") ?? plans[0],
    [planKey, plans]
  )

  const quote = useMemo(
    () => getSubscriptionBillingQuote(selectedPlan, billingCycle),
    [billingCycle, selectedPlan]
  )

  const planIsCurrent = currentPlanKey === selectedPlan.key

  const handleCheckout = async () => {
    setSubmitting(true)
    setError("")

    if (!payerName.trim()) {
      setError("Please enter the account holder name for this checkout.")
      setSubmitting(false)
      return
    }

    if (paymentMethod === "mpesa" && !mpesaPhone.trim()) {
      setError("Please enter the M-Pesa number that should receive the STK push.")
      setSubmitting(false)
      return
    }

    try {
      const response = await fetch("/api/billing/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planKey: selectedPlan.key,
          billingCycle,
          paymentMethod,
          payerName,
          mpesaPhone: paymentMethod === "mpesa" ? mpesaPhone : "",
        }),
      })

      const data = await response.json()
      if (!response.ok || !data.url) {
        setError(data.error ?? "Could not start secure checkout.")
        setSubmitting(false)
        return
      }

      window.location.href = data.url
    } catch {
      setError("We could not connect to the payment service. Please try again.")
      setSubmitting(false)
    }
  }

  const annualMonthlyEquivalent = selectedPlan.annualPriceUsd / 12
  const savings =
    selectedPlan.monthlyPriceUsd > 0
      ? Math.max(
          0,
          Math.round(
            ((selectedPlan.monthlyPriceUsd - annualMonthlyEquivalent) / selectedPlan.monthlyPriceUsd) * 100
          )
        )
      : 0

  return (
    <div className="dashboard-page-shell" style={{ maxWidth: 1040 }}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1
            style={{
              margin: "0 0 0.45rem",
              fontFamily: "var(--font-instrument-serif)",
              fontSize: "1.8rem",
              fontWeight: 400,
              color: "#F0EDE6",
            }}
          >
            Upgrade your plan
          </h1>
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-dm-sans)",
              fontSize: "0.92rem",
              color: "rgba(240,237,230,0.58)",
              lineHeight: 1.7,
            }}
          >
            Choose billing, review tax separately, then continue to secure card or M-Pesa checkout.
          </p>
        </div>
        <Link
          href="/dashboard/billing"
          className="rounded-full border border-[rgba(240,237,230,0.12)] px-4 py-2 text-sm font-semibold text-[rgba(240,237,230,0.72)] transition hover:text-white"
        >
          Back to billing
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <section className="rounded-[28px] border border-[rgba(240,237,230,0.08)] bg-[#141414] p-6 sm:p-7">
            <div className="mb-5">
              <p className="text-[0.8rem] font-semibold uppercase tracking-[0.14em] text-[rgba(240,237,230,0.45)]">
                Plan selection
              </p>
              <h2 className="mt-3 text-[1.5rem] font-semibold text-white">Pick the plan that fits your team</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {plans.map((plan) => {
                const active = plan.key === planKey
                return (
                  <button
                    key={plan.key}
                    type="button"
                    onClick={() => setPlanKey(plan.key)}
                    className={`rounded-[22px] border p-5 text-left transition ${
                      active
                        ? "border-[rgba(200,245,90,0.45)] bg-[rgba(200,245,90,0.08)]"
                        : "border-[rgba(240,237,230,0.08)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(240,237,230,0.18)]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className={`h-5 w-5 rounded-full border ${active ? "border-[#C8F55A]" : "border-[rgba(240,237,230,0.28)]"} flex items-center justify-center`}>
                        {active ? <span className="h-2.5 w-2.5 rounded-full bg-[#C8F55A]" /> : null}
                      </div>
                      {plan.key === "pro" ? (
                        <span className="rounded-full bg-[rgba(200,245,90,0.12)] px-3 py-1 text-xs font-semibold text-[#C8F55A]">
                          Popular
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-5 text-[1.15rem] font-semibold text-white">{plan.name}</p>
                    <p className="mt-2 text-sm text-[rgba(240,237,230,0.62)]">
                      {Math.round(plan.commissionRate * 100)}% paid-ticket commission
                    </p>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="rounded-[28px] border border-[rgba(240,237,230,0.08)] bg-[#141414] p-6 sm:p-7">
            <div className="mb-5">
              <p className="text-[0.8rem] font-semibold uppercase tracking-[0.14em] text-[rgba(240,237,230,0.45)]">
                Billing cycle
              </p>
              <h2 className="mt-3 text-[1.5rem] font-semibold text-white">{selectedPlan.name} plan</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {(["monthly", "annual"] as SubscriptionBillingCycle[]).map((cycle) => {
                const active = billingCycle === cycle
                const price =
                  cycle === "annual" ? selectedPlan.annualPriceUsd : selectedPlan.monthlyPriceUsd
                return (
                  <button
                    key={cycle}
                    type="button"
                    onClick={() => setBillingCycle(cycle)}
                    className={`rounded-[22px] border p-6 text-left transition ${
                      active
                        ? "border-[#C8F55A] bg-[rgba(200,245,90,0.08)]"
                        : "border-[rgba(240,237,230,0.1)] bg-[rgba(255,255,255,0.02)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className={`h-6 w-6 rounded-full border ${active ? "border-[#C8F55A]" : "border-[rgba(240,237,230,0.28)]"} flex items-center justify-center`}>
                        {active ? <span className="h-3 w-3 rounded-full bg-[#C8F55A]" /> : null}
                      </div>
                      {cycle === "annual" && savings > 0 ? (
                        <span className="rounded-full bg-[rgba(200,245,90,0.12)] px-3 py-1 text-xs font-semibold text-[#C8F55A]">
                          Save {savings}%
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-6 text-[1.65rem] font-semibold text-white">
                      {cycle === "monthly" ? "Monthly" : "Yearly"}
                    </p>
                    <p className="mt-2 text-[1.05rem] text-[rgba(240,237,230,0.74)]">
                      {formatUsd(price)}
                      {cycle === "monthly" ? "/month" : "/year"} + tax
                    </p>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="rounded-[28px] border border-[rgba(240,237,230,0.08)] bg-[#141414] p-6 sm:p-7">
            <div className="mb-5">
              <p className="text-[0.8rem] font-semibold uppercase tracking-[0.14em] text-[rgba(240,237,230,0.45)]">
                Payment method
              </p>
              <h2 className="mt-3 text-[1.5rem] font-semibold text-white">Choose how you want to pay</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {[
                {
                  key: "card" as const,
                  title: "Card checkout",
                  description: "Secure hosted checkout for Visa, Mastercard, and international cards charged in KES.",
                  icon: <CreditCard className="h-5 w-5" />,
                },
                {
                  key: "mpesa" as const,
                  title: "M-Pesa checkout",
                  description: "Secure mobile-money checkout for local payments in Kenya.",
                  icon: <Smartphone className="h-5 w-5" />,
                },
              ].map((option) => {
                const active = paymentMethod === option.key
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setPaymentMethod(normalizePaymentMethod(option.key))}
                    className={`rounded-[22px] border p-5 text-left transition ${
                      active
                        ? "border-[#C8F55A] bg-[rgba(200,245,90,0.08)]"
                        : "border-[rgba(240,237,230,0.08)] bg-[rgba(255,255,255,0.02)]"
                    }`}
                  >
                    <div className="flex items-center gap-3 text-white">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(255,255,255,0.04)]">
                        {option.icon}
                      </span>
                      <div>
                        <p className="font-semibold">{option.title}</p>
                        <p className="mt-1 text-sm text-[rgba(240,237,230,0.58)]">{option.description}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="mt-5 rounded-[20px] border border-[rgba(124,199,255,0.18)] bg-[rgba(124,199,255,0.06)] p-4 text-sm text-[#D8ECFF]">
              {paymentMethod === "card"
                ? "You will continue to a secure hosted payment page to enter your real card details. International cards are supported and settled in KES using today's billing rate."
                : "You will continue to a secure hosted payment page to complete M-Pesa checkout. The payable amount is shown in KES for mobile-money settlement."}
            </div>
          </section>

          <section className="rounded-[28px] border border-[rgba(240,237,230,0.08)] bg-[#141414] p-6 sm:p-7">
            <div className="mb-5">
              <p className="text-[0.8rem] font-semibold uppercase tracking-[0.14em] text-[rgba(240,237,230,0.45)]">
                Checkout details
              </p>
              <h2 className="mt-3 text-[1.5rem] font-semibold text-white">
                {paymentMethod === "card" ? "Secure card checkout" : "M-Pesa checkout"}
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-2 block text-sm font-medium text-[rgba(240,237,230,0.78)]">Account holder name</span>
                <input
                  value={payerName}
                  onChange={(event) => setPayerName(event.target.value)}
                  placeholder="Alpha Tech Solutions"
                  className="w-full rounded-[18px] border border-[rgba(240,237,230,0.12)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[rgba(240,237,230,0.32)] focus:border-[rgba(200,245,90,0.45)]"
                />
              </label>

              {paymentMethod === "mpesa" ? (
                <>
                  <label className="sm:col-span-2">
                    <span className="mb-2 block text-sm font-medium text-[rgba(240,237,230,0.78)]">M-Pesa number</span>
                    <input
                      value={mpesaPhone}
                      onChange={(event) => setMpesaPhone(event.target.value)}
                      inputMode="tel"
                      placeholder="07XX XXX XXX"
                      className="w-full rounded-[18px] border border-[rgba(240,237,230,0.12)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[rgba(240,237,230,0.32)] focus:border-[rgba(200,245,90,0.45)]"
                    />
                  </label>
                  <div className="sm:col-span-2 rounded-[20px] border border-[rgba(200,245,90,0.12)] bg-[rgba(200,245,90,0.05)] p-4 text-sm text-[rgba(240,237,230,0.66)]">
                    We will send the checkout prompt to this number after you continue. Use the Safaricom line that should approve the payment.
                  </div>
                </>
              ) : (
                <div className="sm:col-span-2 rounded-[20px] border border-[rgba(240,237,230,0.08)] bg-[rgba(255,255,255,0.02)] p-4">
                  <p className="text-sm font-semibold text-white">Accepted cards</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {["Visa", "Mastercard", "American Express", "Discover"].map((brand) => (
                      <span
                        key={brand}
                        className="rounded-full border border-[rgba(240,237,230,0.12)] px-3 py-1 text-xs font-semibold text-[rgba(240,237,230,0.72)]"
                      >
                        {brand}
                      </span>
                    ))}
                  </div>
                  <p className="mt-4 text-sm leading-6 text-[rgba(240,237,230,0.58)]">
                    Your real card number, expiry date, and CVC are collected on the secure Paystack card page after you continue. That keeps EventSlot out of raw card handling while still supporting prepaid and postpaid cards.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-[28px] border border-[rgba(240,237,230,0.08)] bg-[#141414] p-6 sm:p-7">
          <div className="flex items-center gap-3 text-[#C8F55A]">
            <ShieldCheck className="h-5 w-5" />
            <p className="text-[0.8rem] font-semibold uppercase tracking-[0.14em]">Order details</p>
          </div>

          <div className="mt-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-lg font-semibold text-white">{selectedPlan.name} plan</p>
              <p className="mt-1 text-sm text-[rgba(240,237,230,0.58)]">
                {billingCycle === "annual" ? "Annually" : "Monthly"}
              </p>
            </div>
            <p className="text-2xl font-semibold text-white">
              {formatUsd(billingCycle === "annual" ? selectedPlan.annualPriceUsd : selectedPlan.monthlyPriceUsd)}
            </p>
          </div>

          <div className="my-6 border-t border-[rgba(240,237,230,0.08)]" />

          <div className="space-y-4 text-[0.98rem]">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[rgba(240,237,230,0.68)]">Subtotal</span>
              <span className="font-semibold text-white">{formatUsd(quote.subtotalUsd)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[rgba(240,237,230,0.68)]">Tax 16%</span>
              <span className="font-semibold text-white">{formatUsd(quote.taxUsd)}</span>
            </div>
          </div>

          <div className="my-6 border-t border-[rgba(240,237,230,0.08)]" />

          <div className="flex items-center justify-between gap-4">
            <span className="text-[1.05rem] font-semibold text-white">Total due today</span>
            <span className="text-[1.5rem] font-semibold text-white">{formatUsd(quote.totalUsd)}</span>
          </div>

          <div className="mt-3 rounded-[18px] border border-[rgba(240,237,230,0.08)] bg-[rgba(255,255,255,0.02)] p-4 text-sm text-[rgba(240,237,230,0.62)]">
            <p className="font-semibold text-white">{accountName}</p>
            <p className="mt-1">{accountEmail}</p>
            <p className="mt-3 text-[#C8F55A]">
              {paymentMethod === "mpesa"
                ? `M-Pesa settlement estimate: ${formatKes(quote.totalKes)}`
                : `Card checkout settles in KES today: ${formatKes(quote.totalKes)}`}
            </p>
          </div>

          {error ? (
            <div className="mt-5 rounded-[18px] border border-[rgba(255,107,107,0.24)] bg-[rgba(255,107,107,0.08)] px-4 py-3 text-sm text-[#FFB6B6]">
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleCheckout}
            disabled={submitting || planIsCurrent}
            className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-[16px] px-4 py-3 text-sm font-semibold transition ${
              planIsCurrent
                ? "cursor-default border border-[rgba(200,245,90,0.18)] bg-[rgba(200,245,90,0.08)] text-[#C8F55A]"
                : "bg-[#C8F55A] text-[#0A0A0A] hover:bg-[#d4ff68]"
            }`}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {planIsCurrent
              ? "You are already on this plan"
              : paymentMethod === "card"
                ? "Continue to secure card checkout"
                : "Continue to secure M-Pesa checkout"}
          </button>

          <p className="mt-4 text-center text-xs leading-6 text-[rgba(240,237,230,0.46)]">
            Secure checkout is hosted by our payment provider. Organizer ticket funds remain separate from EventSlot subscription revenue.
          </p>
        </aside>
      </div>
    </div>
  )
}
