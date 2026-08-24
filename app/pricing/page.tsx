import { getServerSession } from "next-auth"
import Link from "next/link"
import { ArrowRight, ShieldCheck } from "lucide-react"
import { MarketingFooter } from "@/components/MarketingFooter"
import { authOptions } from "@/lib/auth"
import { PricingPlanSelector } from "@/components/billing/PricingPlanSelector"
import { SUBSCRIPTION_PLANS, formatCommissionRate } from "@/lib/subscriptionPlans"

const comparisonRows: Array<{
  label: string
  key: "attendeesPerEvent" | "waitlistCap" | "activeEvents" | "organizerSeats" | "dataRetention"
}> = [
  { label: "Attendees / event", key: "attendeesPerEvent" },
  { label: "Waitlist cap", key: "waitlistCap" },
  { label: "Active events", key: "activeEvents" },
  { label: "Organiser seats", key: "organizerSeats" },
  { label: "Data retention", key: "dataRetention" },
]

export default async function PricingPage() {
  const session = await getServerSession(authOptions)

  return (
    <main className="min-h-screen bg-[var(--page-bg)] text-[var(--text-primary)]">
      <section className="marketing-shell px-4 pb-10 pt-8 sm:px-6 lg:px-8 lg:pb-16 lg:pt-12">
        <div className="marketing-panel overflow-hidden px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
          <div className="mx-auto max-w-4xl text-center">
            <div className="max-w-3xl mx-auto">
              <div className="marketing-eyebrow">
                <span className="inline-flex h-2 w-2 rounded-full bg-[#C8F55A]" />
                Pricing
              </div>
              <h1 className="marketing-page-title mt-6 font-semibold text-[var(--text-primary)]">
                Plans are being prepared for the live rollout.
              </h1>
              <p className="mt-6 max-w-2xl text-[1rem] leading-7 text-[var(--text-secondary)]">
                EventSlot is currently available on the free plan while we finish the live billing rollout. You can still review the planned tiers below, but payment and upgrade tools remain paused for now.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href={session ? "/dashboard" : "/signup"} className="marketing-button-primary">
                  {session ? "Open dashboard" : "Try It Now"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/how-it-works" className="marketing-button-secondary">
                  See how it works
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-shell px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-[24px] border border-[var(--border-subtle)] bg-[linear-gradient(135deg,var(--surface-muted),rgba(200,245,90,0.08))] px-5 py-5 text-sm leading-7 text-[var(--text-secondary)]">
          <div className="flex items-center gap-3 text-[#C8F55A]">
            <ShieldCheck className="h-5 w-5" />
            <span className="font-semibold uppercase tracking-[0.14em]">Planned rollout bands</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {SUBSCRIPTION_PLANS.map((plan) => (
              <span
                key={plan.key}
                className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text-primary)]"
              >
                {plan.name}: <span className="font-semibold text-[#C8F55A]">{formatCommissionRate(plan.commissionRate)}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="mb-5 rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface)] px-5 py-4 text-sm text-[var(--text-secondary)]">
          Free plan stays available while billing is under maintenance. The tiers below are shared for planning only until the live rollout is ready.
        </div>

        <PricingPlanSelector
          plans={SUBSCRIPTION_PLANS}
          signedIn={Boolean(session?.user?.id)}
          currentPlanKey={session?.user?.plan ?? null}
          mode="marketing"
        />
      </section>

      <section className="border-y border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-16 sm:px-6 lg:px-8">
        <div className="marketing-shell">
          <div className="max-w-2xl">
            <div className="marketing-section-label">Plan comparison</div>
            <h2 className="marketing-section-title mt-4 font-semibold text-[var(--text-primary)]">
              Compare the planned limits before the billing rollout opens.
            </h2>
          </div>

          <div className="mt-8 overflow-hidden rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface)]">
            <div className="hidden grid-cols-5 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] lg:grid">
              <div className="px-5 py-4 text-[0.8rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Feature
              </div>
              {SUBSCRIPTION_PLANS.map((plan) => (
                <div key={plan.key} className="px-5 py-4 text-center text-[0.92rem] font-semibold text-[var(--text-primary)]">
                  {plan.name}
                </div>
              ))}
            </div>

            <div className="lg:hidden">
              {comparisonRows.map((row) => (
                <div key={row.label} className="border-b border-[var(--border-subtle)] px-5 py-5 last:border-b-0">
                  <div className="text-[0.84rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    {row.label}
                  </div>
                  <div className="mt-4 grid gap-3">
                    {SUBSCRIPTION_PLANS.map((plan) => (
                      <div
                        key={plan.key}
                        className="flex items-center justify-between rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3"
                      >
                        <span className="text-[0.9rem] text-[var(--text-secondary)]">{plan.name}</span>
                        <span className="text-[0.95rem] text-[var(--text-primary)]">{plan[row.key]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden lg:block">
              {comparisonRows.map((row) => (
                <div
                  key={row.label}
                  className="grid grid-cols-5 border-b border-[var(--border-subtle)] last:border-b-0"
                >
                  <div className="px-5 py-4 text-[0.94rem] text-[var(--text-secondary)]">
                    {row.label}
                  </div>
                  {SUBSCRIPTION_PLANS.map((plan) => (
                    <div key={plan.key} className="px-5 py-4 text-center text-[0.94rem] text-[var(--text-primary)]">
                      {plan[row.key]}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  )
}
