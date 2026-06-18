import Link from "next/link"
import { ArrowRight, Check, ShieldCheck } from "lucide-react"
import { MarketingFooter } from "@/components/MarketingFooter"
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

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0A] text-[#F0EDE6]">
      <section className="marketing-shell px-4 pb-10 pt-8 sm:px-6 lg:px-8 lg:pb-16 lg:pt-12">
        <div className="marketing-panel overflow-hidden px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.46fr)] lg:items-end">
            <div className="max-w-3xl">
              <div className="marketing-eyebrow">
                <span className="inline-flex h-2 w-2 rounded-full bg-[#C8F55A]" />
                Pricing
              </div>
              <h1 className="marketing-page-title mt-6 font-semibold text-white">
                Start free now, then keep more of each paid ticket as you grow.
              </h1>
              <p className="mt-6 max-w-2xl text-[1rem] leading-7 text-[rgba(240,237,230,0.66)]">
                EventSlot keeps entry simple for new organizers and rewards teams that run more
                events with lower commission and stronger account limits.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/signup" className="marketing-button-primary">
                  Try It Now
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/how-it-works" className="marketing-button-secondary">
                  See how it works
                </Link>
              </div>
            </div>

            <div className="marketing-card">
              <div className="flex items-center gap-3 text-[#C8F55A]">
                <ShieldCheck className="h-5 w-5" />
                <span className="text-[0.88rem] font-semibold uppercase tracking-[0.14em]">
                  Commission bands
                </span>
              </div>
              <div className="mt-5 space-y-4">
                {SUBSCRIPTION_PLANS.map((plan) => (
                  <div
                    key={plan.key}
                    className="flex items-center justify-between rounded-[14px] border border-[rgba(240,237,230,0.08)] bg-[rgba(255,255,255,0.02)] px-4 py-3"
                  >
                    <span className="text-[0.95rem] text-white">{plan.name}</span>
                    <span className="text-[1.05rem] font-semibold text-[#C8F55A]">
                      {formatCommissionRate(plan.commissionRate)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-shell px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid gap-4 xl:grid-cols-4">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <article
              key={plan.key}
              className={`marketing-card marketing-fade-up flex h-full flex-col ${
                plan.key === "pro"
                  ? "border-[rgba(200,245,90,0.28)] bg-[linear-gradient(180deg,rgba(200,245,90,0.12),rgba(255,255,255,0.03))]"
                  : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[1.55rem] font-semibold text-white">{plan.name}</h2>
                  <p className="mt-2 text-[0.95rem] text-[rgba(240,237,230,0.52)]">
                    ${plan.monthlyPriceUsd}/month
                  </p>
                </div>
                <span className="rounded-full border border-[rgba(240,237,230,0.12)] px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[#C8F55A]">
                  {formatCommissionRate(plan.commissionRate)}
                </span>
              </div>

              <ul className="mt-6 space-y-3 text-[0.96rem] leading-7 text-[rgba(240,237,230,0.72)]">
                {plan.highlights.map((item) => (
                  <li key={item} className="flex gap-3">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-[#C8F55A]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <Link href="/signup" className="marketing-button-secondary w-full justify-center">
                  Choose {plan.name}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-[rgba(240,237,230,0.08)] bg-[#0D0F0C] px-4 py-16 sm:px-6 lg:px-8">
        <div className="marketing-shell">
          <div className="max-w-2xl">
            <div className="marketing-section-label">Plan comparison</div>
            <h2 className="marketing-section-title mt-4 font-semibold text-white">
              Compare the limits that matter before you choose a plan.
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
