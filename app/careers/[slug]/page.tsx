import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import prisma from "@/lib/prisma"
import { MarketingFooter } from "@/components/MarketingFooter"
import {
  OPPORTUNITY_TYPES,
  type VacancyQuestion,
} from "@/lib/recruitment/types"
import { formatNairobiDeadline } from "@/components/careers/CareersDiscovery"
import {
  MapPin,
  Building,
  Clock,
  Briefcase,
  Users2,
  Calendar,
  CheckCircle2,
  FileText,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  DollarSign,
  ShieldCheck,
} from "lucide-react"

export const dynamic = "force-dynamic"

interface VacancyDetailPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({
  params,
}: VacancyDetailPageProps): Promise<Metadata> {
  const { slug } = await params
  const vacancy = await prisma.vacancy.findUnique({
    where: { slug },
    select: { title: true, shortSummary: true, department: true },
  })

  if (!vacancy) return { title: "Vacancy Not Found | EventSlot Careers" }

  return {
    title: `${vacancy.title} — EventSlot Careers`,
    description: vacancy.shortSummary,
    openGraph: {
      title: `${vacancy.title} — EventSlot Careers`,
      description: vacancy.shortSummary,
      url: `https://www.eventsslot.com/careers/${slug}`,
    },
  }
}

export default async function VacancyDetailPage({ params }: VacancyDetailPageProps) {
  const { slug } = await params
  const now = new Date()

  const vacancy = await prisma.vacancy.findUnique({
    where: { slug },
  })

  // Do not display unpublished (Draft / Archived) vacancies to the public
  if (!vacancy || (vacancy.status !== "PUBLISHED" && vacancy.status !== "CLOSED")) {
    notFound()
  }

  const isPastDeadline = vacancy.closesAt ? new Date(vacancy.closesAt) <= now : false
  const isClosed = vacancy.status === "CLOSED" || isPastDeadline

  const typeLabel =
    OPPORTUNITY_TYPES.find((t) => t.value === vacancy.type)?.label || vacancy.type

  const requiredDocs = Array.isArray(vacancy.requiredDocuments)
    ? (vacancy.requiredDocuments as string[])
    : []
  const optionalDocs = Array.isArray(vacancy.optionalDocuments)
    ? (vacancy.optionalDocuments as string[])
    : []

  const questions = Array.isArray(vacancy.questions)
    ? (vacancy.questions as unknown as VacancyQuestion[])
    : []

  return (
    <main className="min-h-screen bg-[#FDFCFB] text-[#0A0A0A]">
      {/* Top Breadcrumb Nav */}
      <div className="border-b border-[#E5E7EB] bg-white">
        <div className="marketing-shell px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/careers"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#64748B] hover:text-[#15803D] transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to All Careers</span>
          </Link>
        </div>
      </div>

      {/* Header Banner */}
      <header className="border-b border-[#E5E7EB] bg-white py-12 lg:py-16 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-1/4 w-[600px] h-[300px] bg-[radial-gradient(ellipse_at_top,rgba(200,245,90,0.14)_0%,transparent_70%)] blur-2xl" />
        </div>

        <div className="marketing-shell px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-4xl">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(21,128,61,0.2)] bg-[rgba(200,245,90,0.22)] px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-[#0A0A0A]">
                {typeLabel}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-0.5 text-xs font-semibold text-[#475569]">
                <Building className="h-3 w-3 text-[#94A3B8]" />
                {vacancy.department}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-0.5 text-xs font-semibold text-[#475569]">
                <MapPin className="h-3 w-3 text-[#94A3B8]" />
                {vacancy.location} ({vacancy.workArrangement.toLowerCase()})
              </span>
            </div>

            <h1 className="mt-5 text-[2.2rem] sm:text-[3rem] font-semibold tracking-tight text-[#0A0A0A] leading-tight">
              {vacancy.title}
            </h1>

            <p className="mt-4 text-[1.05rem] leading-relaxed text-[#475569] max-w-2xl">
              {vacancy.shortSummary}
            </p>

            {/* Quick Meta Stats Row */}
            <div className="mt-8 pt-6 border-t border-[#F1F5F9] flex flex-wrap items-center gap-6 text-xs text-[#64748B]">
              <div className="flex items-center gap-2">
                <Users2 className="h-4 w-4 text-[#15803D]" />
                <span>
                  <strong>{vacancy.openingsCount}</strong>{" "}
                  {vacancy.openingsCount === 1 ? "opening" : "openings"}
                </span>
              </div>

              {vacancy.compensation && (
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-[#15803D]" />
                  <span>{vacancy.compensation}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#15803D]" />
                <span>
                  {vacancy.closesAt
                    ? `Deadline: ${formatNairobiDeadline(vacancy.closesAt.toISOString())}`
                    : "Rolling application / open until filled"}
                </span>
              </div>
            </div>

            {/* Application Closed Banner if applicable */}
            {isClosed ? (
              <div className="mt-6 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-4 text-xs text-[#991B1B] flex items-center gap-3">
                <AlertCircle className="h-5 w-5 shrink-0 text-[#DC2626]" />
                <div>
                  <strong className="font-bold">Applications are now closed for this role.</strong>
                  <p className="mt-0.5 text-[#B91C1C]">
                    The application window or deadline has passed. Thank you for your interest in EventSlot!
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-8">
                <Link
                  href={`/careers/${vacancy.slug}/apply`}
                  className="inline-flex items-center gap-2 rounded-full bg-[#C8F55A] px-8 py-3.5 text-sm font-bold text-[#0A0A0A] shadow-[0_10px_25px_rgba(200,245,90,0.35)] hover:bg-[#b8e040] hover:scale-[1.01] transition"
                >
                  <span>Apply for this Role</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <div className="marketing-shell px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1fr_340px] items-start">
          {/* Left Column: Job Description and Responsibilities */}
          <div className="space-y-10">
            {/* About the role */}
            <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-8 shadow-sm">
              <h2 className="text-xl font-semibold text-[#0A0A0A]">About the Role</h2>
              <div className="mt-4 whitespace-pre-line text-sm leading-relaxed text-[#374151]">
                {vacancy.description}
              </div>
            </section>

            {/* Responsibilities */}
            <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-8 shadow-sm">
              <h2 className="text-xl font-semibold text-[#0A0A0A]">What You Will Do</h2>
              <div className="mt-4 whitespace-pre-line text-sm leading-relaxed text-[#374151]">
                {vacancy.responsibilities}
              </div>
            </section>

            {/* Qualifications */}
            <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-8 shadow-sm">
              <h2 className="text-xl font-semibold text-[#0A0A0A]">
                What We Are Looking For
              </h2>
              <div className="mt-4 whitespace-pre-line text-sm leading-relaxed text-[#374151]">
                {vacancy.qualifications}
              </div>
            </section>

            {/* Skills Tags */}
            {vacancy.skills.length > 0 && (
              <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-8 shadow-sm">
                <h2 className="text-base font-semibold text-[#0A0A0A]">
                  Relevant Skills &amp; Experience
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {vacancy.skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1 text-xs font-medium text-[#475569]"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Bottom Apply CTA */}
            <div className="rounded-2xl border border-[rgba(21,128,61,0.2)] bg-[rgba(200,245,90,0.15)] p-8 text-center sm:text-left sm:flex sm:items-center sm:justify-between gap-6">
              <div>
                <h3 className="text-lg font-bold text-[#0A0A0A]">
                  Interested in joining EventSlot?
                </h3>
                <p className="mt-1 text-xs text-[#475569]">
                  {isClosed
                    ? "Applications for this position are currently closed."
                    : "Complete our guided application form. No account creation required."}
                </p>
              </div>

              {!isClosed && (
                <Link
                  href={`/careers/${vacancy.slug}/apply`}
                  className="mt-4 sm:mt-0 inline-flex items-center gap-2 rounded-full bg-[#0A0A0A] px-6 py-3 text-xs font-bold text-[#C8F55A] hover:bg-[#1A1A1A] transition shadow-md shrink-0"
                >
                  <span>Apply Now</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>

          {/* Right Column: Key Details & Application Requirements */}
          <aside className="space-y-6">
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#64748B]">
                Position Summary
              </h2>

              <dl className="mt-4 space-y-3.5 text-xs">
                <div>
                  <dt className="text-[#94A3B8]">Opportunity Type</dt>
                  <dd className="mt-0.5 font-semibold text-[#0A0A0A]">{typeLabel}</dd>
                </div>
                <div>
                  <dt className="text-[#94A3B8]">Department</dt>
                  <dd className="mt-0.5 font-semibold text-[#0A0A0A]">
                    {vacancy.department}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#94A3B8]">Location</dt>
                  <dd className="mt-0.5 font-semibold text-[#0A0A0A]">
                    {vacancy.location}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#94A3B8]">Work Arrangement</dt>
                  <dd className="mt-0.5 font-semibold text-[#0A0A0A] capitalize">
                    {vacancy.workArrangement.toLowerCase()}
                  </dd>
                </div>
                {vacancy.compensation && (
                  <div>
                    <dt className="text-[#94A3B8]">Compensation</dt>
                    <dd className="mt-0.5 font-semibold text-[#0A0A0A]">
                      {vacancy.compensation}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-[#94A3B8]">Openings</dt>
                  <dd className="mt-0.5 font-semibold text-[#0A0A0A]">
                    {vacancy.openingsCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#94A3B8]">Application Deadline</dt>
                  <dd className="mt-0.5 font-semibold text-[#0A0A0A]">
                    {vacancy.closesAt
                      ? formatNairobiDeadline(vacancy.closesAt.toISOString())
                      : "Open until filled"}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Document Requirements Card */}
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#64748B]">
                Required Documents
              </h2>
              <div className="mt-3 space-y-2 text-xs text-[#374151]">
                {requiredDocs.length > 0 ? (
                  requiredDocs.map((doc) => (
                    <div key={doc} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#15803D] shrink-0" />
                      <span className="capitalize">{doc.toLowerCase().replace(/_/g, " ")} (Mandatory)</span>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#15803D] shrink-0" />
                    <span>CV / Résumé</span>
                  </div>
                )}

                {optionalDocs.map((doc) => (
                  <div key={doc} className="flex items-center gap-2 text-[#64748B]">
                    <FileText className="h-4 w-4 text-[#94A3B8] shrink-0" />
                    <span className="capitalize">{doc.toLowerCase().replace(/_/g, " ")} (Optional)</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Application Guarantee */}
            <div className="rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] p-5 text-xs text-[#475569] space-y-2">
              <div className="flex items-center gap-2 font-bold text-[#0A0A0A]">
                <ShieldCheck className="h-4 w-4 text-[#15803D]" />
                Human Review Guarantee
              </div>
              <p className="leading-relaxed">
                EventSlot does not use automated screening or algorithmic rejection. Every submission is personally reviewed by our team.
              </p>
            </div>
          </aside>
        </div>
      </div>

      <MarketingFooter />
    </main>
  )
}
