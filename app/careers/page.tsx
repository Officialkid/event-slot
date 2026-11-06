import type { Metadata } from "next"
import Link from "next/link"
import prisma from "@/lib/prisma"
import { MarketingFooter } from "@/components/MarketingFooter"
import { CareersDiscovery, type VacancyListItem } from "@/components/careers/CareersDiscovery"
import { Sparkles, ArrowRight, ShieldCheck, HeartHandshake, Zap, Users } from "lucide-react"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Careers at EventSlot — Join Our Team",
  description:
    "Explore open roles and career opportunities at EventSlot. Help us build modern, calm event registration and waitlist infrastructure for organizers worldwide.",
  alternates: { canonical: "https://www.eventsslot.com/careers" },
  openGraph: {
    title: "Careers at EventSlot — Join Our Team",
    description:
      "Explore open roles and career opportunities at EventSlot. Help us build modern, calm event registration and waitlist infrastructure for organizers worldwide.",
    url: "https://www.eventsslot.com/careers",
  },
}

export default async function CareersPage() {
  const now = new Date()

  // Query published or closed vacancies (never draft or archived)
  const vacancies = await prisma.vacancy.findMany({
    where: {
      status: { in: ["PUBLISHED", "CLOSED"] },
    },
    orderBy: [
      { status: "asc" }, // PUBLISHED before CLOSED
      { createdAt: "desc" },
    ],
    select: {
      id: true,
      slug: true,
      title: true,
      type: true,
      department: true,
      location: true,
      workArrangement: true,
      shortSummary: true,
      closesAt: true,
      status: true,
    },
  })

  const formattedVacancies: VacancyListItem[] = vacancies.map((v) => {
    const isPastDeadline = v.closesAt ? new Date(v.closesAt) <= now : false
    const isClosed = v.status === "CLOSED" || isPastDeadline

    return {
      id: v.id,
      slug: v.slug,
      title: v.title,
      type: v.type,
      department: v.department,
      location: v.location,
      workArrangement: v.workArrangement,
      shortSummary: v.shortSummary,
      closesAt: v.closesAt ? v.closesAt.toISOString() : null,
      status: v.status,
      isClosed,
    }
  })

  return (
    <main className="min-h-screen bg-[#FDFCFB] text-[#0A0A0A]">
      {/* Careers Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 lg:pt-20 lg:pb-24 border-b border-[#E5E7EB] bg-white">
        {/* Soft background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[350px] bg-[radial-gradient(ellipse_at_top,rgba(200,245,90,0.18)_0%,transparent_70%)] blur-2xl" />
        </div>

        <div className="marketing-shell px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl">
            {/* Eyebrow Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(21,128,61,0.2)] bg-[rgba(200,245,90,0.22)] px-3.5 py-1 text-[0.72rem] font-bold uppercase tracking-[0.14em] text-[#0A0A0A]">
              <Sparkles className="h-3 w-3 text-[#16A34A]" />
              EventSlot Careers &amp; Opportunities
            </div>

            <h1 className="mt-5 text-[2.5rem] sm:text-[3.5rem] font-normal tracking-tight text-[#0A0A0A] leading-[1.08]">
              Build the future of{" "}
              <span
                className="italic font-serif text-[#166534]"
                style={{ fontFamily: "var(--font-instrument-serif)" }}
              >
                calm event execution.
              </span>
            </h1>

            <p className="mt-5 text-[1.05rem] sm:text-[1.15rem] leading-relaxed text-[#475569]">
              EventSlot removes registration panic, chaotic door queues, and spreadsheet nightmare for event teams across universities, creative summits, and tech conferences. We are a focused, high-trust team building thoughtful software that just works.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href="#openings"
                className="inline-flex items-center gap-2 rounded-full bg-[#C8F55A] px-6 py-3 text-sm font-bold text-[#0A0A0A] shadow-[0_10px_25px_rgba(200,245,90,0.3)] hover:bg-[#b8e040] transition"
              >
                <span>View Open Opportunities</span>
                <ArrowRight className="h-4 w-4" />
              </a>

              <Link
                href="/careers/track"
                className="inline-flex items-center gap-2 rounded-full border border-[#D1D5DB] bg-white px-5 py-3 text-sm font-medium text-[#0A0A0A] hover:border-[#15803D] hover:bg-[#F9FAFB] transition shadow-sm"
              >
                Track Your Application
              </Link>
            </div>
          </div>

          {/* Value Pillars */}
          <div className="mt-14 pt-10 border-t border-[#F1F5F9] grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-start gap-3.5">
              <div className="rounded-xl bg-[#F0FDF4] p-2.5 text-[#15803D] shrink-0 border border-[#DCFCE7]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[#0A0A0A]">High Autonomy</h2>
                <p className="mt-1 text-xs text-[#64748B] leading-relaxed">
                  We give engineers, designers, and operators ownership of their problems with minimal meetings.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="rounded-xl bg-[#F0FDF4] p-2.5 text-[#15803D] shrink-0 border border-[#DCFCE7]">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[#0A0A0A]">Real Impact</h2>
                <p className="mt-1 text-xs text-[#64748B] leading-relaxed">
                  Your work directly powers registration and door check-ins for thousands of live event attendees.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="rounded-xl bg-[#F0FDF4] p-2.5 text-[#15803D] shrink-0 border border-[#DCFCE7]">
                <HeartHandshake className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[#0A0A0A]">Human First</h2>
                <p className="mt-1 text-xs text-[#64748B] leading-relaxed">
                  Recruitment and team operations are 100% human-evaluated without black-box AI filtering.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="rounded-xl bg-[#F0FDF4] p-2.5 text-[#15803D] shrink-0 border border-[#DCFCE7]">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[#0A0A0A]">Diverse Opportunities</h2>
                <p className="mt-1 text-xs text-[#64748B] leading-relaxed">
                  From full-time and internships to advisory and project contracts, we welcome diverse collaboration.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Discovery & Listings Section */}
      <section id="openings" className="py-16 lg:py-20">
        <div className="marketing-shell px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-8">
            <h2 className="text-[1.85rem] font-semibold tracking-tight text-[#0A0A0A]">
              Open Opportunities
            </h2>
            <p className="mt-2 text-sm text-[#475569]">
              Find a role that fits your experience and interests. Filter by opportunity type or department to discover where you can contribute.
            </p>
          </div>

          <CareersDiscovery initialVacancies={formattedVacancies} />
        </div>
      </section>

      {/* Recruitment Process Trust Banner */}
      <section className="py-14 border-t border-[#E5E7EB] bg-white">
        <div className="marketing-shell px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-[#E5E7EB] bg-[#FAFAF9] p-8 sm:p-10 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-xl">
              <span className="text-xs font-bold uppercase tracking-wider text-[#15803D]">
                Our Recruitment Commitment
              </span>
              <h3 className="mt-2 text-xl font-semibold text-[#0A0A0A]">
                Human-centered, fair, and transparent
              </h3>
              <p className="mt-2 text-sm text-[#475569] leading-relaxed">
                Every application is read and reviewed by real team members. After applying, you receive a personal reference code to track your review progress at any time without having to create an account.
              </p>
            </div>
            <Link
              href="/careers/track"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0A0A0A] px-6 py-3 text-sm font-semibold text-[#C8F55A] hover:bg-[#1A1A1A] transition shrink-0 shadow-sm"
            >
              <span>Track Application Status</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  )
}
