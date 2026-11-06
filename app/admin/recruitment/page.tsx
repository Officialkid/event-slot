import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import Link from "next/link"
import prisma from "@/lib/prisma"
import { checkRecruitmentAccess, getPermittedVacancyIds } from "@/lib/recruitment/permissions"
import { formatNairobiDeadline } from "@/components/careers/CareersDiscovery"
import {
  Briefcase,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Plus,
  Users2,
} from "lucide-react"

export const dynamic = "force-dynamic"

export default async function RecruitmentOverviewPage() {
  const session = await getServerSession(authOptions)
  const access = await checkRecruitmentAccess(session)
  const now = new Date()

  const permittedVacancyIds = await getPermittedVacancyIds(
    session?.user?.id || "",
    access.isGlobalAdmin
  )

  const vacancyFilter = permittedVacancyIds ? { id: { in: permittedVacancyIds } } : {}
  const applicationFilter = permittedVacancyIds
    ? { vacancyId: { in: permittedVacancyIds } }
    : {}

  // Fetch overview metrics
  const [
    totalVacancies,
    publishedVacancies,
    closedVacancies,
    totalApplications,
    awaitingReviewCount,
    shortlistedCount,
    hiredCount,
    recentApplications,
    upcomingDeadlines,
  ] = await Promise.all([
    prisma.vacancy.count({ where: vacancyFilter }),
    prisma.vacancy.count({ where: { ...vacancyFilter, status: "PUBLISHED" } }),
    prisma.vacancy.count({ where: { ...vacancyFilter, status: "CLOSED" } }),
    prisma.jobApplication.count({ where: applicationFilter }),
    prisma.jobApplication.count({
      where: {
        ...applicationFilter,
        status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
      },
    }),
    prisma.jobApplication.count({
      where: { ...applicationFilter, status: "SHORTLISTED" },
    }),
    prisma.jobApplication.count({
      where: { ...applicationFilter, status: "HIRED" },
    }),
    prisma.jobApplication.findMany({
      where: applicationFilter,
      orderBy: { submittedAt: "desc" },
      take: 6,
      include: {
        vacancy: { select: { title: true, type: true } },
      },
    }),
    prisma.vacancy.findMany({
      where: {
        ...vacancyFilter,
        status: "PUBLISHED",
        closesAt: { gte: now },
      },
      orderBy: { closesAt: "asc" },
      take: 4,
      select: {
        id: true,
        title: true,
        department: true,
        closesAt: true,
        _count: { select: { applications: true } },
      },
    }),
  ])

  return (
    <div className="space-y-8">
      {/* Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0A0A0A]">Recruitment Metrics</h2>
          <p className="text-xs text-[#64748B]">Operational overview across authorized roles and vacancies.</p>
        </div>

        {access.isGlobalAdmin && (
          <Link
            href="/admin/recruitment/vacancies/new"
            className="inline-flex items-center gap-2 rounded-full bg-[#C8F55A] px-5 py-2.5 text-xs font-bold text-[#0A0A0A] hover:bg-[#b8e040] transition shadow-sm shrink-0"
          >
            <Plus className="h-4 w-4" />
            Create New Vacancy
          </Link>
        )}
      </div>

      {/* Primary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-[#64748B]">
            <span className="font-semibold uppercase tracking-wider">Active Vacancies</span>
            <Briefcase className="h-4 w-4 text-[#15803D]" />
          </div>
          <div className="mt-3 text-3xl font-mono font-bold text-[#0A0A0A]">
            {publishedVacancies}
          </div>
          <div className="mt-1 text-xs text-[#64748B]">
            {totalVacancies} total · {closedVacancies} closed
          </div>
        </div>

        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-[#64748B]">
            <span className="font-semibold uppercase tracking-wider">Total Applications</span>
            <FileText className="h-4 w-4 text-[#15803D]" />
          </div>
          <div className="mt-3 text-3xl font-mono font-bold text-[#0A0A0A]">
            {totalApplications}
          </div>
          <div className="mt-1 text-xs text-[#64748B]">
            Across {publishedVacancies} active vacancies
          </div>
        </div>

        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-[#64748B]">
            <span className="font-semibold uppercase tracking-wider">Awaiting Review</span>
            <Clock className="h-4 w-4 text-[#D97706]" />
          </div>
          <div className="mt-3 text-3xl font-mono font-bold text-[#D97706]">
            {awaitingReviewCount}
          </div>
          <div className="mt-1 text-xs text-[#D97706] font-medium">
            Pending initial evaluation
          </div>
        </div>

        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-[#64748B]">
            <span className="font-semibold uppercase tracking-wider">Shortlisted &amp; Hired</span>
            <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
          </div>
          <div className="mt-3 text-3xl font-mono font-bold text-[#16A34A]">
            {shortlistedCount + hiredCount}
          </div>
          <div className="mt-1 text-xs text-[#64748B]">
            {shortlistedCount} shortlisted · {hiredCount} hired
          </div>
        </div>
      </div>

      {/* Grid: Recent Applications & Upcoming Deadlines */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Column: Recent Applications Inbox Preview */}
        <div className="lg:col-span-8 rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-4">
            <div>
              <h3 className="text-base font-bold text-[#0A0A0A]">Recent Applications</h3>
              <p className="text-xs text-[#64748B]">Latest submissions received across all roles</p>
            </div>
            <Link
              href="/admin/recruitment/applications"
              className="text-xs font-semibold text-[#15803D] hover:underline flex items-center gap-1"
            >
              View All ({totalApplications}) <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-4 divide-y divide-[#F1F5F9]">
            {recentApplications.length > 0 ? (
              recentApplications.map((app) => (
                <div
                  key={app.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-bold text-[#0A0A0A] flex items-center gap-2">
                      <span>{app.fullName}</span>
                      <span className="font-mono text-[0.7rem] text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded">
                        {app.referenceCode}
                      </span>
                    </div>
                    <div className="mt-1 text-[#475569]">
                      Applying for: <strong>{app.vacancy.title}</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="rounded-full px-2.5 py-0.5 text-[0.68rem] font-bold uppercase tracking-wider bg-[#F1F5F9] text-[#334155] border border-[#E2E8F0]">
                      {app.status.replace(/_/g, " ")}
                    </span>
                    <Link
                      href={`/admin/recruitment/applications/${app.id}`}
                      className="rounded-lg border border-[#D1D5DB] bg-white px-2.5 py-1 text-xs font-semibold text-[#0A0A0A] hover:border-[#15803D] transition shadow-sm"
                    >
                      Review
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-xs text-[#64748B]">
                No applications received yet.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Upcoming Deadlines & Vacancy Health */}
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <h3 className="text-base font-bold text-[#0A0A0A] flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#D97706]" />
              Upcoming Deadlines
            </h3>
            <p className="mt-1 text-xs text-[#64748B]">
              Active vacancies closing soon (Nairobi Time)
            </p>

            <div className="mt-4 space-y-3">
              {upcomingDeadlines.length > 0 ? (
                upcomingDeadlines.map((v) => (
                  <div
                    key={v.id}
                    className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs"
                  >
                    <div className="font-bold text-[#0A0A0A]">{v.title}</div>
                    <div className="text-[0.7rem] text-[#64748B] mt-0.5">{v.department}</div>
                    <div className="mt-2 flex items-center justify-between text-[0.7rem] pt-2 border-t border-[#E2E8F0]">
                      <span className="text-[#D97706] font-semibold">
                        {formatNairobiDeadline(v.closesAt!.toISOString())}
                      </span>
                      <span className="font-mono text-[#334155]">
                        {v._count.applications} applied
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-[#64748B] py-4 text-center">
                  No upcoming deadlines scheduled.
                </div>
              )}
            </div>

            <div className="mt-5 pt-4 border-t border-[#F1F5F9]">
              <Link
                href="/admin/recruitment/vacancies"
                className="text-xs font-semibold text-[#15803D] hover:underline flex items-center justify-between"
              >
                <span>Manage all vacancies</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
