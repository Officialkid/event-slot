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
        <h1 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.5rem", fontWeight: 400, color: "#F0EDE6", margin: "0 0 0.35rem", lineHeight: 1.1 }}>
          Payments
        </h1>
        <p style={{ margin: 0, fontSize: "0.9rem", color: "rgba(240,237,230,0.5)", fontFamily: "var(--font-dm-sans)", lineHeight: 1.7 }}>
          Payment tools are temporarily unavailable while EventSlot completes live payment maintenance.
        </p>
      </div>
      <PaymentMaintenanceBanner compact />
    </div>
  )
}
