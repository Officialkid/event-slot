import type { Metadata } from "next"
import { notFound } from "next/navigation"
import prisma from "@/lib/prisma"
import PublicWalkInEventPage from "@/components/events/PublicWalkInEventPage"
import { APP_URL } from "@/lib/config"

async function getWalkInEventMetaBySlug(slug: string) {
  return prisma.event.findUnique({
    where: { slug },
    select: {
      title: true,
      description: true,
      location: true,
      accessType: true,
      eventDate: true,
      imageUrl: true,
    },
  })
}

async function getWalkInEventBySlug(slug: string) {
  return prisma.event.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      accessType: true,
      eventDate: true,
      eventEndAt: true,
      location: true,
      mapDirectionsUrl: true,
      entryFeeLabel: true,
      attendeeConsentEnabled: true,
      attendeeConsentText: true,
      communityLink: true,
      imageUrl: true,
      status: true,
      faqEnabled: true,
      whatsappNumber: true,
      faqs: { orderBy: { order: "asc" }, select: { id: true, question: true, answer: true } },
      organizer: { select: { name: true, plan: true, suspended: true, pioneerBadge: { select: { id: true } } } },
    },
  })
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const event = await getWalkInEventMetaBySlug(slug)
  if (!event || event.accessType !== "WALK_IN") return {}

  const canonical = `${APP_URL}/walkin/${slug}`
  const locationText = event.location ? ` at ${event.location}` : ""
  const dateText = event.eventDate
    ? ` on ${event.eventDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
    : ""
  const richDescription =
    event.description ??
    `Check in for ${event.title}${locationText}${dateText}. Powered by EventSlot.`

  return {
    title: `${event.title} - Walk-In Check-In`,
    description: richDescription,
    alternates: { canonical },
    openGraph: {
      title: event.title,
      description: richDescription,
      url: canonical,
      images: event.imageUrl ? [{ url: event.imageUrl, width: 1200, height: 630, alt: event.title }] : undefined,
      type: "website",
    },
    twitter: {
      card: event.imageUrl ? "summary_large_image" : "summary",
      title: event.title,
      description: richDescription,
      images: event.imageUrl ? [event.imageUrl] : undefined,
    },
  }
}

export default async function WalkInEventPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const event = await getWalkInEventBySlug(slug)

  if (!event || event.accessType !== "WALK_IN") notFound()

  if (event.organizer?.suspended) {
    return (
      <main style={{ background: "var(--bg-page)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)", fontSize: "0.9rem" }}>
          This event is currently unavailable.
        </p>
      </main>
    )
  }

  try {
    await prisma.eventView.create({ data: { eventId: event.id } })
  } catch {
    // Ignore analytics write failures on public pages.
  }

  return <PublicWalkInEventPage event={event} />
}
