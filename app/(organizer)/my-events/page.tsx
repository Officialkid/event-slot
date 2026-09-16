import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { isAdminEmail } from "@/lib/isAdmin"

export default async function MyEventsRedirect() {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect("/signin?callbackUrl=/dashboard/events")
  }
  if (isAdminEmail(session?.user?.email)) {
    redirect("/admin")
  }
  redirect("/dashboard/events")
}
