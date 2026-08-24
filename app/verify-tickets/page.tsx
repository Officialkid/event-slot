import Link from "next/link"
import { VerifyAccessForm } from "@/components/verify/VerifyAccessForm"

export const metadata = {
  title: "Verify Tickets",
  description: "Standalone EventSlot ticket verification entry for event teams.",
}

export default function VerifyTicketsLandingPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] px-5 py-10 text-[var(--text-primary)]">
      <section className="mx-auto flex min-h-[70vh] max-w-3xl flex-col justify-center">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#C8F55A]">
          EventSlot Verify
        </p>
        <h1 className="font-[var(--font-instrument-serif)] text-4xl font-normal leading-tight md:text-6xl">
          Enter the event code. Start checking tickets.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--text-secondary)]">
          This verifier-only workspace is built for gate teams and temporary
          volunteers. Organisers share one event code, and verifiers only access
          Scan, Search, and Upload tools for that event.
        </p>
        <VerifyAccessForm />
        <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            Have a verifier link?
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            Open the exact link shared by the event organiser. It should look
            like <span className="text-[#C8F55A]">eventsslot.com/verify-tickets/event-slug</span>
            and include a verifier code token.
          </p>
        </div>
        <Link
          href="/"
          className="mt-8 inline-flex w-fit rounded-full bg-[#C8F55A] px-5 py-3 text-sm font-bold text-black"
        >
          Back to EventSlot
        </Link>
      </section>
    </main>
  )
}
