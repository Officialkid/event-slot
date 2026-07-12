"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Check } from "lucide-react"
import { isBillingCheckoutEnabled } from "@/lib/pricingRollout"
import type { SubscriptionPlanDefinition } from "@/lib/subscriptionPlans"
import { normalizeBillingCycle, type SubscriptionBillingCycle } from "@/lib/subscriptionBilling"

type PricingPlanSelectorProps = {
  plans: SubscriptionPlanDefinition[]
  currentPlanKey?: string | null
  signedIn?: boolean
  mode?: "marketing" | "dashboard"
  initialBillingCycle?: SubscriptionBillingCycle
}

const paidPlanKeys = new Set(["standard", "pro", "business"])

export function PricingPlanSelector({
  plans,
  currentPlanKey,
  signedIn = false,
  mode = "marketing",
  initialBillingCycle = "monthly",
}: PricingPlanSelectorProps) {
  const router = useRouter()
  const [billingCycle, setBillingCycle] = useState<SubscriptionBillingCycle>(
    normalizeBillingCycle(initialBillingCycle)
  )

  const paidPlans = useMemo(
    () => plans.filter((plan) => paidPlanKeys.has(plan.key)),
    [plans]
  )
  const billingEnabled = isBillingCheckoutEnabled()

  const handleChoosePlan = (planKey: string) => {
    if (!billingEnabled) return
    if (mode === "dashboard" || signedIn) {
      router.push(`/dashboard/billing/checkout?plan=${planKey}&cycle=${billingCycle}`)
      return
    }
    router.push("/signup")
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <div className="inline-flex rounded-full border border-[rgba(240,237,230,0.12)] bg-[rgba(255,255,255,0.03)] p-1">
          {(["monthly", "annual"] as SubscriptionBillingCycle[]).map((cycle) => {
            const active = billingCycle === cycle
            return (
              <button
                key={cycle}
                type="button"
                onClick={() => setBillingCycle(cycle)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-[#C8F55A] text-[#0A0A0A]"
                    : "text-[rgba(240,237,230,0.68)] hover:text-white"
                }`}
              >
                {cycle === "monthly" ? "Monthly" : "Yearly"}
              </button>
            )
          })}
        </div>
        <span className="rounded-full border border-[rgba(200,245,90,0.18)] bg-[rgba(200,245,90,0.08)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#C8F55A]">
          Tax shown separately
        </span>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {paidPlans.map((plan) => {
          const featured = plan.key === "pro"
          const isCurrent = currentPlanKey === plan.key
          const price =
            billingCycle === "annual" ? plan.annualPriceUsd : plan.monthlyPriceUsd
          const cadence = billingCycle === "annual" ? "/year" : "/month"
          const annualMonthlyEquivalent = plan.annualPriceUsd / 12
          const monthlySavings =
            plan.monthlyPriceUsd > 0
              ? Math.max(
                  0,
                  Math.round(
                    ((plan.monthlyPriceUsd - annualMonthlyEquivalent) / plan.monthlyPriceUsd) * 100
                  )
                )
              : 0

          return (
            <article
              key={plan.key}
              className={`relative flex h-full flex-col overflow-hidden rounded-[24px] border transition ${
                featured
                  ? "border-[rgba(200,245,90,0.4)] bg-[linear-gradient(180deg,rgba(200,245,90,0.14),rgba(17,17,17,0.98))] shadow-[0_24px_80px_rgba(200,245,90,0.08)]"
                  : "border-[rgba(240,237,230,0.12)] bg-[rgba(18,18,18,0.96)]"
              }`}
            >
              {featured ? (
                <div className="bg-[#C8F55A] px-4 py-3 text-center text-xs font-bold uppercase tracking-[0.18em] text-[#0A0A0A]">
                  Most popular
                </div>
              ) : null}

              <div className="flex flex-1 flex-col p-6 sm:p-7">
                <div className="text-center">
                  <h3 className="text-[1.65rem] font-semibold text-white">{plan.name}</h3>
                  <div className="mt-4 flex items-end justify-center gap-2">
                    <span className="text-[2.75rem] font-semibold leading-none text-white">
                      ${price}
                    </span>
                    <span className="pb-1 text-[0.95rem] text-[rgba(240,237,230,0.6)]">
                      {cadence}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-[rgba(240,237,230,0.58)]">
                    {Math.round(plan.commissionRate * 100)}% paid-ticket commission
                  </p>
                  {billingCycle === "annual" && monthlySavings > 0 ? (
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#C8F55A]">
                      Save {monthlySavings}% with annual billing
                    </p>
                  ) : null}
                </div>

                <ul className="mt-7 space-y-3 text-sm text-[rgba(240,237,230,0.72)]">
                  {plan.highlights.map((item) => (
                    <li key={item} className="flex gap-3">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#C8F55A]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-7 grid gap-2 rounded-[18px] border border-[rgba(240,237,230,0.08)] bg-[rgba(255,255,255,0.02)] p-4 text-sm text-[rgba(240,237,230,0.66)]">
                  <div className="flex items-center justify-between gap-4">
                    <span>Attendees / event</span>
                    <span className="font-semibold text-white">{plan.attendeesPerEvent}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Active events</span>
                    <span className="font-semibold text-white">{plan.activeEvents}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Organiser seats</span>
                    <span className="font-semibold text-white">{plan.organizerSeats}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleChoosePlan(plan.key)}
                  disabled={isCurrent || !billingEnabled}
                  className={`mt-7 inline-flex w-full items-center justify-center gap-2 rounded-[14px] px-4 py-3 text-sm font-semibold transition ${
                    isCurrent || !billingEnabled
                      ? "cursor-default border border-[rgba(200,245,90,0.18)] bg-[rgba(200,245,90,0.08)] text-[#C8F55A]"
                      : featured
                        ? "bg-[#C8F55A] text-[#0A0A0A] hover:bg-[#d3ff67]"
                        : "border border-[rgba(240,237,230,0.12)] bg-[rgba(255,255,255,0.03)] text-white hover:border-[rgba(200,245,90,0.35)] hover:text-[#C8F55A]"
                  }`}
                >
                  {isCurrent
                    ? "Current plan"
                    : !billingEnabled
                      ? "Coming soon"
                    : mode === "dashboard" || signedIn
                      ? "Continue"
                      : "Get started"}
                  {!isCurrent && billingEnabled ? <ArrowRight className="h-4 w-4" /> : null}
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
