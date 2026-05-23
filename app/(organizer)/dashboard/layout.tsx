import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { PioneerCongratulationsModal } from "@/components/PioneerCongratulationsModal"
import { WeeklyRankingPopup } from "@/components/WeeklyRankingPopup"
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

  return (
    <>
      <DashboardShell>{children}</DashboardShell>
      <PioneerCongratulationsModal />
      <WeeklyRankingPopup />
    </>
  )
}