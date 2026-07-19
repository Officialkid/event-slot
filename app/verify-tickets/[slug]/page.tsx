import Link from "next/link"
import { notFound } from "next/navigation"
import { ScannerHome } from "@/components/scanner/ScannerHome"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ token?: string }>
}

function formatEventDate(value: Date | null) {
  if (!value) return "Date not set"
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Nairobi",
  }).format(value)
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const event = await prisma.event.findUnique({
    where: { slug },
    select: { title: true },
  })

  return {
    title: event ? `Verify ${event.title}` : "Verify Tickets",
    description: "Standalone EventSlot ticket verification tools.",
  }
}

export default async function StandaloneVerifyTicketsPage({ params, searchParams }: Props) {
  const { slug } = await params
  const query = await searchParams
  const token = typeof query.token === "string" ? query.token.trim() : ""

  const event = await prisma.event.findUnique({
    where: { slug },
    select: {
      title: true,
      slug: true,
      eventDate: true,
      location: true,
      archived: true,
      status: true,
      ticketsEnabled: true,
    },
  })

  if (!event || event.archived) notFound()

  const isClosed = event.status !== "active"

  return (
    <main className="min-h-screen bg-[var(--bg)] px-4 py-6 text-[var(--text-primary)] md:px-8">
      <section className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link href="/verify-tickets" className="text-sm text-[var(--text-secondary)] hover:text-[#C8F55A]">
            EventSlot Verify
          </Link>
          <Link href={`/${event.slug}`} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-secondary)]">
            View public event
          </Link>
        </div>

        <header className="mb-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 md:p-7">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#C8F55A]">
            Verifier workspace
          </p>
          <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <h1 className="font-[var(--font-instrument-serif)] text-3xl font-normal leading-tight md:text-5xl">
                {event.title}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
                Scan ticket QR codes, upload ticket softcopies, or search by
                attendee details. Verifiers only need this focused page at the gate.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 text-sm text-[var(--text-secondary)] md:min-w-64">
              <p><span className="text-[var(--text-primary)]">Date:</span> {formatEventDate(event.eventDate)}</p>
              <p className="mt-2"><span className="text-[var(--text-primary)]">Venue:</span> {event.location ?? "Not provided"}</p>
              <p className="mt-2"><span className="text-[var(--text-primary)]">Status:</span> {event.status}</p>
            </div>
          </div>
        </header>

        {!token && (
          <div className="mb-4 rounded-2xl border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.08)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
            You are viewing this without an event token. If you are not signed in
            as the organiser, assigned team member, or super admin, verification
            actions will be rejected. Future verifier invites will open this page
            with an event-scoped secure link.
          </div>
        )}

        {isClosed && (
          <div className="mb-4 rounded-2xl border border-[rgba(255,107,107,0.35)] bg-[rgba(255,107,107,0.08)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
            This event is currently {event.status}. Verification may be limited
            unless the organiser reopens it.
          </div>
        )}

        {!event.ticketsEnabled && (
          <div className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
            Ticket generation is currently off for this event. Turn on tickets
            from the organiser event dashboard before gate verification.
          </div>
        )}

        <ScannerHome eventSlug={event.slug} accessToken={token} />
      </section>
    </main>
  )
}
