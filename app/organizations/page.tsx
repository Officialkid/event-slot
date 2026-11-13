import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  CheckCircle2,
  Building2,
  Users,
  ShieldCheck,
  Ticket,
  Sparkles,
  QrCode,
  Calendar,
  Layers,
  ChevronRight,
  Headphones,
  GraduationCap,
  Briefcase,
  Palette,
  HeartHandshake,
} from "lucide-react"
import { MarketingFooter } from "@/components/MarketingFooter"
import SmartCTA from "@/components/SmartCTA"

export const metadata: Metadata = {
  title: "EventSlot Organization — Multi-User Workspaces, Verified Handles & E-Tickets",
  description:
    "Scale your events with an EventSlot Organization. Host under verified brand handles, collaborate with role-based team permissions, build follower communities, and issue sequential numbered passes.",
  alternates: { canonical: "https://www.eventsslot.com/organizations" },
  openGraph: {
    title: "EventSlot Organization — Multi-User Workspaces, Verified Handles & E-Tickets",
    description:
      "The multi-user operating system for events. Manage events as an EventSlot Organization with verified handles, team roles, and sequential numbered E-Tickets.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "EventSlot Organization" }],
  },
}

const pillars = [
  {
    n: "01",
    title: "One Identity, Seamless Workspaces",
    description:
      "No multiple email logins or disconnected profiles. With your personal account, switch effortlessly between personal events and your EventSlot Organization workspaces in a single click.",
    icon: Layers,
  },
  {
    n: "02",
    title: "Verified Brand Handle & Followers",
    description:
      "Host under your official @handle (e.g. @benihana). Your brand gets a dedicated public profile, verified badge, and a persistent follower community that is automatically notified of new events.",
    icon: Sparkles,
  },
  {
    n: "03",
    title: "Role-Based Team Collaboration",
    description:
      "Never share passwords across teams again. Invite collaborators as Owners, Admins, or Members with fine-grained controls over event publishing, analytics, and check-in scanner permissions.",
    icon: ShieldCheck,
  },
  {
    n: "04",
    title: "Numbered Passes (E-Ticket #001) & QR Scan",
    description:
      "Issue sequential numbered tickets stamped with event dates and attendee names. Announce entry batches by number and verify attendees at the gate in under one second with our camera scanner.",
    icon: Ticket,
  },
]

const comparisonRows = [
  {
    feature: "Identity & URL",
    individual: "Personal username (@username)",
    organization: "Official Verified EventSlot Organization Handle (@org)",
  },
  {
    feature: "Team Collaboration",
    individual: "Single user login",
    organization: "Multi-user team with Owner, Admin, and Member roles",
  },
  {
    feature: "Credential Security",
    individual: "Requires sharing account passwords",
    organization: "Zero password sharing — staff join via personal invites",
  },
  {
    feature: "Follower Retention",
    individual: "Followers tied to individual organizer",
    organization: "Followers follow the EventSlot Organization brand",
  },
  {
    feature: "Pass Numbering",
    individual: "Random registration confirmation code",
    organization: "Sequential Numbered Passes (E-Ticket #001, #002) + dates",
  },
  {
    feature: "Workspace Switching",
    individual: "Single organizer dashboard",
    organization: "1-Click Switcher between personal and multiple workspaces",
  },
  {
    feature: "Onboarding Support",
    individual: "Self-serve platform",
    organization: "Dedicated concierge provisioning and attendee migration",
  },
]

const useCases = [
  {
    title: "Creative Studios & Brands",
    example: "e.g. Benihana Lubengo Workspace",
    description:
      "Showcase launches, masterclasses, and curated experiences under a unified brand while letting designers and coordinators publish collaboratively.",
    icon: Palette,
  },
  {
    title: "Campus Hubs & Student Unions",
    example: "Universities, faculties, and student bodies",
    description:
      "Maintain continuity through student leadership transitions. Keep attendee history, follower bases, and recurring registrations intact every academic term.",
    icon: GraduationCap,
  },
  {
    title: "Conferences, Summits & Corporate",
    example: "Professional event management teams",
    description:
      "Run multi-day conferences with sequential numbered passes for VIP/General call-ins, rapid gate check-ins, and multi-track session dates.",
    icon: Briefcase,
  },
  {
    title: "Faith & Community Collectives",
    example: "Ministries, non-profits, and civic groups",
    description:
      "Build a loyal community that gets notified automatically every time a weekly service, retreat, or fundraiser is announced.",
    icon: HeartHandshake,
  },
]

const faqs = [
  {
    q: "Can I use both my personal account and an EventSlot Organization?",
    a: "Yes! EventSlot allows your single personal login to own or participate in multiple EventSlot Organization workspaces. You can switch between hosting as an individual and hosting as an organization anytime.",
  },
  {
    q: "How does sequential ticket numbering work?",
    a: "For every EventSlot Organization event, registered attendees receive clean sequential passes (e.g. E-Ticket #001, E-Ticket #002, E-Ticket #003) alongside session dates and their QR code. This makes batch entrance calling and crowd management effortless.",
  },
  {
    q: "Can existing followers from our personal account be moved to our EventSlot Organization?",
    a: "Yes. Our concierge team and platform tools can safely migrate followers from personal profiles to your new EventSlot Organization workspace so your audience remains fully engaged from day one.",
  },
  {
    q: "What roles can I assign to team members?",
    a: "EventSlot Organization supports three permission tiers: Owner (full workspace, billing, and transfer control), Admin (manage team members, create and edit all organization events), and Member (event ops, check-in scanning, and attendee view).",
  },
  {
    q: "How does Concierge Setup work for organizations?",
    a: "If your team is busy or has existing events and attendees, our EventSlot Concierge team can provision your official EventSlot Organization workspace, configure your brand identity, and assign your owners without requiring any technical overhead from your side.",
  },
]

export default function EventSlotOrganizationPage() {
  return (
    <main className="min-h-screen bg-[var(--page-bg)] text-[var(--text-primary)]">
      {/* 1. HERO SECTION */}
      <section className="marketing-shell px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:pb-20 lg:pt-14">
        <div className="marketing-panel overflow-hidden px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_420px] lg:items-center">
            {/* Left Column: Hero Text */}
            <div className="max-w-3xl">
              <div className="marketing-eyebrow">
                <span className="inline-flex h-2 w-2 rounded-full bg-[#166534] dark:bg-[#C8F55A]" />
                EventSlot Organization
              </div>

              <h1 className="marketing-page-title mt-6 font-semibold tracking-tight text-[var(--text-primary)]">
                Event registration and operations built for teams that move fast.
              </h1>

              <p className="mt-6 max-w-2xl text-[1.05rem] leading-8 text-[var(--text-secondary)]">
                Upgrade from single-organizer accounts to an <strong>EventSlot Organization</strong>. Host under a
                verified brand <code className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-xs font-mono font-semibold text-[#166534] dark:text-[#C8F55A]">@handle</code>,
                invite staff with role-based permissions, build a lasting follower community, and issue sequential
                numbered passes (<span className="font-semibold text-[var(--text-primary)]">E-Ticket #001</span>).
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <SmartCTA className="marketing-button-primary inline-flex items-center justify-center gap-2">
                  Create an EventSlot Organization
                  <ArrowRight className="h-4 w-4" />
                </SmartCTA>
                <a
                  href="mailto:info@eventsslot.com?subject=EventSlot%20Organization%20Concierge%20Setup%20Inquiry"
                  className="marketing-button-secondary inline-flex items-center justify-center gap-2"
                >
                  <Headphones className="h-4 w-4 text-[#166534] dark:text-[#C8F55A]" />
                  Request Concierge Setup
                </a>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-[var(--text-muted)]">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-[#166534] dark:text-[#C8F55A]" />
                  Zero password sharing
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-[#166534] dark:text-[#C8F55A]" />
                  Sequential E-Tickets included
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-[#166534] dark:text-[#C8F55A]" />
                  Instant workspace switcher
                </span>
              </div>
            </div>

            {/* Right Column: Live Mockup Card */}
            <div className="marketing-card p-6 border border-[var(--border-subtle)] relative overflow-hidden shadow-xl">
              {/* Top Bar: Workspace Switcher Preview */}
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-[#166534]/15 dark:bg-[#C8F55A]/20 flex items-center justify-center text-[#166534] dark:text-[#C8F55A] font-bold text-sm">
                    BL
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
                      Benihana Lubengo Workspace
                      <span className="inline-flex items-center rounded-full bg-[#166534]/10 dark:bg-[#C8F55A]/20 px-1.5 py-0.2 text-[10px] text-[#166534] dark:text-[#C8F55A] font-bold">
                        Verified ✓
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">@benihanalubengo</div>
                  </div>
                </div>
                <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
                  EventSlot Organization
                </div>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-3 gap-2 py-3 text-center border-b border-[var(--border-subtle)]">
                <div>
                  <div className="text-sm font-bold text-[var(--text-primary)]">1,420</div>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Followers</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-[var(--text-primary)]">5</div>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Organizers</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-[#166534] dark:text-[#C8F55A]">Active</div>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Status</div>
                </div>
              </div>

              {/* E-Ticket Preview Pass */}
              <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 relative">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center rounded-full bg-[#166534] text-white dark:bg-[#C8F55A] dark:text-black px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider">
                    E-TICKET #001
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1 font-mono">
                    <Calendar className="h-3 w-3" /> Nov 20, 2026
                  </span>
                </div>

                <div className="mt-3">
                  <p className="text-xs font-semibold text-[var(--text-primary)] line-clamp-1">
                    East Africa Creative & Tech Summit
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                    Organized by: <span className="font-medium text-[var(--text-primary)]">Benihana Lubengo Workspace</span>
                  </p>
                </div>

                <div className="mt-3.5 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-[var(--text-muted)]">Attendee</div>
                    <div className="text-xs font-medium text-[var(--text-primary)]">Amina Mwangi</div>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[#166534] dark:text-[#C8F55A]">
                    <QrCode className="h-3.5 w-3.5" />
                    Scan Verified
                  </div>
                </div>
              </div>

              {/* Bottom Switcher Pill */}
              <div className="mt-4 flex items-center justify-between text-[11px] text-[var(--text-secondary)] bg-[var(--surface)] p-2 rounded-lg border border-[var(--border-subtle)]">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Personal & Workspace in 1 Click
                </span>
                <span className="font-semibold text-[#166534] dark:text-[#C8F55A]">Switch Workspace →</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. THE 4 PILLARS OF EVENTSLOT ORGANIZATION */}
      <section className="marketing-shell px-4 pb-16 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <div className="marketing-section-label">Architecture</div>
          <h2 className="marketing-section-title mt-4 font-semibold text-[var(--text-primary)]">
            How EventSlot Organization transforms your event workflow.
          </h2>
          <p className="mt-3 text-[1rem] leading-7 text-[var(--text-secondary)]">
            Engineered so teams can scale from small workshops to high-capacity multi-day conferences without spreadsheet chaos or security risks.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {pillars.map((pillar) => {
            const Icon = pillar.icon
            return (
              <article key={pillar.n} className="marketing-card p-6 sm:p-8 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="h-11 w-11 rounded-2xl bg-[#166534]/10 dark:bg-[#C8F55A]/15 flex items-center justify-center text-[#166534] dark:text-[#C8F55A]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="font-mono text-xs font-semibold text-[var(--text-muted)]">
                      {pillar.n}
                    </span>
                  </div>
                  <h3 className="mt-5 text-[1.2rem] font-semibold text-[var(--text-primary)]">
                    {pillar.title}
                  </h3>
                  <p className="mt-3 text-[0.96rem] leading-7 text-[var(--text-secondary)]">
                    {pillar.description}
                  </p>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      {/* 3. SIDE-BY-SIDE COMPARISON */}
      <section className="border-y border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="marketing-shell">
          <div className="max-w-2xl">
            <div className="marketing-section-label">Comparison</div>
            <h2 className="marketing-section-title mt-4 font-semibold text-[var(--text-primary)]">
              Individual Organizer vs. EventSlot Organization
            </h2>
            <p className="mt-3 text-[0.98rem] leading-7 text-[var(--text-secondary)]">
              Choose the structure that matches your ambition. Keep individual events personal, or upgrade to an EventSlot Organization for team-level power.
            </p>
          </div>

          <div className="mt-10 overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[620px]">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  <th className="pb-4 pr-4">Capability</th>
                  <th className="pb-4 px-4 w-[36%]">Individual Organizer</th>
                  <th className="pb-4 pl-4 w-[42%] text-[#166534] dark:text-[#C8F55A]">EventSlot Organization</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] text-sm">
                {comparisonRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-[var(--surface)]/50 transition-colors">
                    <td className="py-4 pr-4 font-semibold text-[var(--text-primary)]">{row.feature}</td>
                    <td className="py-4 px-4 text-[var(--text-secondary)]">{row.individual}</td>
                    <td className="py-4 pl-4 font-medium text-[var(--text-primary)]">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 mt-0.5 text-[#166534] dark:text-[#C8F55A] shrink-0" />
                        <span>{row.organization}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 4. CONCIERGE & WHITE-GLOVE SETUP */}
      <section className="marketing-shell px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="marketing-panel overflow-hidden px-6 py-10 sm:px-10 lg:px-14 lg:py-14 border border-[var(--border-subtle)]">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center">
            <div>
              <div className="marketing-eyebrow">
                <Headphones className="h-3.5 w-3.5 text-[#166534] dark:text-[#C8F55A]" />
                EventSlot Concierge
              </div>
              <h2 className="marketing-section-title mt-4 font-semibold text-[var(--text-primary)]">
                Prefer our team to set up your EventSlot Organization?
              </h2>
              <p className="mt-4 text-[1rem] leading-7 text-[var(--text-secondary)]">
                For creative brands, corporate operations, and academic institutions, the EventSlot team offers concierge onboarding.
                We provision your official <strong>EventSlot Organization Workspace</strong>, verify your brand handle, assign designated administrators, and migrate your attendee follower base so your team can focus strictly on producing extraordinary experiences.
              </p>
              <div className="mt-6 flex flex-wrap gap-4">
                <a
                  href="mailto:info@eventsslot.com?subject=EventSlot%20Organization%20Concierge%20Provisioning"
                  className="marketing-button-primary inline-flex items-center gap-2"
                >
                  Contact Concierge Team
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>

            <div className="marketing-card p-6 border border-[var(--border-subtle)] bg-[var(--surface)]">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                White-Glove Includes
              </h3>
              <ul className="mt-4 space-y-3 text-xs leading-6 text-[var(--text-secondary)]">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#166534] dark:text-[#C8F55A] shrink-0 mt-0.5" />
                  <span>Custom brand handle reservation & verification badge</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#166534] dark:text-[#C8F55A] shrink-0 mt-0.5" />
                  <span>Personal-to-Organization follower migration</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#166534] dark:text-[#C8F55A] shrink-0 mt-0.5" />
                  <span>Team role assignment & staff check-in onboarding</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#166534] dark:text-[#C8F55A] shrink-0 mt-0.5" />
                  <span>Direct Slack/WhatsApp ops line for live event day support</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 5. USE CASES */}
      <section className="marketing-shell px-4 pb-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <div className="marketing-section-label">Real-World Scale</div>
          <h2 className="marketing-section-title mt-4 font-semibold text-[var(--text-primary)]">
            Built for organizations that host often and expect excellence.
          </h2>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {useCases.map((uc, i) => {
            const Icon = uc.icon
            return (
              <article key={i} className="marketing-card p-6 flex flex-col justify-between">
                <div>
                  <div className="h-10 w-10 rounded-xl bg-[#166534]/10 dark:bg-[#C8F55A]/15 flex items-center justify-center text-[#166534] dark:text-[#C8F55A]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-[1.1rem] font-semibold text-[var(--text-primary)]">{uc.title}</h3>
                  <div className="text-[11px] font-mono font-medium text-[#166534] dark:text-[#C8F55A] mt-1">
                    {uc.example}
                  </div>
                  <p className="mt-3 text-[0.92rem] leading-6 text-[var(--text-secondary)]">
                    {uc.description}
                  </p>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      {/* 6. FREQUENTLY ASKED QUESTIONS */}
      <section className="border-t border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="marketing-shell">
          <div className="max-w-2xl">
            <div className="marketing-section-label">Knowledge Base</div>
            <h2 className="marketing-section-title mt-4 font-semibold text-[var(--text-primary)]">
              Frequently asked questions about EventSlot Organization.
            </h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {faqs.map((faq, i) => (
              <div key={i} className="marketing-card p-6">
                <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-start gap-2.5">
                  <span className="text-[#166534] dark:text-[#C8F55A] font-bold">Q:</span>
                  <span>{faq.q}</span>
                </h3>
                <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)] pl-5">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. BOTTOM CALL TO ACTION */}
      <section className="marketing-shell px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="marketing-panel overflow-hidden px-6 py-12 sm:px-10 lg:px-14 lg:py-16 text-center max-w-4xl mx-auto">
          <div className="marketing-eyebrow mx-auto">
            <Building2 className="h-3.5 w-3.5 text-[#166534] dark:text-[#C8F55A]" />
            Get Started with EventSlot Organization
          </div>

          <h2 className="marketing-page-title mt-6 font-semibold text-[var(--text-primary)]">
            Ready to give your events the structure they deserve?
          </h2>

          <p className="mt-5 max-w-2xl mx-auto text-[1.05rem] leading-8 text-[var(--text-secondary)]">
            Create your official EventSlot Organization workspace in less than two minutes, or let our concierge team set it up for your company.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <SmartCTA className="marketing-button-primary inline-flex items-center gap-2">
              Launch EventSlot Organization
              <ArrowRight className="h-4 w-4" />
            </SmartCTA>
            <Link href="/events" className="marketing-button-secondary">
              Explore Live Events
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  )
}
