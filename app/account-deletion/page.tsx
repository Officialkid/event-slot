import type { Metadata } from "next"
import Link from "next/link"
import { MarketingFooter } from "@/components/MarketingFooter"

export const metadata: Metadata = {
  title: "Delete Your EventSlot Account",
  description: "How EventSlot users can delete their account and request removal of associated personal data.",
}

const deletedItems = [
  "Your EventSlot user account and profile details.",
  "Your organiser dashboard access and saved profile settings.",
  "Events, registrations, team access, uploads, and attendee data owned by your account where deletion is legally and operationally allowed.",
  "Marketing email preferences and non-essential communication records linked to your account.",
]

const retainedItems = [
  "Security, abuse-prevention, audit, and legal records may be retained for a limited period where required.",
  "Transaction references, tax/accounting records, or payment-provider records may be retained where applicable. EventSlot does not store card numbers.",
  "Data already exported or held by an event organiser may need to be handled directly with that organiser if EventSlot is only hosting the form.",
]

export default function AccountDeletionPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/" className="text-sm font-semibold text-accent hover:underline">
          EventSlot
        </Link>

        <header className="mt-8 mb-10">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-accent">Account deletion</p>
          <h1 className="mb-4 text-3xl font-bold text-text-primary">Delete your EventSlot account and data</h1>
          <p className="text-sm leading-relaxed text-text-secondary">
            This page explains how EventSlot users can request account deletion and what happens to associated
            personal data. EventSlot is the app and developer name shown on Google Play.
          </p>
        </header>

        <section className="mb-8 rounded-2xl border border-border-brand bg-[var(--surface)] p-6">
          <h2 className="mb-3 text-xl font-bold text-text-primary">Option 1: Delete from your account</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-text-secondary">
            <li>Sign in at www.eventsslot.com.</li>
            <li>Open Dashboard, then Profile.</li>
            <li>Go to the Danger zone / Delete account section.</li>
            <li>Confirm the deletion prompt to permanently delete your account where available.</li>
          </ol>
        </section>

        <section className="mb-8 rounded-2xl border border-border-brand bg-[var(--surface)] p-6">
          <h2 className="mb-3 text-xl font-bold text-text-primary">Option 2: Request deletion by email</h2>
          <p className="mb-4 text-sm leading-relaxed text-text-secondary">
            If you cannot access your account, email us from the account email address and include the subject
            “Delete my EventSlot account”.
          </p>
          <a
            href="mailto:info@eventsslot.com?subject=Delete%20my%20EventSlot%20account"
            className="inline-flex rounded-full bg-accent px-5 py-3 text-sm font-bold text-black hover:opacity-90"
          >
            Email deletion request
          </a>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-bold text-text-primary">Data deleted</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-text-secondary">
            {deletedItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-bold text-text-primary">Data that may be retained</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-text-secondary">
            {retainedItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-border-brand bg-[var(--surface)] p-6">
          <h2 className="mb-3 text-xl font-bold text-text-primary">Response time</h2>
          <p className="text-sm leading-relaxed text-text-secondary">
            We aim to review deletion requests within a reasonable time and may ask you to verify ownership of the
            account before processing the request.
          </p>
        </section>
      </div>
      <MarketingFooter />
    </main>
  )
}
