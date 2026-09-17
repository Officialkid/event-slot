import Link from "next/link"
import { NewsletterSubscribeForm } from "./NewsletterSubscribeForm"

export function MarketingFooter() {
  return (
    <footer className="border-t bg-[var(--surface)]" style={{ borderColor: "var(--border)" }}>
      <div className="marketing-shell px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-8 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="lg:col-span-6">
            <p className="text-[1.1rem] font-semibold">
              <span style={{ color: "var(--text-primary)" }}>Event</span>
              <span className="text-[#C8F55A]">Slot</span>
            </p>
            <p className="mt-2 text-[0.84rem] leading-6 max-w-sm" style={{ color: "var(--text-muted)" }}>
              Smart registration, waitlist, and walk-in attendance for modern event teams.
            </p>
          </div>

          <div className="lg:col-span-6 flex lg:justify-end">
            <NewsletterSubscribeForm />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-6 text-[0.84rem]" style={{ color: "var(--text-secondary)" }}>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/pricing" className="transition-colors hover:text-[var(--text-primary)]">
              Pricing
            </Link>
            <Link href="/for-universities" className="transition-colors hover:text-[var(--text-primary)]">
              Universities
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-[var(--text-primary)]">
              Privacy Policy
            </Link>
            <Link href="/cookies" className="transition-colors hover:text-[var(--text-primary)]">
              Cookie Policy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-[var(--text-primary)]">
              Terms of Service
            </Link>
          </div>

          <div className="text-[0.8rem]" style={{ color: "var(--text-muted)" }}>
            © EventSlot 2026. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  )
}
