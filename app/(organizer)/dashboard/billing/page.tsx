import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { BillingComingSoonBanner } from "@/components/billing/BillingComingSoonBanner"
import { PaymentMaintenanceBanner } from "@/components/billing/PaymentMaintenanceBanner"
import { isAdminEmail } from "@/lib/isAdmin"

export default async function BillingPage() {
  const session = await getServerSession(authOptions)
  const isAdmin = isAdminEmail(session?.user?.email)
  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          plan: true,
        },
      })
    : null

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
      <BillingComingSoonBanner isAdmin={isAdmin} compact />

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
          {isAdmin
            ? "The super admin account keeps full system access, but payment-facing features remain hidden while maintenance continues."
            : `Your current account stays on ${user?.plan ?? "free"} access while we finish the payment maintenance work.`}
        </p>
      </section>
    </div>
  )
}
