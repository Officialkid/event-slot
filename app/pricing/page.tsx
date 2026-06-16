import Link from "next/link"
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
      <section className="border-b border-[rgba(240,237,230,0.08)] px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-[0.8rem] font-semibold uppercase tracking-[0.18em] text-[#C8F55A]">
            Pricing
          </p>
          <div className="mt-4 max-w-3xl">
            <h1
              className="text-[2.6rem] leading-tight sm:text-[3.5rem]"
              style={{ fontFamily: "var(--font-instrument-serif)" }}
            >
              Simple plans for organisers, lower commission as you grow.
            </h1>
            <p className="mt-5 max-w-2xl text-[1.02rem] leading-8 text-[rgba(240,237,230,0.62)]">
              EventSlot gives every organiser a free starting point, then rewards heavier usage with
              better tools and lower paid-event commission rates.
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/signin"
              className="inline-flex min-h-[48px] items-center justify-center rounded-[8px] bg-[#C8F55A] px-5 text-[0.95rem] font-semibold text-[#0A0A0A]"
            >
              Get started
            </Link>
            <Link
              href="/dashboard/events/new"
              className="inline-flex min-h-[48px] items-center justify-center rounded-[8px] border border-[rgba(240,237,230,0.16)] px-5 text-[0.95rem] font-semibold text-[#F0EDE6]"
            >
              Create an event
            </Link>
          </div>
        </div>
      </section>

      <section className="px-5 py-12 sm:px-8">
        <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-4">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <article
              key={plan.key}
              className={`rounded-[8px] border p-6 ${
                plan.key === "pro"
                  ? "border-[rgba(200,245,90,0.35)] bg-[rgba(200,245,90,0.05)]"
                  : "border-[rgba(240,237,230,0.08)] bg-[#111111]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2
                    className="text-[1.5rem]"
                    style={{ fontFamily: "var(--font-instrument-serif)" }}
                  >
                    {plan.name}
                  </h2>
                  <p className="mt-2 text-[0.9rem] text-[rgba(240,237,230,0.52)]">
                    ${plan.monthlyPriceUsd}/month
                  </p>
                </div>
                <span className="rounded-full border border-[rgba(240,237,230,0.12)] px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[#C8F55A]">
                  {formatCommissionRate(plan.commissionRate)} commission
                </span>
              </div>

              <ul className="mt-6 space-y-3 text-[0.92rem] leading-7 text-[rgba(240,237,230,0.72)]">
                {plan.highlights.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-[#C8F55A]">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-[rgba(240,237,230,0.08)] px-5 py-12 sm:px-8">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-[8px] border border-[rgba(240,237,230,0.08)]">
          <div className="grid grid-cols-5 border-b border-[rgba(240,237,230,0.08)] bg-[#121212]">
            <div className="px-4 py-4 text-[0.82rem] font-semibold uppercase tracking-[0.08em] text-[rgba(240,237,230,0.5)]">
              Feature
            </div>
            {SUBSCRIPTION_PLANS.map((plan) => (
              <div
                key={plan.key}
                className="px-4 py-4 text-center text-[0.92rem] font-semibold text-[#F0EDE6]"
              >
                {plan.name}
              </div>
            ))}
          </div>

          {comparisonRows.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-5 border-b border-[rgba(240,237,230,0.06)] last:border-b-0"
            >
              <div className="px-4 py-4 text-[0.92rem] text-[rgba(240,237,230,0.66)]">
                {row.label}
              </div>
              {SUBSCRIPTION_PLANS.map((plan) => (
                <div key={plan.key} className="px-4 py-4 text-center text-[0.92rem] text-[#F0EDE6]">
                  {plan[row.key]}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
