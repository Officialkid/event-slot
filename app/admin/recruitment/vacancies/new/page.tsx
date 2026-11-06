import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { checkRecruitmentAccess } from "@/lib/recruitment/permissions"
import { VacancyForm } from "@/components/recruitment/VacancyForm"

export const dynamic = "force-dynamic"

export default async function NewVacancyPage() {
  const session = await getServerSession(authOptions)
  const access = await checkRecruitmentAccess(session, { requireAdmin: true })
  if (!access.authorized) {
    redirect("/unauthorized")
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#0A0A0A]">Create Opportunity / Vacancy</h2>
        <p className="text-xs text-[#64748B]">
          Configure role specifications, custom intake questions, document requirements, and deadlines.
        </p>
      </div>

      <VacancyForm />
    </div>
  )
}
