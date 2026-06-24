"use client"

import { PricingPlanSelector } from "@/components/billing/PricingPlanSelector"
import type { SubscriptionPlanDefinition } from "@/lib/subscriptionPlans"

export function BillingUpgradeSection({
  currentPlanKey,
  plans,
}: {
  currentPlanKey: string
  plans: SubscriptionPlanDefinition[]
}) {
  return (
    <section
      style={{
        background: "#141414",
        border: "0.5px solid rgba(240,237,230,0.08)",
        borderRadius: 24,
        padding: "1.5rem",
        marginBottom: "1rem",
      }}
    >
      <div style={{ marginBottom: "1.25rem" }}>
        <div>
          <h2 style={{ margin: "0 0 0.3rem", fontFamily: "var(--font-instrument-serif)", fontSize: "1.35rem", fontWeight: 400, color: "#F0EDE6" }}>
            Upgrade your plan
          </h2>
          <p style={{ margin: 0, fontSize: "0.88rem", color: "rgba(240,237,230,0.55)", fontFamily: "var(--font-dm-sans)", lineHeight: 1.7 }}>
            Pick a paid plan, review monthly or yearly billing clearly, then continue to secure checkout for card or M-Pesa.
          </p>
        </div>
      </div>
      <PricingPlanSelector plans={plans} currentPlanKey={currentPlanKey} signedIn mode="dashboard" />
    </section>
  )
}
