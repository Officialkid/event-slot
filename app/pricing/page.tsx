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
    <main className="min-h-screen bg-[#0A0A0A] text-[#F0EDE6]">
      <section className="marketing-shell px-4 pb-10 pt-8 sm:px-6 lg:px-8 lg:pb-16 lg:pt-12">
        <div className="marketing-panel overflow-hidden px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
          <div className="mx-auto max-w-4xl text-center">
            <div className="max-w-3xl mx-auto">
              <div className="marketing-eyebrow">
                <span className="inline-flex h-2 w-2 rounded-full bg-[#C8F55A]" />
                Pricing
              </div>
              <h1 className="marketing-page-title mt-6 font-semibold text-white">
                Plans are being prepared for the live rollout.
              </h1>
              <p className="mt-6 max-w-2xl text-[1rem] leading-7 text-[rgba(240,237,230,0.66)]">
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
        <div className="mb-8 rounded-[24px] border border-[rgba(124,199,255,0.16)] bg-[linear-gradient(135deg,rgba(124,199,255,0.1),rgba(200,245,90,0.04))] px-5 py-5 text-sm leading-7 text-[rgba(240,237,230,0.72)]">
          <div className="flex items-center gap-3 text-[#C8F55A]">
            <ShieldCheck className="h-5 w-5" />
            <span className="font-semibold uppercase tracking-[0.14em]">Planned rollout bands</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {SUBSCRIPTION_PLANS.map((plan) => (
              <span
                key={plan.key}
                className="rounded-full border border-[rgba(240,237,230,0.1)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-sm text-white"
              >
                {plan.name}: <span className="font-semibold text-[#C8F55A]">{formatCommissionRate(plan.commissionRate)}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="mb-5 rounded-[22px] border border-[rgba(240,237,230,0.08)] bg-[rgba(255,255,255,0.02)] px-5 py-4 text-sm text-[rgba(240,237,230,0.68)]">
          Free plan stays available while billing is under maintenance. The tiers below are shared for planning only until the live rollout is ready.
        </div>

        <PricingPlanSelector
          plans={SUBSCRIPTION_PLANS}
          signedIn={Boolean(session?.user?.id)}
          currentPlanKey={session?.user?.plan ?? null}
          mode="marketing"
        />
      </section>

      <section className="border-y border-[rgba(240,237,230,0.08)] bg-[#0D0F0C] px-4 py-16 sm:px-6 lg:px-8">
        <div className="marketing-shell">
          <div className="max-w-2xl">
            <div className="marketing-section-label">Plan comparison</div>
            <h2 className="marketing-section-title mt-4 font-semibold text-white">
              Compare the planned limits before the billing rollout opens.
            </h2>
          </div>

          <div className="mt-8 overflow-hidden rounded-[24px] border border-[rgba(240,237,230,0.08)] bg-[#111311]">
            <div className="hidden grid-cols-5 border-b border-[rgba(240,237,230,0.08)] bg-[rgba(255,255,255,0.02)] lg:grid">
              <div className="px-5 py-4 text-[0.8rem] font-semibold uppercase tracking-[0.12em] text-[rgba(240,237,230,0.45)]">
                Feature
              </div>
              {SUBSCRIPTION_PLANS.map((plan) => (
                <div key={plan.key} className="px-5 py-4 text-center text-[0.92rem] font-semibold text-white">
                  {plan.name}
                </div>
              ))}
            </div>

            <div className="lg:hidden">
              {comparisonRows.map((row) => (
                <div key={row.label} className="border-b border-[rgba(240,237,230,0.08)] px-5 py-5 last:border-b-0">
                  <div className="text-[0.84rem] font-semibold uppercase tracking-[0.12em] text-[rgba(240,237,230,0.45)]">
                    {row.label}
                  </div>
                  <div className="mt-4 grid gap-3">
                    {SUBSCRIPTION_PLANS.map((plan) => (
                      <div
                        key={plan.key}
                        className="flex items-center justify-between rounded-[14px] border border-[rgba(240,237,230,0.08)] bg-[rgba(255,255,255,0.02)] px-4 py-3"
                      >
                        <span className="text-[0.9rem] text-[rgba(240,237,230,0.68)]">{plan.name}</span>
                        <span className="text-[0.95rem] text-white">{plan[row.key]}</span>
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
                  className="grid grid-cols-5 border-b border-[rgba(240,237,230,0.06)] last:border-b-0"
                >
                  <div className="px-5 py-4 text-[0.94rem] text-[rgba(240,237,230,0.68)]">
                    {row.label}
                  </div>
                  {SUBSCRIPTION_PLANS.map((plan) => (
                    <div key={plan.key} className="px-5 py-4 text-center text-[0.94rem] text-white">
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
