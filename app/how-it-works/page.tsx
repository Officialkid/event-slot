import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, CheckCircle2 } from "lucide-react"
import { MarketingFooter } from "@/components/MarketingFooter"
import SmartCTA from "@/components/SmartCTA"

export const metadata: Metadata = {
  title: "How EventSlot Works - Event Registration System",
  description:
    "See how EventSlot's event registration system works in 5 simple steps: create your event, share a link, fill slots, overflow to waitlist, and auto-confirm attendees.",
  alternates: { canonical: "https://www.eventsslot.com/how-it-works" },
  openGraph: {
    title: "How EventSlot Works - Event Registration System",
    description:
      "5-step walkthrough of EventSlot's event registration platform from creating your event to auto-confirming waitlisted attendees.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "How EventSlot Works" }],
  },
}

const steps = [
  {
    n: "01",
    title: "Create your event",
    body: "Set the title, date, venue, capacity, pricing, and attendee questions. Your public page is ready quickly without custom setup.",
  },
  {
    n: "02",
    title: "Share one link",
    body: "Post the registration page anywhere your audience already is, from WhatsApp and Instagram to email, websites, and posters.",
  },
  {
    n: "03",
    title: "Fill slots cleanly",
    body: "Confirmed places update in real time while EventSlot keeps the organizer view tidy and easy to follow.",
  },
  {
    n: "04",
    title: "Overflow goes to waitlist",
    body: "Once the event is full, new demand is captured automatically so nobody gets lost and the queue stays fair.",
  },
  {
    n: "05",
    title: "Promote and report",
    body: "When places open, waitlisted attendees can be promoted automatically, and after the event you can review attendance and exports.",
  },
]

const audiences = [
  "Universities and campuses",
  "Churches and ministries",
  "Corporate training teams",
  "Community organisers",
  "Sports events",
  "Conference hosts",
]

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-[var(--page-bg)] text-[var(--text-primary)]">
      <section className="marketing-shell px-4 pb-10 pt-8 sm:px-6 lg:px-8 lg:pb-16 lg:pt-12">
        <div className="marketing-panel overflow-hidden px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
          <div className="max-w-3xl">
            <div className="marketing-eyebrow">
              <span className="inline-flex h-2 w-2 rounded-full bg-[#C8F55A]" />
              How it works
            </div>
            <h1 className="marketing-page-title mt-6 font-semibold text-[var(--text-primary)]">
              A simple event flow that feels organised from the first signup to the final check-in.
            </h1>
            <p className="mt-6 max-w-2xl text-[1rem] leading-7 text-[var(--text-secondary)]">
              EventSlot replaces the usual mix of forms, chats, spreadsheets, and manual follow-up
              with one cleaner system. Here is the flow your team and your attendees actually move through.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <SmartCTA className="marketing-button-primary">
                Try It Now
                <ArrowRight className="h-4 w-4" />
              </SmartCTA>
              <Link href="/pricing" className="marketing-button-secondary">
                View pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-shell px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
        <div className="grid gap-4">
          {steps.map((step) => (
            <article
              key={step.n}
              className="marketing-card marketing-fade-up grid gap-5 md:grid-cols-[72px_minmax(0,1fr)] md:items-start"
            >
              <div className="text-[3rem] font-semibold leading-none text-[rgba(200,245,90,0.2)]">
                {step.n}
              </div>
              <div>
                <h2 className="text-[1.2rem] font-semibold text-[var(--text-primary)]">{step.title}</h2>
                <p className="mt-3 max-w-3xl text-[0.98rem] leading-7 text-[var(--text-secondary)]">
                  {step.body}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="marketing-shell">
          <div className="max-w-2xl">
            <div className="marketing-section-label">Who this fits</div>
            <h2 className="marketing-section-title mt-4 font-semibold text-[var(--text-primary)]">
              Built for teams that need control without adding complexity.
            </h2>
          </div>
          <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {audiences.map((audience) => (
              <div key={audience} className="marketing-card flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#C8F55A]" />
                <span className="text-[0.96rem] text-[var(--text-secondary)]">{audience}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-shell px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="marketing-panel overflow-hidden px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
          <div className="max-w-2xl">
            <div className="marketing-section-label">Ready to start</div>
            <h2 className="marketing-section-title mt-4 font-semibold text-[var(--text-primary)]">
              Use the same calm workflow for your next event.
            </h2>
            <p className="mt-5 text-[1rem] leading-7 text-[var(--text-secondary)]">
              Start with a free event, add ticketing when needed, and keep the attendee experience clear on both web and mobile.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <SmartCTA className="marketing-button-primary">Try It Now</SmartCTA>
              <Link href="/waitlist-system" className="marketing-button-secondary">
                Explore waitlist mode
              </Link>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  )
}
