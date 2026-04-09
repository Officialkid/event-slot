import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import DashboardShell from "./_shell"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect("/signin")
  }
  if (!session.user.username) {
    redirect("/setup-username")
  }

  return <DashboardShell>{children}</DashboardShell>
}