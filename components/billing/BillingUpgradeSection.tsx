"use client"

import { useMemo, useState } from "react"
import { MpesaPaymentModal } from "@/components/billing/MpesaPaymentModal"
import type { SubscriptionPlanDefinition } from "@/lib/subscriptionPlans"

type BillingCycle = "monthly" | "annual"

export function BillingUpgradeSection({
  currentPlanKey,
  plans,
}: {
  currentPlanKey: string
  plans: SubscriptionPlanDefinition[]
}) {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly")
  const [selectedPlanKey, setSelectedPlanKey] = useState<string | null>(null)
  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.key === selectedPlanKey) ?? null,
    [plans, selectedPlanKey]
  )

  return (
    <section
      style={{
        background: "#141414",
        border: "0.5px solid rgba(240,237,230,0.08)",
        borderRadius: 14,
        padding: "1.25rem",
        marginBottom: "1rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: "0 0 0.3rem", fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", fontWeight: 400, color: "#F0EDE6" }}>
            Upgrade your plan
          </h2>
          <p style={{ margin: 0, fontSize: "0.88rem", color: "rgba(240,237,230,0.55)", fontFamily: "var(--font-dm-sans)", lineHeight: 1.7 }}>
            Test the live M-Pesa upgrade flow here. Paid event commission still follows your active plan after payment clears.
          </p>
        </div>
        <div style={{ display: "inline-flex", padding: 4, borderRadius: 999, border: "0.5px solid rgba(240,237,230,0.08)", background: "#0F0F0F" }}>
          {(["monthly", "annual"] as BillingCycle[]).map((cycle) => (
            <button
              key={cycle}
              type="button"
              onClick={() => setBillingCycle(cycle)}
              style={{
                border: "none",
                borderRadius: 999,
                background: billingCycle === cycle ? "#C8F55A" : "transparent",
                color: billingCycle === cycle ? "#0A0A0A" : "rgba(240,237,230,0.62)",
                padding: "0.55rem 0.95rem",
                fontFamily: "var(--font-dm-sans)",
                fontSize: "0.82rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {cycle === "monthly" ? "Monthly" : "Annual"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gap: "0.85rem", marginTop: "1rem" }}>
        {plans
          .filter((plan) => plan.key !== "free")
          .map((plan) => {
            const isCurrent = currentPlanKey === plan.key
            const price = billingCycle === "annual" ? plan.annualPriceUsd : plan.monthlyPriceUsd

            return (
              <div
                key={plan.key}
                style={{
                  border: isCurrent ? "0.5px solid rgba(200,245,90,0.28)" : "0.5px solid rgba(240,237,230,0.08)",
                  background: isCurrent ? "rgba(200,245,90,0.05)" : "rgba(240,237,230,0.02)",
                  borderRadius: 10,
                  padding: "1rem",
                  display: "grid",
                  gap: "0.8rem",
                  gridTemplateColumns: "minmax(0,1fr) auto",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", flexWrap: "wrap" }}>
                    <p style={{ margin: 0, fontSize: "1rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", fontWeight: 700 }}>
                      {plan.name}
                    </p>
                    <span style={{ fontSize: "0.76rem", color: "#C8F55A", fontFamily: "var(--font-dm-sans)", fontWeight: 700 }}>
                      {Math.round(plan.commissionRate * 100)}% commission
                    </span>
                  </div>
                  <p style={{ margin: "0.3rem 0 0", fontSize: "0.82rem", color: "rgba(240,237,230,0.5)", fontFamily: "var(--font-dm-sans)" }}>
                    ${price}/{billingCycle === "annual" ? "year" : "month"}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isCurrent}
                  onClick={() => setSelectedPlanKey(plan.key)}
                  style={{
                    borderRadius: 999,
                    border: isCurrent ? "0.5px solid rgba(200,245,90,0.2)" : "0.5px solid rgba(200,245,90,0.28)",
                    background: isCurrent ? "rgba(200,245,90,0.08)" : "#C8F55A",
                    color: isCurrent ? "#C8F55A" : "#0A0A0A",
                    padding: "0.7rem 1rem",
                    fontFamily: "var(--font-dm-sans)",
                    fontSize: "0.82rem",
                    fontWeight: 800,
                    cursor: isCurrent ? "default" : "pointer",
                    opacity: isCurrent ? 0.7 : 1,
                  }}
                >
                  {isCurrent ? "Current plan" : "Upgrade with M-Pesa"}
                </button>
              </div>
            )
          })}
      </div>

      {selectedPlan ? (
        <MpesaPaymentModal
          isOpen={Boolean(selectedPlan)}
          onClose={() => setSelectedPlanKey(null)}
          onSuccess={() => window.location.reload()}
          plan={{
            name: selectedPlan.key,
            displayName: selectedPlan.name,
            monthlyPriceUsd: selectedPlan.monthlyPriceUsd,
            annualPriceUsd: selectedPlan.annualPriceUsd,
          }}
          billingCycle={billingCycle}
        />
      ) : null}
    </section>
  )
}
