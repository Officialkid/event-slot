import { REPORT_DOWNLOAD_PRICING } from "@/lib/plans"

const PACKAGES = Object.values(REPORT_DOWNLOAD_PRICING)

export default function BillingPage() {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.6rem", fontWeight: 400, color: "#F0EDE6", margin: "0 0 0.25rem" }}>
          Billing
        </h1>
        <p style={{ margin: 0, fontSize: "0.9rem", color: "rgba(240,237,230,0.45)", fontFamily: "var(--font-dm-sans)", lineHeight: 1.6 }}>
          EventSlot features are free. Paid actions include report downloads and optional token top-ups.
        </p>
      </div>

      <section
        style={{
          background: "#141414",
          border: "0.5px solid rgba(240,237,230,0.08)",
          borderRadius: 12,
          padding: "1.25rem",
          marginBottom: "1rem",
        }}
      >
        <h2 style={{ margin: "0 0 0.75rem", fontFamily: "var(--font-instrument-serif)", fontSize: "1.15rem", fontWeight: 400, color: "#F0EDE6" }}>
          Token balance
        </h2>
        <p style={{ margin: 0, color: "rgba(240,237,230,0.6)", fontFamily: "var(--font-dm-sans)", fontSize: "0.875rem", lineHeight: 1.6 }}>
          Tokens are used for premium actions such as report generation. You can view and top up tokens from the Tokens page.
        </p>
      </section>

      <section
        style={{
          background: "#141414",
          border: "0.5px solid rgba(240,237,230,0.08)",
          borderRadius: 12,
          padding: "1.25rem",
          marginBottom: "1rem",
        }}
      >
        <h2 style={{ margin: "0 0 0.75rem", fontFamily: "var(--font-instrument-serif)", fontSize: "1.15rem", fontWeight: 400, color: "#F0EDE6" }}>
          Report download packages
        </h2>
        <div style={{ display: "grid", gap: "0.6rem" }}>
          {PACKAGES.map((pkg) => (
            <div
              key={pkg.label}
              style={{
                border: "0.5px solid rgba(240,237,230,0.08)",
                borderRadius: 10,
                background: "rgba(240,237,230,0.02)",
                padding: "0.75rem 0.875rem",
                fontFamily: "var(--font-dm-sans)",
                color: "rgba(240,237,230,0.8)",
                fontSize: "0.875rem",
              }}
            >
              {pkg.label}
            </div>
          ))}
        </div>
      </section>

      <section
        style={{
          background: "#141414",
          border: "0.5px solid rgba(240,237,230,0.08)",
          borderRadius: 12,
          padding: "1.25rem",
        }}
      >
        <h2 style={{ margin: "0 0 0.75rem", fontFamily: "var(--font-instrument-serif)", fontSize: "1.15rem", fontWeight: 400, color: "#F0EDE6" }}>
          How billing works
        </h2>
        <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "rgba(240,237,230,0.55)", fontFamily: "var(--font-dm-sans)", fontSize: "0.86rem", lineHeight: 1.7 }}>
          <li>Creating events, registrations, analytics, insights, feedback, and team collaboration are free.</li>
          <li>Report downloads are paid, based on the package you choose.</li>
          <li>Token-based premium actions use your available token balance.</li>
          <li>Your package download count is consumed when a report file is generated.</li>
        </ul>
      </section>
    </div>
  )
}