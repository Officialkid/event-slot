import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { SUBSCRIPTION_PLANS, formatCommissionRate, getSubscriptionPlan } from "@/lib/subscriptionPlans"
import { PaygSettingsCard } from "@/components/billing/PaygSettingsCard"
import { BillingUpgradeSection } from "@/components/billing/BillingUpgradeSection"
import { BillingComingSoonBanner } from "@/components/billing/BillingComingSoonBanner"
import { getPricingRolloutLabel, isPricingRolloutActive } from "@/lib/pricingRollout"
import { ReportDownloadsCard } from "@/components/billing/ReportDownloadsCard"
import { REPORT_DOWNLOAD_PRICING } from "@/lib/plans"
import { EventPassSelector } from "@/components/billing/EventPassSelector"
import { normalizeOneTimePassTier } from "@/lib/oneTimePassCatalog"
import { isAdminEmail } from "@/lib/isAdmin"

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

function formatEventDate(value: Date | null | undefined) {
  if (!value) return "No event date set yet"
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value)
}

export default async function BillingPage() {
  const session = await getServerSession(authOptions)
  const isAdmin = isAdminEmail(session?.user?.email)
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

  const currentPlan = getSubscriptionPlan(isAdmin ? "business" : user?.plan)
  const pricingActive = isPricingRolloutActive()
  const reportDownloads = session?.user?.id
    ? await prisma.reportDownload.findUnique({
        where: { userId: session.user.id },
        select: {
          downloadsRemaining: true,
          totalPurchased: true,
        },
      })
    : null
  const eventPassCandidates = session?.user?.id
    ? await prisma.event.findMany({
        where: {
          organizerId: session.user.id,
          archived: false,
          accessType: { not: "WALK_IN" },
          status: { notIn: ["ARCHIVED", "CANCELLED"] },
        },
        select: {
          id: true,
          slug: true,
          title: true,
          eventDate: true,
          eventEndAt: true,
          eventPass: {
            select: {
              tier: true,
              status: true,
              expiresAt: true,
            },
          },
        },
        orderBy: [{ eventDate: "asc" }, { createdAt: "desc" }],
        take: 6,
      })
    : []

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

      <BillingComingSoonBanner isAdmin={isAdmin} compact />

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
              {isAdmin ? "Super Admin Access" : formatPlanName(user?.plan)}
            </p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "0.72rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(240,237,230,0.38)", fontFamily: "var(--font-dm-sans)" }}>
              Billing cycle
            </p>
            <p style={{ margin: "0.45rem 0 0", fontSize: "1rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)" }}>
              {isAdmin ? "Not applicable" : (user?.billingCycle ?? "MONTHLY").toString()}
            </p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "0.72rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(240,237,230,0.38)", fontFamily: "var(--font-dm-sans)" }}>
              Paid-event commission
            </p>
            <p style={{ margin: "0.45rem 0 0", fontSize: "1rem", color: "#C8F55A", fontFamily: "var(--font-dm-sans)", fontWeight: 600 }}>
              {isAdmin ? "Full system access" : formatCommissionRate(currentPlan.commissionRate)}
            </p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "0.72rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(240,237,230,0.38)", fontFamily: "var(--font-dm-sans)" }}>
              Next renewal
            </p>
            <p style={{ margin: "0.45rem 0 0", fontSize: "1rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)" }}>
              {isAdmin ? "Not applicable" : formatRenewalDate(user?.planEndDate)}
            </p>
          </div>
        </div>
      </section>

      <BillingUpgradeSection currentPlanKey={currentPlan.key} plans={SUBSCRIPTION_PLANS} />

      <ReportDownloadsCard
        bundles={Object.entries(REPORT_DOWNLOAD_PRICING).map(([key, bundle]) => ({
          key,
          amount: bundle.amount,
          downloads: bundle.downloads,
          label: bundle.label,
        }))}
        initialRemaining={reportDownloads?.downloadsRemaining ?? 0}
        initialTotalPurchased={reportDownloads?.totalPurchased ?? 0}
      />

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
        <div style={{ marginBottom: "1rem" }}>
          <h2 style={{ margin: "0 0 0.45rem", fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", fontWeight: 400, color: "#F0EDE6" }}>
            One-time event passes
          </h2>
          <p style={{ margin: 0, color: "rgba(240,237,230,0.56)", fontSize: "0.84rem", lineHeight: 1.65, fontFamily: "var(--font-dm-sans)", maxWidth: 700 }}>
            If you only want premium tools for one event instead of upgrading the whole account, pick that event here and activate a one-time pass directly from billing.
          </p>
        </div>

        {eventPassCandidates.length === 0 ? (
          <p style={{ margin: 0, color: "rgba(240,237,230,0.45)", fontSize: "0.84rem", fontFamily: "var(--font-dm-sans)" }}>
            No registration events are available yet. Create one first, then you can activate a one-time pass for it here.
          </p>
        ) : (
          <div style={{ display: "grid", gap: "0.9rem" }}>
            {eventPassCandidates.map((event) => {
              const activeTier = normalizeOneTimePassTier(event.eventPass?.tier ?? null)
              return (
                <div
                  key={event.id}
                  style={{
                    border: "0.5px solid rgba(240,237,230,0.08)",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.02)",
                    padding: "1rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.85rem" }}>
                    <div>
                      <p style={{ margin: 0, color: "#F0EDE6", fontSize: "0.98rem", fontWeight: 600, fontFamily: "var(--font-dm-sans)" }}>
                        {event.title}
                      </p>
                      <p style={{ margin: "0.25rem 0 0", color: "rgba(240,237,230,0.45)", fontSize: "0.78rem", fontFamily: "var(--font-dm-sans)" }}>
                        {formatEventDate(event.eventDate)} · <a href={`/dashboard/events/${event.slug}`} style={{ color: "#C8F55A", textDecoration: "none" }}>Open event dashboard</a>
                      </p>
                    </div>
                  </div>

                  <EventPassSelector
                    eventId={event.id}
                    eventTitle={event.title}
                    activeTier={activeTier}
                    activeStatus={event.eventPass?.status ?? null}
                    activeExpiresAt={event.eventPass?.expiresAt?.toISOString() ?? null}
                    purchaseCountHint
                    compact
                  />
                </div>
              )
            })}
          </div>
        )}
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
          <li>One-time event passes unlock premium tools for a single event without changing your whole account plan.</li>
          <li>Higher plans increase attendee limits, active events, retention windows, and organiser seats.</li>
          <li>Billing settings are shown here so you always know what rate applies before you launch paid ticketing.</li>
        </ul>
      </section>
    </div>
  )
}
