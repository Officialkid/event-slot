import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { purgeUserCache } from "@/lib/cache";
import { createNativeAuthErrorResponse, requireNativeAccessToken } from "@/lib/nativeAuth";
import { normalizeCommunityLink } from "@/lib/communityLink";
import { parseEventContact, validateAndEncodeEventContact } from "@/lib/eventContact";

const nativeUpdateEventSettingsSchema = z.object({
  title: z.string().min(1).max(200),
  eventType: z.enum(["physical", "virtual"]),
  description: z.string().max(5000).optional().nullable().or(z.literal("")),
  location: z.string().max(300).optional().nullable().or(z.literal("")),
  mapDirectionsUrl: z.string().url("Please provide a valid map directions URL").max(1000).optional().nullable().or(z.literal("")),
  entryFeeLabel: z.string().max(200).optional().nullable().or(z.literal("")),
  deadline: z.string().datetime({ offset: true }).optional().nullable().or(z.literal("")),
  eventDate: z.string().datetime({ offset: true }).optional().nullable().or(z.literal("")),
  eventEndAt: z.string().datetime({ offset: true }).optional().nullable().or(z.literal("")),
  joinOpensAt: z.string().datetime({ offset: true }).optional().nullable().or(z.literal("")),
  showRemainingSpots: z.boolean(),
  attendeeConsentEnabled: z.boolean(),
  attendeeConsentText: z.string().max(1000).optional().nullable().or(z.literal("")),
  communityLink: z.string().max(500).optional().nullable().or(z.literal("")),
  whatsappNumber: z.string().max(40).optional().nullable().or(z.literal("")),
  contactMode: z.enum(["WHATSAPP", "CALL"])
});

export async function PATCH(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  try {
    const nativeUser = await requireNativeAccessToken(req.headers.get("authorization"));
    const { slug } = await props.params;

    const event = await prisma.event.findUnique({
      where: { slug },
      select: {
        id: true,
        organizerEmail: true,
        organizerId: true,
        slug: true
      }
    });

    if (!event) {
      return Response.json({ success: false, error: "Event not found." }, { status: 404 });
    }

    const ownsEvent = event.organizerId === nativeUser.id || (!!nativeUser.email && event.organizerEmail === nativeUser.email);
    const teamAccess = ownsEvent
      ? null
      : await prisma.teamMemberEvent.findFirst({
          where: {
            eventId: event.id,
            teamMember: {
              memberId: nativeUser.id,
              status: "accepted"
            }
          },
          select: { id: true }
        });

    if (!ownsEvent && !teamAccess) {
      return Response.json({ success: false, error: "You do not have access to update this event." }, { status: 403 });
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return Response.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = nativeUpdateEventSettingsSchema.safeParse(rawBody);
    if (!parsed.success) {
      return Response.json(
        {
          success: false,
          error: "Invalid event settings input.",
          details: parsed.error.flatten()
        },
        { status: 400 }
      );
    }

    let storedEventContact: string | null = null;
    if (parsed.data.whatsappNumber?.trim()) {
      const validatedContact = validateAndEncodeEventContact(
        parsed.data.whatsappNumber,
        parsed.data.contactMode === "CALL" ? "CALL" : "WHATSAPP"
      );
      if (!validatedContact.ok) {
        return Response.json({ success: false, error: validatedContact.error }, { status: 400 });
      }
      storedEventContact = validatedContact.stored;
    }

    const updatedEvent = await prisma.event.update({
      where: { slug },
      data: {
        title: parsed.data.title.trim(),
        eventType: parsed.data.eventType === "virtual" ? "VIRTUAL" : "PHYSICAL",
        description: parsed.data.description !== undefined ? parsed.data.description?.trim() || null : undefined,
        location: parsed.data.location !== undefined ? parsed.data.location?.trim() || null : undefined,
        mapDirectionsUrl: parsed.data.mapDirectionsUrl !== undefined ? parsed.data.mapDirectionsUrl?.trim() || null : undefined,
        entryFeeLabel: parsed.data.entryFeeLabel !== undefined ? parsed.data.entryFeeLabel?.trim() || null : undefined,
        deadline: parsed.data.deadline !== undefined ? (parsed.data.deadline ? new Date(parsed.data.deadline) : null) : undefined,
        eventDate: parsed.data.eventDate !== undefined ? (parsed.data.eventDate ? new Date(parsed.data.eventDate) : null) : undefined,
        eventEndAt: parsed.data.eventEndAt !== undefined ? (parsed.data.eventEndAt ? new Date(parsed.data.eventEndAt) : null) : undefined,
        joinOpensAt: parsed.data.joinOpensAt !== undefined ? (parsed.data.joinOpensAt ? new Date(parsed.data.joinOpensAt) : null) : undefined,
        showRemainingSpots: parsed.data.showRemainingSpots,
        attendeeConsentEnabled: parsed.data.attendeeConsentEnabled,
        attendeeConsentText: parsed.data.attendeeConsentText?.trim() || null,
        communityLink: normalizeCommunityLink(parsed.data.communityLink),
        whatsappNumber: parsed.data.whatsappNumber !== undefined ? storedEventContact : undefined
      },
      select: {
        slug: true,
        title: true,
        eventType: true,
        description: true,
        location: true,
        mapDirectionsUrl: true,
        entryFeeLabel: true,
        deadline: true,
        eventDate: true,
        eventEndAt: true,
        joinOpensAt: true,
        showRemainingSpots: true,
        attendeeConsentEnabled: true,
        attendeeConsentText: true,
        communityLink: true,
        whatsappNumber: true
      }
    });

    if (event.organizerId) {
      purgeUserCache(event.organizerId, event.organizerEmail ?? null);
    }
    if (event.organizerId && event.organizerId !== nativeUser.id) {
      purgeUserCache(nativeUser.id, nativeUser.email ?? null);
    }

    const parsedContact = parseEventContact(updatedEvent.whatsappNumber);
    return Response.json({
      success: true,
      event: {
        slug: updatedEvent.slug,
        title: updatedEvent.title,
        eventType: updatedEvent.eventType === "VIRTUAL" ? "virtual" : "physical",
        description: updatedEvent.description,
        location: updatedEvent.location,
        mapDirectionsUrl: updatedEvent.mapDirectionsUrl,
        entryFeeLabel: updatedEvent.entryFeeLabel,
        deadline: updatedEvent.deadline?.toISOString() ?? null,
        eventDate: updatedEvent.eventDate?.toISOString() ?? null,
        eventEndAt: updatedEvent.eventEndAt?.toISOString() ?? null,
        joinOpensAt: updatedEvent.joinOpensAt?.toISOString() ?? null,
        showRemainingSpots: updatedEvent.showRemainingSpots,
        attendeeConsentEnabled: updatedEvent.attendeeConsentEnabled,
        attendeeConsentText: updatedEvent.attendeeConsentText,
        communityLink: updatedEvent.communityLink,
        whatsappNumber: parsedContact?.number ?? null,
        contactMode: parsedContact?.mode ?? "WHATSAPP"
      }
    });
  } catch (error) {
    return createNativeAuthErrorResponse(error);
  }
}
