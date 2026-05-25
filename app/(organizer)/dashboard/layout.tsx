import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { PioneerCongratulationsModal } from "@/components/PioneerCongratulationsModal"
import { WeeklyRankingPopup } from "@/components/WeeklyRankingPopup"
import { ErrorBoundary } from "@/components/ErrorBoundary"
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
    <ErrorBoundary>
      <DashboardShell>{children}</DashboardShell>
      <PioneerCongratulationsModal />
      <WeeklyRankingPopup />
    </ErrorBoundary>
  )
}