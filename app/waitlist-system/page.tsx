import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, CheckCircle2, Clock3 } from "lucide-react"
import { MarketingFooter } from "@/components/MarketingFooter"
import SmartCTA from "@/components/SmartCTA"

export const metadata: Metadata = {
  title: "Event Waitlist System - Auto-confirm When Slots Open",
  description:
    "EventSlot's event waitlist system automatically promotes and confirms waitlisted attendees the moment a slot opens. No manual follow-up and no missed registrations.",
  alternates: { canonical: "https://www.eventsslot.com/waitlist-system" },
  openGraph: {
    title: "Event Waitlist System - Auto-confirm When Slots Open",
    description:
      "Automatic waitlist management for events. When a slot opens, EventSlot promotes the next person in the queue and notifies them.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "EventSlot Waitlist System" }],
  },
}

const features = [
  "Automatic queueing after capacity is full",
  "Instant promotion when a place opens",
  "Clear attendee position without manual follow-up",
  "Capacity increases fill in order automatically",
  "Captures demand instead of losing it at sold out",
  "Works for small community events and large conferences",
]

export default function WaitlistSystemPage() {
  return (
    <main className="min-h-screen bg-[var(--page-bg)] text-[var(--text-primary)]">
      <section className="marketing-shell px-4 pb-10 pt-8 sm:px-6 lg:px-8 lg:pb-16 lg:pt-12">
        <div className="marketing-panel overflow-hidden px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
            <div className="max-w-3xl">
              <div className="marketing-eyebrow">
                <span className="inline-flex h-2 w-2 rounded-full bg-[#C8F55A]" />
                Waitlist system
              </div>
              <h1 className="marketing-page-title mt-6 font-semibold text-[var(--text-primary)]">
                Never lose an interested attendee just because the event filled up first.
              </h1>
              <p className="mt-6 max-w-2xl text-[1rem] leading-7 text-[var(--text-secondary)]">
                EventSlot keeps demand alive after capacity is reached by placing people in a live queue and promoting them automatically when places open.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <SmartCTA className="marketing-button-primary">
                  Try It Now
                  <ArrowRight className="h-4 w-4" />
                </SmartCTA>
                <Link href="/how-it-works" className="marketing-button-secondary">
                  Explore workflow
                </Link>
              </div>
            </div>

            <div className="marketing-card">
              <div className="marketing-icon-wrap">
                <Clock3 className="h-5 w-5 text-[#C8F55A]" />
              </div>
              <h2 className="mt-6 text-[1.2rem] font-semibold text-[var(--text-primary)]">Automatic by design</h2>
              <p className="mt-3 text-[0.96rem] leading-7 text-[var(--text-secondary)]">
                No spreadsheet queue, no manual WhatsApp follow-up, and no guessing who should be next.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-shell px-4 pb-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <div className="marketing-section-label">What it does</div>
          <h2 className="marketing-section-title mt-4 font-semibold text-[var(--text-primary)]">
            A waitlist that behaves like part of the product, not an afterthought.
          </h2>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {features.map((item) => (
            <article key={item} className="marketing-card marketing-fade-up flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#C8F55A]" />
              <span className="text-[0.96rem] leading-7 text-[var(--text-secondary)]">{item}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="marketing-shell">
          <div className="max-w-2xl">
            <div className="marketing-section-label">Why it matters</div>
            <h2 className="marketing-section-title mt-4 font-semibold text-[var(--text-primary)]">
              Interest should convert into attendance whenever space becomes available.
            </h2>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <article className="marketing-card">
              <h3 className="text-[1.08rem] font-semibold text-[var(--text-primary)]">Without a real waitlist</h3>
              <p className="mt-3 text-[0.96rem] leading-7 text-[var(--text-secondary)]">
                Sold-out pages close the door too early, organisers do manual follow-up, and interested attendees disappear.
              </p>
            </article>
            <article className="marketing-card">
              <h3 className="text-[1.08rem] font-semibold text-[var(--text-primary)]">With EventSlot</h3>
              <p className="mt-3 text-[0.96rem] leading-7 text-[var(--text-secondary)]">
                The queue stays orderly, positions stay clear, and newly opened capacity is filled automatically in the right order.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="marketing-shell px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="marketing-panel overflow-hidden px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
          <div className="max-w-2xl">
            <div className="marketing-section-label">Ready</div>
            <h2 className="marketing-section-title mt-4 font-semibold text-[var(--text-primary)]">
              Start with a free event and let the waitlist work from day one.
            </h2>
            <p className="mt-5 text-[1rem] leading-7 text-[var(--text-secondary)]">
              The goal is not complexity. It is simply to keep organisers calmer and events fuller.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <SmartCTA className="marketing-button-primary">Try It Now</SmartCTA>
              <Link href="/pricing" className="marketing-button-secondary">
                View pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  )
}
