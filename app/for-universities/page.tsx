import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, CheckCircle2, GraduationCap } from "lucide-react"
import { MarketingFooter } from "@/components/MarketingFooter"
import SmartCTA from "@/components/SmartCTA"

export const metadata: Metadata = {
  title: "Event Registration for Universities and Campus Events",
  description:
    "EventSlot is the event registration platform built for universities, campuses, and student organisations. Manage campus events with automatic waitlists, team management, and zero spreadsheets.",
  alternates: { canonical: "https://www.eventsslot.com/for-universities" },
  openGraph: {
    title: "Event Registration for Universities and Campus Events",
    description:
      "The event management system for universities that handles registrations, waitlists, and attendee data for campus events automatically.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "EventSlot for Universities" }],
  },
}

const useCases = [
  "Orientation and welcome events",
  "Club and society signups",
  "Workshop and seminar registration",
  "Career fairs and networking sessions",
  "Sports tryouts and tournaments",
  "Cross-department event teams",
]

const reasons = [
  "Custom registration questions for each event",
  "Automatic waitlists when capacity is full",
  "Simple team access for student leaders and staff",
  "Mobile-friendly public pages that are easy to share",
  "Reporting and exports after the event",
  "Paid ticketing and free-event support in one product",
]

export default function ForUniversitiesPage() {
  return (
    <main className="min-h-screen bg-[var(--page-bg)] text-[var(--text-primary)]">
      <section className="marketing-shell px-4 pb-10 pt-8 sm:px-6 lg:px-8 lg:pb-16 lg:pt-12">
        <div className="marketing-panel overflow-hidden px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
            <div className="max-w-3xl">
              <div className="marketing-eyebrow">
                <span className="inline-flex h-2 w-2 rounded-full bg-[#C8F55A]" />
                For universities
              </div>
              <h1 className="marketing-page-title mt-6 font-semibold text-[var(--text-primary)]">
                Campus event registration that feels organised for both students and organisers.
              </h1>
              <p className="mt-6 max-w-2xl text-[1rem] leading-7 text-[var(--text-secondary)]">
                EventSlot helps universities and student teams replace ad hoc forms, message chains,
                and spreadsheet cleanup with a cleaner registration and attendance workflow.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <SmartCTA className="marketing-button-primary">
                  Try It Now
                  <ArrowRight className="h-4 w-4" />
                </SmartCTA>
                <Link href="/how-it-works" className="marketing-button-secondary">
                  See the workflow
                </Link>
              </div>
            </div>

            <div className="marketing-card">
              <div className="marketing-icon-wrap">
                <GraduationCap className="h-5 w-5 text-[#C8F55A]" />
              </div>
              <h2 className="mt-6 text-[1.2rem] font-semibold text-[var(--text-primary)]">Designed for busy teams</h2>
              <p className="mt-3 text-[0.96rem] leading-7 text-[var(--text-secondary)]">
                Useful for student leaders, department admins, clubs, and university programs that need a system people can actually use quickly.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-shell px-4 pb-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <div className="marketing-section-label">Use cases</div>
          <h2 className="marketing-section-title mt-4 font-semibold text-[var(--text-primary)]">
            One platform for the kinds of campus events that usually sprawl.
          </h2>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {useCases.map((item) => (
            <article key={item} className="marketing-card marketing-fade-up">
              <h3 className="text-[1.08rem] font-semibold text-[var(--text-primary)]">{item}</h3>
              <p className="mt-3 text-[0.95rem] leading-7 text-[var(--text-secondary)]">
                Keep signups, capacity, and attendee data in one place so your team is not rebuilding the process for every event.
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="marketing-shell">
          <div className="max-w-2xl">
            <div className="marketing-section-label">Why EventSlot</div>
            <h2 className="marketing-section-title mt-4 font-semibold text-[var(--text-primary)]">
              Simple enough for student organisers, structured enough for the institution.
            </h2>
          </div>
          <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {reasons.map((item) => (
              <div key={item} className="marketing-card flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#C8F55A]" />
                <span className="text-[0.96rem] leading-7 text-[var(--text-secondary)]">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-shell px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="marketing-panel overflow-hidden px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
          <div className="max-w-2xl">
            <div className="marketing-section-label">Start small or scale up</div>
            <h2 className="marketing-section-title mt-4 font-semibold text-[var(--text-primary)]">
              Free for simple events, stronger controls when your campus workload grows.
            </h2>
            <p className="mt-5 text-[1rem] leading-7 text-[var(--text-secondary)]">
              Start with a single student event, then keep using the same system for orientations, departmental workshops, and ticketed campus experiences.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <SmartCTA className="marketing-button-primary">Try It Now</SmartCTA>
              <Link href="/pricing" className="marketing-button-secondary">
                Compare plans
              </Link>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  )
}
