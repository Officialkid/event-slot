import { Prisma } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { NextRequest } from "next/server";
import { canCreateEvent } from "@/lib/planEnforcement";
import prisma from "@/lib/prisma";
import { detectCountry } from "@/lib/geoip";
import { validateAndEncodeEventContact } from "@/lib/eventContact";
import { generateVerifierCode } from "@/lib/verifierCode";
import { requireNativeAccessToken, createNativeAuthErrorResponse } from "@/lib/nativeAuth";

type NativeCreateEventInput = {
  title?: string;
  description?: string | null;
  accessType?: "public" | "private";
  eventType?: "physical" | "virtual";
  virtualLink?: string | null;
  capacity?: number;
  deadline?: string;
  eventDate?: string;
  eventEndAt?: string | null;
  joinOpensAt?: string | null;
  location?: string | null;
  mapDirectionsUrl?: string | null;
  entryFeeLabel?: string | null;
  attendeeConsentEnabled?: boolean;
  attendeeConsentText?: string | null;
  isPaid?: false;
  ticketsEnabled?: true;
  communityLink?: string | null;
  whatsappNumber?: string | null;
  contactMode?: "email" | "whatsapp" | "both";
  imageUrl?: string | null;
};

function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${base || "event"}-${suffix}`;
}

export async function POST(req: NextRequest) {
  try {
    const nativeUser = await requireNativeAccessToken(req.headers.get("authorization"));
    const enforcement = await canCreateEvent(nativeUser.id, nativeUser.email ?? "");
    if (!enforcement.allowed) {
      return Response.json(
        {
          success: false,
          error: enforcement.reason,
          code: "PLAN_LIMIT_EVENTS",
          upgradeRequired: enforcement.upgradeRequired
        },
        { status: 403 }
      );
    }

    const body = (await req.json()) as NativeCreateEventInput;
    const title = body.title?.trim() ?? "";
    const eventDate = body.eventDate ? new Date(body.eventDate) : null;
    const deadline = body.deadline ? new Date(body.deadline) : null;
    const capacity = Number.isInteger(body.capacity) ? body.capacity : 0;
    const eventType = body.eventType === "virtual" ? "VIRTUAL" : "PHYSICAL";

    if (!title) {
      return Response.json({ success: false, error: "Event title is required." }, { status: 400 });
    }

    if (!eventDate || Number.isNaN(eventDate.getTime())) {
      return Response.json({ success: false, error: "A valid event date is required." }, { status: 400 });
    }

    if (!deadline || Number.isNaN(deadline.getTime())) {
      return Response.json({ success: false, error: "A valid registration deadline is required." }, { status: 400 });
    }

    if (!capacity || capacity <= 0) {
      return Response.json({ success: false, error: "Capacity must be greater than zero." }, { status: 400 });
    }

    if (body.isPaid) {
      return Response.json({ success: false, error: "Native paid-event creation is disabled until payments are approved." }, { status: 400 });
    }

    if (eventType === "VIRTUAL") {
      return Response.json({ success: false, error: "Native virtual-event creation is disabled until virtual link capture is complete." }, { status: 400 });
    }

    let storedEventContact: string | null = null;
    if (body.whatsappNumber?.trim()) {
      const validatedContact = validateAndEncodeEventContact(body.whatsappNumber, "WHATSAPP");
      if (!validatedContact.ok) {
        return Response.json({ success: false, error: validatedContact.error }, { status: 400 });
      }
      storedEventContact = validatedContact.stored;
    }

    const eventCountryCode = await detectCountry(req).catch(() => null);
    const slug = generateSlug(title);
    const dashboardToken = uuidv4();
    const verifierCode = generateVerifierCode();

    const event = await prisma.event.create({
      data: {
        accessType: "REGISTRATION",
        attendeeConsentEnabled: body.attendeeConsentEnabled ?? true,
        attendeeConsentText: body.attendeeConsentText?.trim() || undefined,
        capacity,
        countryCode: eventCountryCode ?? undefined,
        dashboardToken,
        deadline,
        description: body.description ?? undefined,
        entryFeeLabel: body.entryFeeLabel?.trim() || undefined,
        eventDate,
        eventEndAt: body.eventEndAt ? new Date(body.eventEndAt) : undefined,
        eventType,
        imageUrl: body.imageUrl?.trim() || undefined,
        isPaid: false,
        joinOpensAt: body.joinOpensAt ? new Date(body.joinOpensAt) : undefined,
        location: body.location?.trim() || undefined,
        mapDirectionsUrl: body.mapDirectionsUrl?.trim() || undefined,
        organizerEmail: nativeUser.email ?? "",
        organizerId: nativeUser.id,
        paymentsLive: false,
        questions: [
          { id: "fullName", label: "Full name", type: "text", required: true },
          { id: "email", label: "Email address", type: "email", required: true },
          { id: "phone", label: "Phone number", type: "phone", required: true }
        ],
        slug,
        ticketsEnabled: true,
        title,
        verifierCode,
        whatsappNumber: storedEventContact || undefined
      },
      select: {
        accessType: true,
        capacity: true,
        dashboardToken: true,
        id: true,
        slug: true,
        title: true,
        verifierCode: true
      }
    });

    return Response.json(
      {
        accessType: body.accessType ?? "public",
        capacity: event.capacity ?? capacity,
        dashboardToken: event.dashboardToken,
        id: event.id,
        slug: event.slug,
        title: event.title,
        verifierCode: event.verifierCode
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json({ success: false, error: "A similar native event already exists. Please retry." }, { status: 409 });
    }

    return createNativeAuthErrorResponse(error);
  }
}
