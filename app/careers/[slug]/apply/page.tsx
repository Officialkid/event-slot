import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import prisma from "@/lib/prisma"
import { MarketingFooter } from "@/components/MarketingFooter"
import { GuidedApplicationForm } from "@/components/careers/GuidedApplicationForm"
import { OPPORTUNITY_TYPES, type VacancyQuestion } from "@/lib/recruitment/types"
import { formatNairobiDeadline } from "@/components/careers/CareersDiscovery"
import { ArrowLeft, Clock, AlertCircle, ShieldCheck } from "lucide-react"

export const dynamic = "force-dynamic"

interface ApplyPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({
  params,
}: ApplyPageProps): Promise<Metadata> {
  const { slug } = await params
  const vacancy = await prisma.vacancy.findUnique({
    where: { slug },
    select: { title: true, department: true },
  })

  if (!vacancy) {
    return { title: "Apply — Vacancy Not Found | EventSlot Careers" }
  }

  return {
    title: `Apply: ${vacancy.title} — EventSlot Careers`,
    description: `Submit your application for the ${vacancy.title} vacancy at EventSlot.`,
  }
}

export default async function ApplyPage({ params }: ApplyPageProps) {
  const { slug } = await params
  const now = new Date()

  const vacancy = await prisma.vacancy.findUnique({
    where: { slug },
  })

  if (!vacancy) {
    notFound()
  }

  const isPastDeadline = vacancy.closesAt ? new Date(vacancy.closesAt) <= now : false
  const isClosed = vacancy.status !== "PUBLISHED" || isPastDeadline

  const typeLabel =
    OPPORTUNITY_TYPES.find((t) => t.value === vacancy.type)?.label || vacancy.type

  if (isClosed) {
    return (
      <main className="min-h-screen bg-[#FDFCFB] text-[#0A0A0A]">
        <div className="border-b border-[#E5E7EB] bg-white">
          <div className="marketing-shell px-4 py-3 sm:px-6 lg:px-8">
            <Link
              href={`/careers/${slug}`}
              className="inline-flex items-center gap-2 text-xs font-semibold text-[#64748B] hover:text-[#15803D] transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Vacancy Details</span>
            </Link>
          </div>
        </div>

        <div className="marketing-shell px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-xl text-center rounded-2xl border border-[#FDE68A] bg-[#FEF9C3]/50 p-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#FEF08A] text-[#854D0E] mb-4">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0A0A0A] font-serif">
              Applications Closed
            </h1>
            <p className="mt-2 text-sm text-[#4B5563]">
              We are no longer accepting submissions for{" "}
              <span className="font-semibold text-[#0A0A0A]">{vacancy.title}</span>.
              {vacancy.closesAt && (
                <span className="block mt-1 text-xs text-[#6B7280]">
                  The application deadline was {formatNairobiDeadline(vacancy.closesAt)}.
                </span>
              )}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link
                href="/careers"
                className="inline-flex items-center gap-2 rounded-full bg-[#0A0A0A] px-5 py-2.5 text-xs font-bold text-[#C8F55A] hover:bg-[#1A1A1A] transition shadow-sm"
              >
                <span>Browse Open Opportunities</span>
              </Link>
            </div>
          </div>
        </div>

        <MarketingFooter />
      </main>
    )
  }

  const requiredDocuments = Array.isArray(vacancy.requiredDocuments)
    ? (vacancy.requiredDocuments as string[])
    : []

  const questions = Array.isArray(vacancy.questions)
    ? (vacancy.questions as unknown as VacancyQuestion[])
    : []

  return (
    <main className="min-h-screen bg-[#FDFCFB] text-[#0A0A0A]">
      {/* Top Breadcrumb Nav */}
      <div className="border-b border-[#E5E7EB] bg-white">
        <div className="marketing-shell px-4 py-3 sm:px-6 lg:px-8 flex items-center justify-between">
          <Link
            href={`/careers/${slug}`}
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#64748B] hover:text-[#15803D] transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Role Details</span>
          </Link>
          <div className="inline-flex items-center gap-1.5 text-xs text-[#64748B]">
            <ShieldCheck className="h-4 w-4 text-[#15803D]" />
            <span>Private & Encrypted Application</span>
          </div>
        </div>
      </div>

      {/* Header Banner */}
      <header className="border-b border-[#E5E7EB] bg-white py-8 sm:py-10">
        <div className="marketing-shell px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-[#DCFCE7] px-2.5 py-0.5 text-xs font-bold text-[#15803D]">
              {typeLabel}
            </span>
            <span className="text-xs font-medium text-[#6B7280]">
              {vacancy.department}
            </span>
            {vacancy.closesAt && (
              <span className="inline-flex items-center gap-1 text-xs text-[#6B7280]">
                <Clock className="h-3 w-3" />
                Closes {formatNairobiDeadline(vacancy.closesAt)}
              </span>
            )}
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#0A0A0A] sm:text-3xl font-serif">
            Apply for {vacancy.title}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#64748B]">
            Step-by-step guided submission. Complete all required fields and upload your documents to be considered.
          </p>
        </div>
      </header>

      {/* Form Container */}
      <div className="marketing-shell px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <GuidedApplicationForm
            vacancy={{
              slug: vacancy.slug,
              title: vacancy.title,
              department: vacancy.department,
              type: vacancy.type,
              requiredDocuments,
              questions,
            }}
          />
        </div>
      </div>

      <MarketingFooter />
    </main>
  )
}
