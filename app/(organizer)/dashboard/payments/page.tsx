import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { PaymentMaintenanceBanner } from "@/components/billing/PaymentMaintenanceBanner"

export default async function PaymentsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/signin")
  }

  return (
    <div className="dashboard-page-shell" style={{ maxWidth: 920 }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.5rem", fontWeight: 400, color: "var(--text-primary)", margin: "0 0 0.35rem", lineHeight: 1.1 }}>
          Payments
        </h1>
        <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-secondary)", fontFamily: "var(--font-dm-sans)", lineHeight: 1.7 }}>
          We are working on this. Payments will appear here once the live rollout is ready.
        </p>
      </div>
      <PaymentMaintenanceBanner compact />
    </div>
  )
}
