import Link from "next/link"

export function MarketingFooter() {
  return (
    <footer className="border-t bg-[var(--surface)]" style={{ borderColor: "var(--border)" }}>
      <div className="marketing-shell px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[1rem] font-semibold">
              <span style={{ color: "var(--text-primary)" }}>Event</span>
              <span className="text-[#C8F55A]">Slot</span>
            </p>
            <p className="mt-2 text-[0.84rem] leading-6" style={{ color: "var(--text-muted)" }}>
              Smart registration, waitlist, and walk-in attendance for modern event teams.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.86rem]" style={{ color: "var(--text-secondary)" }}>
            <Link href="/pricing" className="transition-colors hover:text-[var(--text-primary)]">
              Pricing
            </Link>
            <Link href="/for-universities" className="transition-colors hover:text-[var(--text-primary)]">
              Universities
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-[var(--text-primary)]">
              Privacy Policy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-[var(--text-primary)]">
              Terms of Service
            </Link>
          </div>
        </div>

        <div className="mt-6 border-t pt-5 text-[0.8rem]" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
          Copyright EventSlot 2026
        </div>
      </div>
    </footer>
  )
}
