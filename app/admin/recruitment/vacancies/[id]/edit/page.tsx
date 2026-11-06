import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { notFound, redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { checkRecruitmentAccess } from "@/lib/recruitment/permissions"
import { VacancyForm } from "@/components/recruitment/VacancyForm"

export const dynamic = "force-dynamic"

interface EditVacancyPageProps {
  params: Promise<{ id: string }>
}

export default async function EditVacancyPage({ params }: EditVacancyPageProps) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  const access = await checkRecruitmentAccess(session, { vacancyId: id, requireAdmin: true })
  if (!access.authorized) {
    redirect("/unauthorized")
  }

  const vacancy = await prisma.vacancy.findUnique({
    where: { id },
  })

  if (!vacancy) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#0A0A0A]">Edit Vacancy: {vacancy.title}</h2>
        <p className="text-xs text-[#64748B]">
          Update role details, modify recruitment questions, manage schedule, or change lifecycle status.
        </p>
      </div>

      <VacancyForm initialData={vacancy} isEditing={true} />
    </div>
  )
}
