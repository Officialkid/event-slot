import { randomBytes } from "crypto";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { purgeUserCache } from "@/lib/cache";
import { createNativeAuthErrorResponse, requireNativeAccessToken } from "@/lib/nativeAuth";
import { generateVerifierCode } from "@/lib/verifierCode";

function generateSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60) +
    "-" +
    randomBytes(3).toString("hex")
  );
}

export async function POST(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  try {
    const nativeUser = await requireNativeAccessToken(req.headers.get("authorization"));
    const { slug } = await props.params;

    const source = await prisma.event.findUnique({
      where: { slug }
    });

    if (!source) {
      return Response.json({ success: false, error: "Event not found." }, { status: 404 });
    }

    const ownsEvent = source.organizerId === nativeUser.id || (!!nativeUser.email && source.organizerEmail === nativeUser.email);
    if (!ownsEvent) {
      return Response.json({ success: false, error: "Only the event owner can duplicate this event." }, { status: 403 });
    }

    const newTitle = `${source.title} (Copy)`;
    const newSlug = generateSlug(newTitle);
    const newToken = randomBytes(20).toString("hex");
    const verifierCode = generateVerifierCode();

    const duplicate = await prisma.event.create({
      data: {
        title: newTitle,
        description: source.description,
        slug: newSlug,
        capacity: source.capacity,
        eventDate: source.eventDate,
        eventEndAt: source.eventEndAt,
        joinOpensAt: source.joinOpensAt,
        location: source.location,
        mapDirectionsUrl: source.mapDirectionsUrl,
        entryFeeLabel: source.entryFeeLabel,
        showRemainingSpots: source.showRemainingSpots,
        attendeeConsentEnabled: source.attendeeConsentEnabled,
        attendeeConsentText: source.attendeeConsentText,
        communityLink: source.communityLink,
        eventType: source.eventType,
        imageUrl: source.imageUrl,
        category: source.category,
        whatsappNumber: source.whatsappNumber,
        questions: source.questions ?? [],
        organizerEmail: nativeUser.email ?? source.organizerEmail,
        organizerId: nativeUser.id,
        dashboardToken: newToken,
        verifierCode,
        status: "active",
        archived: false
      },
      select: {
        id: true,
        slug: true,
        title: true
      }
    });

    purgeUserCache(nativeUser.id, nativeUser.email ?? null);

    return Response.json({
      success: true,
      event: duplicate
    });
  } catch (error) {
    return createNativeAuthErrorResponse(error);
  }
}
