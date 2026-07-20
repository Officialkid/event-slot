import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, CheckCircle2, QrCode, Sparkles, Users2 } from "lucide-react"
import { MarketingFooter } from "@/components/MarketingFooter"
import SmartCTA from "@/components/SmartCTA"
import { MobileInstallButton } from "@/components/MobileInstallButton"
import { EarlyTesterPrompt } from "@/components/marketing/EarlyTesterPrompt"

export const metadata: Metadata = {
  title: "EventSlot - Smart Event Registration Platform with Built-in Waitlist",
  description:
    "The fastest event registration system with automatic waitlist management. Create an event, share one link, and let EventSlot handle registrations, confirmations, and waitlists automatically.",
  alternates: { canonical: "https://www.eventsslot.com" },
  openGraph: {
    title: "EventSlot - Smart Event Registration Platform with Built-in Waitlist",
    description:
      "Create events, share one link, and fill slots automatically. EventSlot manages registrations and waitlists without spreadsheets.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "EventSlot Event Registration Platform" }],
  },
}

const heroStats = [
  { label: "Setup time", value: "Under 10 min" },
  { label: "Check-in ready", value: "QR and walk-in" },
  { label: "Organizer view", value: "Live dashboard" },
]

const featureCards = [
  {
    icon: Users2,
    title: "Registrations and waitlist in one flow",
    description:
      "Keep capacity under control, promote waitlisted guests automatically, and stop chasing spreadsheets before every event.",
  },
  {
    icon: QrCode,
    title: "Fast door check-in for any crowd",
    description:
      "Use tickets, QR codes, or walk-in mode to move people through the entrance with a simple mobile-friendly flow.",
  },
  {
    icon: Sparkles,
    title: "Clean reporting after the event",
    description:
      "Track turnout, export attendance data, and see what actually happened so the next event starts from facts.",
  },
]

const workflowSteps = [
  {
    step: "01",
    title: "Create the event",
    text: "Set the format, dates, venue, capacity, and any attendee questions in one place.",
  },
  {
    step: "02",
    title: "Share one public link",
    text: "Invite attendees with a registration page or a walk-in QR flow that works well on mobile.",
  },
  {
    step: "03",
    title: "Run the day with confidence",
    text: "Watch check-ins, manage capacity, and keep organizers updated from the dashboard as the event moves.",
  },
]

const audiencePills = [
  "Campus events",
  "Church gatherings",
  "Workshops",
  "Conferences",
  "Limited-capacity events",
  "Open walk-ins",
]

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "EventSlot",
    alternateName: "Event Slot",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "EventSlot is an event registration platform built for organizers who run events with limited slots. Manage registrations, waitlists, and automatic confirmations.",
    url: "https://www.eventsslot.com",
    keywords: "eventslot, event slot, events slot, event registration platform, event waitlist system",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "KES",
      description: "Free plan available",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      reviewCount: "12",
    },
    featureList: [
      "Event registration management",
      "Automatic waitlist system",
      "QR code ticket generation",
      "Confirmation tickets",
      "Organizer dashboard",
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "EventSlot",
    alternateName: "Event Slot",
    url: "https://www.eventsslot.com",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: "https://www.eventsslot.com/search?q={search_term_string}",
      },
      "query-input": "required name=search_term_string",
    },
  },
]

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0A0A0A] text-[#F0EDE6]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <EarlyTesterPrompt />

      <section className="marketing-shell px-4 pb-10 pt-6 sm:px-6 lg:px-8 lg:pb-14 lg:pt-10">
        <div className="marketing-panel marketing-grid overflow-hidden px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
          <div className="relative z-10 grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center">
            <div className="marketing-fade-up max-w-2xl">
              <div className="marketing-eyebrow">
                <span className="inline-flex h-2 w-2 rounded-full bg-[#C8F55A]" />
                Built for modern event teams
              </div>

              <h1 className="marketing-display-title mt-6 max-w-3xl font-semibold text-white">
                Run registration, waitlist, and walk-in check-in from one sharp system.
              </h1>

              <p className="mt-6 max-w-xl text-[1rem] leading-7 text-[rgba(240,237,230,0.68)] sm:text-[1.05rem]">
                EventSlot helps teams launch events quickly, control capacity, and keep the day
                moving with a clean organizer dashboard that works on mobile too.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link href="/signup" className="marketing-button-primary">
                  Try It Now
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/pricing" className="marketing-button-secondary">
                  View pricing
                </Link>
                <div className="sm:w-auto">
                  <MobileInstallButton />
                </div>
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                {heroStats.map((item) => (
                  <div key={item.label} className="marketing-stat-block">
                    <div className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[rgba(240,237,230,0.42)]">
                      {item.label}
                    </div>
                    <div className="mt-2 text-[1.1rem] font-semibold text-white">{item.value}</div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap gap-2">
                {audiencePills.map((item) => (
                  <span key={item} className="marketing-chip">
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="marketing-fade-up marketing-fade-up-delay-1 relative">
              <div className="marketing-dashboard-frame">
                <div className="marketing-window-bar">
                  <span className="marketing-window-dot bg-[#F7685B]" />
                  <span className="marketing-window-dot bg-[#F2C94C]" />
                  <span className="marketing-window-dot bg-[#33D69F]" />
                  <span className="ml-3 text-[0.7rem] text-[rgba(240,237,230,0.45)]">
                    EventSlot organizer view
                  </span>
                </div>
                <div className="relative px-3 pb-3 pt-2 sm:px-4 sm:pb-4">
                  <div className="relative overflow-hidden rounded-[20px] border border-[rgba(240,237,230,0.08)] bg-[#0E0E0E]">
                    <Image
                      src="/assets/dashboard-laptop.png"
                      alt="EventSlot dashboard preview"
                      width={1400}
                      height={900}
                      priority
                      className="h-auto w-full object-cover"
                    />
                  </div>

                  <div className="absolute -bottom-4 right-0 hidden w-[34%] max-w-[220px] rounded-[22px] border border-[rgba(240,237,230,0.12)] bg-[rgba(10,10,10,0.92)] p-2 shadow-[0_24px_80px_rgba(0,0,0,0.4)] sm:block">
                    <div className="overflow-hidden rounded-[16px] border border-[rgba(240,237,230,0.08)] bg-[#111111]">
                      <Image
                        src="/assets/organizer-mobile.png"
                        alt="EventSlot mobile organizer preview"
                        width={520}
                        height={1000}
                        className="h-auto w-full object-cover"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[rgba(240,237,230,0.08)] bg-[#0D0F0C] px-4 py-5 sm:px-6 lg:px-8">
        <div className="marketing-shell flex flex-wrap items-center justify-between gap-4">
          <div className="text-[0.82rem] font-semibold uppercase tracking-[0.14em] text-[rgba(240,237,230,0.4)]">
            Registration events, waitlists, and walk-in attendance
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.92rem] text-[rgba(240,237,230,0.7)]">
            <span>Free events</span>
            <span>Ticket tiers</span>
            <span>Live dashboard</span>
            <span>Attendance exports</span>
          </div>
        </div>
      </section>

      <section id="benefits" className="marketing-shell px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
          <div className="max-w-xl">
            <div className="marketing-section-label">Core workflow</div>
            <h2 className="marketing-section-title mt-4 font-semibold text-white">
              Everything your team needs to build a calmer event day.
            </h2>
            <p className="mt-5 text-[1rem] leading-7 text-[rgba(240,237,230,0.66)]">
              The product is designed around the moments that usually get messy: filling limited
              slots, handling late demand, and counting who actually showed up.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {featureCards.map((card, index) => {
              const Icon = card.icon
              return (
                <article
                  key={card.title}
                  className={`marketing-card marketing-fade-up ${index === 2 ? "md:col-span-2" : ""}`}
                >
                  <div className="marketing-icon-wrap">
                    <Icon className="h-5 w-5 text-[#C8F55A]" />
                  </div>
                  <h3 className="mt-6 text-[1.2rem] font-semibold text-white">{card.title}</h3>
                  <p className="mt-3 max-w-xl text-[0.98rem] leading-7 text-[rgba(240,237,230,0.66)]">
                    {card.description}
                  </p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="marketing-shell px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
          <div className="marketing-card p-3 sm:p-4">
            <div className="overflow-hidden rounded-[22px] border border-[rgba(240,237,230,0.08)] bg-[#101010]">
              <Image
                src="/assets/event-checkin.png"
                alt="EventSlot walk-in check-in page"
                width={1200}
                height={820}
                className="h-auto w-full object-cover"
              />
            </div>
          </div>

          <div className="max-w-xl">
            <div className="marketing-section-label">Walk-in ready</div>
            <h2 className="marketing-section-title mt-4 font-semibold text-white">
              Open a QR code, collect check-ins, and watch the count rise live.
            </h2>
            <p className="mt-5 text-[1rem] leading-7 text-[rgba(240,237,230,0.66)]">
              Walk-in mode is built for real venues, not just tidy demos. Organizers can create the
              event early, print the code ahead of time, and let attendees check in quickly when the
              day arrives.
            </p>

            <ul className="mt-6 space-y-3">
              {[
                "Public mobile page for attendee check-in",
                "Duplicate-safe daily attendance counts",
                "Organizer dashboard with per-day totals",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-[0.98rem] text-[rgba(240,237,230,0.75)]">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#C8F55A]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-y border-[rgba(240,237,230,0.08)] bg-[#0C0D0B] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="marketing-shell">
          <div className="marketing-section-label">How it works</div>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {workflowSteps.map((item) => (
            <article key={item.step} className="marketing-card marketing-fade-up">
                <div className="text-[0.8rem] font-semibold uppercase tracking-[0.14em] text-[#C8F55A]">
                  Step {item.step}
                </div>
                <h3 className="mt-5 text-[1.2rem] font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-[0.98rem] leading-7 text-[rgba(240,237,230,0.66)]">
                  {item.text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="get-started" className="marketing-shell px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="marketing-panel overflow-hidden px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="max-w-2xl">
              <div className="marketing-section-label">Get started</div>
              <h2 className="marketing-section-title mt-4 font-semibold text-white">
                Launch the next event with a better front door.
              </h2>
              <p className="mt-5 text-[1rem] leading-7 text-[rgba(240,237,230,0.66)]">
                Start free, publish the event page, and give your team a cleaner way to manage
                registrations, attendance, and follow-up after the event.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <SmartCTA className="marketing-button-primary justify-center">
                Try It Now
              </SmartCTA>
              <Link href="/how-it-works" className="marketing-button-secondary">
                Explore the workflow
              </Link>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  )
}
