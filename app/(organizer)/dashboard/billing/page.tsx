import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { SUBSCRIPTION_PLANS, formatCommissionRate, getSubscriptionPlan } from "@/lib/subscriptionPlans"
import { PaygSettingsCard } from "@/components/billing/PaygSettingsCard"
import { BillingUpgradeSection } from "@/components/billing/BillingUpgradeSection"
import { getPricingRolloutLabel, isPricingRolloutActive } from "@/lib/pricingRollout"

function formatPlanName(plan: string | null | undefined) {
  return getSubscriptionPlan(plan).name
}

function formatRenewalDate(value: Date | null | undefined) {
  if (!value) return "Not scheduled"
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value)
}

export default async function BillingPage() {
  const session = await getServerSession(authOptions)
  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          plan: true,
          billingCycle: true,
          planEndDate: true,
        },
      })
    : null

  const currentPlan = getSubscriptionPlan(user?.plan)
  const pricingActive = isPricingRolloutActive()

  return (
    <div className="dashboard-page-shell" style={{ maxWidth: 920 }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1
          style={{
            fontFamily: "var(--font-instrument-serif)",
            fontSize: "1.5rem",
            fontWeight: 400,
            color: "#F0EDE6",
            margin: "0 0 0.35rem",
            lineHeight: 1.1,
          }}
        >
          Billing
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: "0.9rem",
            color: "rgba(240,237,230,0.5)",
            fontFamily: "var(--font-dm-sans)",
            lineHeight: 1.7,
          }}
        >
          Your plan controls organiser limits and the commission EventSlot charges on paid ticket sales.
        </p>
      </div>

      <section
        style={{
          background: pricingActive ? "rgba(200,245,90,0.05)" : "rgba(124,199,255,0.08)",
          border: pricingActive ? "0.5px solid rgba(200,245,90,0.16)" : "0.5px solid rgba(124,199,255,0.18)",
          borderRadius: 14,
          padding: "1rem 1.1rem",
          marginBottom: "1rem",
        }}
      >
        <p style={{ margin: 0, fontSize: "0.88rem", color: pricingActive ? "rgba(240,237,230,0.72)" : "#D8ECFF", fontFamily: "var(--font-dm-sans)", lineHeight: 1.7 }}>
          {pricingActive
            ? "Plan-based attendee and event limits are now active across EventSlot."
            : `Your current events remain on open access until ${getPricingRolloutLabel()}. Limits and PAYG billing start then.`}
        </p>
      </section>

      <section
        style={{
          background: "#141414",
          border: "0.5px solid rgba(240,237,230,0.08)",
          borderRadius: 14,
          padding: "1.25rem",
          marginBottom: "1rem",
        }}
      >
        <div
          style={{
            display: "grid",
            gap: "1rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: "0.72rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(240,237,230,0.38)", fontFamily: "var(--font-dm-sans)" }}>
              Current plan
            </p>
            <p style={{ margin: "0.45rem 0 0", fontSize: "1.4rem", color: "#F0EDE6", fontFamily: "var(--font-instrument-serif)" }}>
              {formatPlanName(user?.plan)}
            </p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "0.72rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(240,237,230,0.38)", fontFamily: "var(--font-dm-sans)" }}>
              Billing cycle
            </p>
            <p style={{ margin: "0.45rem 0 0", fontSize: "1rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)" }}>
              {(user?.billingCycle ?? "MONTHLY").toString()}
            </p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "0.72rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(240,237,230,0.38)", fontFamily: "var(--font-dm-sans)" }}>
              Paid-event commission
            </p>
            <p style={{ margin: "0.45rem 0 0", fontSize: "1rem", color: "#C8F55A", fontFamily: "var(--font-dm-sans)", fontWeight: 600 }}>
              {formatCommissionRate(currentPlan.commissionRate)}
            </p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "0.72rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(240,237,230,0.38)", fontFamily: "var(--font-dm-sans)" }}>
              Next renewal
            </p>
            <p style={{ margin: "0.45rem 0 0", fontSize: "1rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)" }}>
              {formatRenewalDate(user?.planEndDate)}
            </p>
          </div>
        </div>
      </section>

      <BillingUpgradeSection currentPlanKey={currentPlan.key} plans={SUBSCRIPTION_PLANS} />

      <PaygSettingsCard />

      <section
        style={{
          background: "#141414",
          border: "0.5px solid rgba(240,237,230,0.08)",
          borderRadius: 14,
          padding: "1.25rem",
          marginBottom: "1rem",
        }}
      >
        <h2 style={{ margin: "0 0 0.9rem", fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", fontWeight: 400, color: "#F0EDE6" }}>
          Plan overview
        </h2>
        <div style={{ display: "grid", gap: "0.85rem" }}>
          {SUBSCRIPTION_PLANS.map((plan) => {
            const active = plan.key === currentPlan.key
            return (
              <div
                key={plan.key}
                style={{
                  border: active ? "0.5px solid rgba(200,245,90,0.32)" : "0.5px solid rgba(240,237,230,0.08)",
                  background: active ? "rgba(200,245,90,0.05)" : "rgba(240,237,230,0.02)",
                  borderRadius: 10,
                  padding: "1rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                  <div>
                    <p style={{ margin: 0, fontSize: "1rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", fontWeight: 600 }}>
                      {plan.name}
                    </p>
                    <p style={{ margin: "0.2rem 0 0", fontSize: "0.82rem", color: "rgba(240,237,230,0.45)", fontFamily: "var(--font-dm-sans)" }}>
                      ${plan.monthlyPriceUsd}/mo or ${plan.annualPriceUsd}/year
                    </p>
                  </div>
                  <div style={{ fontSize: "0.82rem", color: active ? "#C8F55A" : "rgba(240,237,230,0.52)", fontFamily: "var(--font-dm-sans)", fontWeight: 600 }}>
                    {formatCommissionRate(plan.commissionRate)} commission
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap", marginTop: "0.85rem", fontSize: "0.8rem", color: "rgba(240,237,230,0.62)", fontFamily: "var(--font-dm-sans)" }}>
                  <span>{plan.attendeesPerEvent} attendees / event</span>
                  <span>{plan.activeEvents} active events</span>
                  <span>{plan.organizerSeats} organiser seats</span>
                  <span>{plan.dataRetention} retention</span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section
        style={{
          background: "#141414",
          border: "0.5px solid rgba(240,237,230,0.08)",
          borderRadius: 14,
          padding: "1.25rem",
        }}
      >
        <h2 style={{ margin: "0 0 0.75rem", fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", fontWeight: 400, color: "#F0EDE6" }}>
          How billing works
        </h2>
        <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "rgba(240,237,230,0.58)", fontFamily: "var(--font-dm-sans)", fontSize: "0.88rem", lineHeight: 1.75 }}>
          <li>Free events remain free to run.</li>
          <li>Paid events use your plan&apos;s commission rate: Free 10%, Standard 8%, Pro 5%, Business 3%.</li>
          <li>Higher plans increase attendee limits, active events, retention windows, and organiser seats.</li>
          <li>Billing settings are shown here so you always know what rate applies before you launch paid ticketing.</li>
        </ul>
      </section>
    </div>
  )
}
