import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { checkRecruitmentAccess, getPermittedVacancyIds } from "@/lib/recruitment/permissions"
import { VacanciesListTable, type AdminVacancyItem } from "@/components/recruitment/VacanciesListTable"

export const dynamic = "force-dynamic"

export default async function AdminVacanciesPage() {
  const session = await getServerSession(authOptions)
  const access = await checkRecruitmentAccess(session)

  const permittedVacancyIds = await getPermittedVacancyIds(
    session?.user?.id || "",
    access.isGlobalAdmin
  )

  const where: any = {}
  if (permittedVacancyIds) {
    where.id = { in: permittedVacancyIds }
  }

  const vacancies = await prisma.vacancy.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { applications: true } },
    },
  })

  const formatted: AdminVacancyItem[] = vacancies.map((v) => ({
    id: v.id,
    title: v.title,
    slug: v.slug,
    type: v.type,
    department: v.department,
    location: v.location,
    workArrangement: v.workArrangement,
    openingsCount: v.openingsCount,
    status: v.status,
    closesAt: v.closesAt ? v.closesAt.toISOString() : null,
    createdAt: v.createdAt.toISOString(),
    applicationsCount: v._count.applications,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#0A0A0A]">Vacancies &amp; Roles</h2>
        <p className="text-xs text-[#64748B]">
          Manage published opportunities, draft new roles, and oversee application deadlines.
        </p>
      </div>

      <VacanciesListTable
        initialVacancies={formatted}
        isGlobalAdmin={access.isGlobalAdmin}
      />
    </div>
  )
}
