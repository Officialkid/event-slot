import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
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
        location: true,
        mapDirectionsUrl: true,
        organizerEmail: true,
        organizerId: true,
        questions: true,
        slug: true,
        status: true,
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
