import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { purgeUserCache } from "@/lib/cache";
import { syncEventPassStatusForEvent } from "@/lib/eventPasses";
import { requireNativeAccessToken, createNativeAuthErrorResponse } from "@/lib/nativeAuth";

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  try {
    const nativeUser = await requireNativeAccessToken(req.headers.get("authorization"));
    const { slug } = await props.params;

    const event = await prisma.event.findUnique({
      where: { slug },
      select: {
        accessType: true,
        archived: true,
        attendeeConsentEnabled: true,
        attendeeConsentText: true,
        capacity: true,
        confirmedCount: true,
        createdAt: true,
        dashboardToken: true,
        deadline: true,
        description: true,
        entryFeeLabel: true,
        eventDate: true,
        eventEndAt: true,
        eventType: true,
        id: true,
        imageUrl: true,
        joinOpensAt: true,
        location: true,
        mapDirectionsUrl: true,
        isPaid: true,
        showRemainingSpots: true,
        organizerEmail: true,
        organizerId: true,
        questions: true,
        slug: true,
        status: true,
        ticketTiers: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            presetKey: true,
            badgeColor: true,
            textColor: true,
            metallic: true,
            prestige: true,
            priceKes: true,
            capacity: true,
            description: true,
            bundleSize: true,
            soldCount: true,
            waitlistCount: true,
            status: true
          }
        },
        ticketsEnabled: true,
        title: true,
        verifierCode: true,
        verifierCodeEnabled: true,
        waitlistCount: true
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
      return Response.json({ success: false, error: "You do not have access to this event." }, { status: 403 });
    }

    const [confirmed, waitlist] = await Promise.all([
      prisma.registration.findMany({
        where: { eventId: event.id, status: "confirmed" },
        select: {
          answers: true,
          id: true,
          source: true,
          submittedAt: true,
          waitlistPosition: true
        },
        orderBy: { submittedAt: "desc" },
        take: 25
      }),
      prisma.registration.findMany({
        where: { eventId: event.id, status: "waitlist" },
        select: {
          answers: true,
          id: true,
          source: true,
          submittedAt: true,
          waitlistPosition: true
        },
        orderBy: [{ waitlistPosition: "asc" }, { submittedAt: "asc" }],
        take: 25
      })
    ]);

    return Response.json({
      success: true,
      event: {
        ...event,
        accessType: "public",
        canEdit: ownsEvent,
        createdAt: event.createdAt.toISOString(),
        deadline: event.deadline?.toISOString() ?? null,
        eventDate: event.eventDate?.toISOString() ?? null,
        eventEndAt: event.eventEndAt?.toISOString() ?? null,
        isPaid: event.isPaid,
        joinOpensAt: event.joinOpensAt?.toISOString() ?? null,
        exportsReady: true,
        role: ownsEvent ? "Owner" : "Team"
      },
      confirmed: confirmed.map((registration) => ({
        ...registration,
        submittedAt: registration.submittedAt.toISOString()
      })),
      waitlist: waitlist.map((registration) => ({
        ...registration,
        submittedAt: registration.submittedAt.toISOString()
      }))
    });
  } catch (error) {
    return createNativeAuthErrorResponse(error);
  }
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  try {
    const nativeUser = await requireNativeAccessToken(req.headers.get("authorization"));
    const { slug } = await props.params;

    const event = await prisma.event.findUnique({
      where: { slug },
      select: {
        archived: true,
        id: true,
        organizerEmail: true,
        organizerId: true
      }
    });

    if (!event) {
      return Response.json({ success: false, error: "Event not found." }, { status: 404 });
    }

    const ownsEvent = event.organizerId === nativeUser.id || (!!nativeUser.email && event.organizerEmail === nativeUser.email);
    if (!ownsEvent) {
      return Response.json({ success: false, error: "Only the event owner can update this mobile organizer action." }, { status: 403 });
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return Response.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
    }

    const action = rawBody && typeof rawBody === "object" ? (rawBody as { action?: unknown }).action : undefined;
    const archived = rawBody && typeof rawBody === "object" ? (rawBody as { archived?: unknown }).archived : undefined;

    if (action !== "archive" || typeof archived !== "boolean") {
      return Response.json(
        { success: false, error: "Native event updates currently support only the archive action." },
        { status: 400 }
      );
    }

    const updatedEvent = await prisma.event.update({
      where: { slug },
      data: {
        archived
      },
      select: {
        archived: true,
        slug: true
      }
    });

    await syncEventPassStatusForEvent(event.id);

    if (event.organizerId) {
      purgeUserCache(event.organizerId, event.organizerEmail ?? null);
    }

    return Response.json({
      success: true,
      event: updatedEvent
    });
  } catch (error) {
    return createNativeAuthErrorResponse(error);
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  try {
    const nativeUser = await requireNativeAccessToken(req.headers.get("authorization"));
    const { slug } = await props.params;

    const event = await prisma.event.findUnique({
      where: { slug },
      select: {
        id: true,
        organizerEmail: true,
        organizerId: true
      }
    });

    if (!event) {
      return Response.json({ success: false, error: "Event not found." }, { status: 404 });
    }

    const ownsEvent = event.organizerId === nativeUser.id || (!!nativeUser.email && event.organizerEmail === nativeUser.email);
    if (!ownsEvent) {
      return Response.json({ success: false, error: "Only the event owner can delete this event." }, { status: 403 });
    }

    await prisma.event.delete({
      where: { slug }
    });

    if (event.organizerId) {
      purgeUserCache(event.organizerId, event.organizerEmail ?? null);
    }

    return Response.json({ success: true });
  } catch (error) {
    return createNativeAuthErrorResponse(error);
  }
}
