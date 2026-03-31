import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export default async function MyEventsRedirect() {
  const session = await getServerSession(authOptions)
  if (session?.user?.email && session.user.email === process.env.SUPER_ADMIN_EMAIL) {
    redirect("/admin")
  }
  redirect("/dashboard/events")
}
