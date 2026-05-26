import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { PioneerCongratulationsModal } from "@/components/PioneerCongratulationsModal"
import { WeeklyRankingPopup } from "@/components/WeeklyRankingPopup"
import { AdminModeBanner } from "@/components/admin/AdminModeBanner"
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
      <AdminModeBanner />
      <div className="admin-mode-aware-layout">
        <DashboardShell>{children}</DashboardShell>
      </div>
      <PioneerCongratulationsModal />
      <WeeklyRankingPopup />
    </ErrorBoundary>
  )
}