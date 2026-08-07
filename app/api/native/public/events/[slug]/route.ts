import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { normalizeCommunityLink } from "@/lib/communityLink";
import { parseEventContact } from "@/lib/eventContact";

export async function GET(_req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;

  const event: any = await prisma.event.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      capacity: true,
      confirmedCount: true,
      waitlistCount: true,
      questions: true,
      deadline: true,
      eventDate: true,
      eventEndAt: true,
      joinOpensAt: true,
      eventType: true,
      accessType: true,
      location: true,
      mapDirectionsUrl: true,
      entryFeeLabel: true,
      showRemainingSpots: true,
      attendeeConsentEnabled: true,
      attendeeConsentText: true,
      communityLink: true,
      whatsappNumber: true,
      imageUrl: true,
      status: true,
      archived: true,
      organizerName: true,
      isPaid: true,
      organizer: {
        select: {
          name: true,
          suspended: true
        }
      },
      ticketTiers: {
        where: { status: "ACTIVE" },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          priceKes: true,
          capacity: true,
          soldCount: true,
          waitlistCount: true,
          description: true,
          bundleSize: true
        }
      }
    }
  } as any);

  if (!event || event.archived || event.organizer?.suspended || event.accessType === "WALK_IN") {
    return Response.json({ success: false, error: "Event not found." }, { status: 404 });
  }

  const deadlineIso = event.deadline?.toISOString() ?? null;
  const deadlinePassed = deadlineIso ? new Date(deadlineIso).getTime() <= Date.now() : false;
  const normalizedStatus = event.status === "closed" || deadlinePassed ? "closed" : event.status;
  const parsedContact = parseEventContact(event.whatsappNumber);

  return Response.json({
    success: true,
    event: {
      id: event.id,
      slug: event.slug,
      title: event.title,
      description: event.description,
      capacity: event.capacity,
      confirmedCount: event.confirmedCount,
      waitlistCount: event.waitlistCount,
      questions: event.questions,
      deadline: deadlineIso,
      eventDate: event.eventDate?.toISOString() ?? null,
      eventEndAt: event.eventEndAt?.toISOString() ?? null,
      joinOpensAt: event.joinOpensAt?.toISOString() ?? null,
      eventType: event.eventType,
      accessType: event.accessType,
      location: event.location,
      mapDirectionsUrl: event.mapDirectionsUrl,
      entryFeeLabel: event.entryFeeLabel,
      showRemainingSpots: event.showRemainingSpots,
      attendeeConsentEnabled: event.attendeeConsentEnabled,
      attendeeConsentText: event.attendeeConsentText,
      communityLink: normalizeCommunityLink(event.communityLink) ?? event.communityLink,
      whatsappNumber: parsedContact?.number ?? null,
      contactMode: parsedContact?.mode ?? "WHATSAPP",
      imageUrl: event.imageUrl,
      status: normalizedStatus,
      isPaid: event.isPaid,
      organizerName: event.organizerName ?? event.organizer?.name ?? null,
      ticketTiers: event.ticketTiers
    }
  });
}
