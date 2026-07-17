import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { BillingComingSoonBanner } from "@/components/billing/BillingComingSoonBanner"
import { PaymentMaintenanceBanner } from "@/components/billing/PaymentMaintenanceBanner"

export default async function BillingPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/signin")
  }

  return (
    <div className="dashboard-page-shell" style={{ maxWidth: 920 }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1
          style={{
            fontFamily: "var(--font-instrument-serif)",
            fontSize: "1.5rem",
            fontWeight: 400,
            color: "var(--text-primary)",
            margin: "0 0 0.35rem",
            lineHeight: 1.1,
          }}
        >
          Billing
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: "0.9rem",
            color: "var(--text-secondary)",
            fontFamily: "var(--font-dm-sans)",
            lineHeight: 1.7,
          }}
        >
          We are working on this. Billing changes and payment tools will appear here once the live rollout is ready.
        </p>
      </div>

      <PaymentMaintenanceBanner compact />
      <BillingComingSoonBanner compact />

      <section
        style={{
          background: "var(--surface)",
          border: "0.5px solid color-mix(in srgb, var(--text-primary) 8%, transparent)",
          borderRadius: 14,
          padding: "1.25rem",
          marginBottom: "1rem",
        }}
      >
        <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.88rem", lineHeight: 1.75, fontFamily: "var(--font-dm-sans)" }}>
          Your current access remains available while we finish payment maintenance. This page is intentionally informational only, so no one starts a paid setup before the payment system is ready.
        </p>
      </section>
    </div>
  )
}
