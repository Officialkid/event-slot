import type { Metadata } from "next"
import { ApplicationDetailView } from "@/components/recruitment/ApplicationDetailView"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Candidate Dossier — EventSlot Recruitment",
  description: "Detailed candidate evaluation and document review.",
}

interface ApplicationPageProps {
  params: Promise<{ id: string }>
}

export default async function AdminApplicationDetailPage({
  params,
}: ApplicationPageProps) {
  const { id } = await params

  return <ApplicationDetailView applicationId={id} />
}
