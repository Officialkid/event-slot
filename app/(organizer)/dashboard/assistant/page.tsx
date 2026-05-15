import { AssistantExperience } from "@/components/assistant/AssistantExperience"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function AssistantPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/signin")
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8">
      <AssistantExperience fullPage />
    </div>
  )
}
