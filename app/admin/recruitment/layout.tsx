import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import Link from "next/link"
import { redirect } from "next/navigation"
import { checkRecruitmentAccess } from "@/lib/recruitment/permissions"
import { Briefcase, FileText, Users, ShieldCheck, Activity } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function RecruitmentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect("/signin?callbackUrl=/admin/recruitment")
  }

  const access = await checkRecruitmentAccess(session)
  if (!access.authorized) {
    redirect("/unauthorized")
  }

  return (
    <div className="space-y-6">
      {/* Recruitment Header Bar */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(21,128,61,0.2)] bg-[rgba(200,245,90,0.22)] px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-[#0A0A0A]">
              <Briefcase className="h-3 w-3 text-[#16A34A]" />
              EventSlot Recruitment System
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#0A0A0A]">
              Recruitment Operations
            </h1>
            <p className="mt-1 text-xs text-[#64748B]">
              Manage vacancies, candidate applications, reviewer assignments, and recruitment decisions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#F1F5F9] px-3 py-1 text-xs font-semibold text-[#475569] border border-[#E2E8F0]">
              Role: <strong className="text-[#0A0A0A]">{access.role}</strong>
            </span>
            <Link
              href="/careers"
              target="_blank"
              className="rounded-full border border-[#D1D5DB] bg-white px-3.5 py-1 text-xs font-semibold text-[#0A0A0A] hover:border-[#15803D] hover:bg-[#F9FAFB] transition shadow-sm"
            >
              Public Careers Portal ↗
            </Link>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <nav className="mt-6 pt-4 border-t border-[#F1F5F9] flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <Link
            href="/admin/recruitment"
            className="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#374151] hover:bg-[#F1F5F9] transition"
          >
            <Activity className="h-3.5 w-3.5 text-[#15803D]" />
            Overview
          </Link>
          <Link
            href="/admin/recruitment/vacancies"
            className="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#374151] hover:bg-[#F1F5F9] transition"
          >
            <Briefcase className="h-3.5 w-3.5 text-[#15803D]" />
            Vacancies
          </Link>
          <Link
            href="/admin/recruitment/applications"
            className="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#374151] hover:bg-[#F1F5F9] transition"
          >
            <FileText className="h-3.5 w-3.5 text-[#15803D]" />
            Applications
          </Link>
          {access.isGlobalAdmin && (
            <>
              <Link
                href="/admin/recruitment/reviewers"
                className="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#374151] hover:bg-[#F1F5F9] transition"
              >
                <Users className="h-3.5 w-3.5 text-[#15803D]" />
                Temporary Reviewers
              </Link>
              <Link
                href="/admin/recruitment/audit"
                className="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#374151] hover:bg-[#F1F5F9] transition"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-[#15803D]" />
                Audit Trail
              </Link>
            </>
          )}
        </nav>
      </div>

      {children}
    </div>
  )
}
