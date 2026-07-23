import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { createNativeAuthErrorResponse, requireNativeAccessToken } from "@/lib/nativeAuth";
import { verifyQRPayload } from "@/lib/ticket-qr";

type EventQuestion = { id: string; type: string; label: string };

type VerifyBody = {
  code?: string;
  identity?: string;
  qrPayload?: string;
  ticketCode?: string;
  entrantName?: string;
};

type RegistrationLookup = {
  id: string;
  status: string;
  attendeeEmail: string | null;
  checkedIn: boolean;
  checkedInAt: Date | null;
  confirmationCode: string | null;
  answers: unknown;
  registrationNumber: number | null;
  ticket: {
    id: string;
    code: string;
    scannedAt: Date | null;
    admissionsTotal: number;
    admissionsUsed: number;
    verifiedEntries: unknown;
  } | null;
};

const registrationSelect = {
  id: true,
  status: true,
  attendeeEmail: true,
  checkedIn: true,
  checkedInAt: true,
  confirmationCode: true,
  answers: true,
  registrationNumber: true,
  ticket: {
    select: {
      id: true,
      code: true,
      scannedAt: true,
      admissionsTotal: true,
      admissionsUsed: true,
      verifiedEntries: true
    }
  }
};

function extractCode(input: string): string {
  const raw = input.trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const verifyIdx = parts.findIndex((part) => part.toLowerCase() === "verify");
    if (verifyIdx >= 0 && parts[verifyIdx + 1]) {
      return decodeURIComponent(parts[verifyIdx + 1]);
    }
  } catch {
    // The input may already be a plain ticket or confirmation code.
  }

  return raw;
}

function getNameFromAnswers(answers: unknown, questions: EventQuestion[]): string {
  if (!Array.isArray(answers)) return "";

  const nameQuestionIds = questions
    .filter((question) => question.type === "text" && question.label.toLowerCase().includes("name"))
    .map((question) => question.id);

  for (const answer of answers) {
    if (!answer || typeof answer !== "object") continue;
    const record = answer as Record<string, unknown>;
    const questionId = typeof record.questionId === "string" ? record.questionId : "";
    const value = typeof record.value === "string" ? record.value.trim() : "";
    if (questionId && value && nameQuestionIds.includes(questionId)) {
      return value;
    }
  }

  return "";
}

function normalizeVerifiedEntries(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((entry) => !!entry && typeof entry === "object") as Array<Record<string, unknown>> : [];
}

function buildTicketPayload(params: {
  registrationId: string;
  registrationNumber: number | null;
  attendeeName: string;
  attendeeEmail: string | null;
  confirmationCode: string | null;
  ticketCode: string;
  scannedAt: Date | null;
  checkedInAt: Date | null;
  admissionsTotal: number;
  admissionsUsed: number;
}) {
  return {
    registrationId: params.registrationId,
    registrationNumber: params.registrationNumber,
    attendeeName: params.attendeeName,
    attendeeEmail: params.attendeeEmail,
    confirmationCode: params.confirmationCode,
    ticketCode: params.ticketCode,
    checkedIn: params.admissionsUsed > 0,
    checkedInAt: params.checkedInAt?.toISOString() ?? null,
    admissionsTotal: params.admissionsTotal,
    admissionsUsed: params.admissionsUsed,
    admissionsRemaining: Math.max(0, params.admissionsTotal - params.admissionsUsed),
    scannedAt: params.scannedAt?.toISOString() ?? null
  };
}

function verificationResponse(
  status: "verified" | "already-used" | "not-found" | "error",
  message: string,
  ticket?: ReturnType<typeof buildTicketPayload>,
  init?: ResponseInit
) {
  return Response.json(
    {
      message,
      status,
      success: status === "verified" || status === "already-used",
      ticket
    },
    init
  );
}

export async function POST(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  try {
    const nativeUser = await requireNativeAccessToken(req.headers.get("authorization"));
    const { slug } = await props.params;
    const body = (await req.json()) as VerifyBody;

    const event = await prisma.event.findFirst({
      where: { OR: [{ slug }, { id: slug }] },
      select: {
        id: true,
        organizerEmail: true,
        organizerId: true,
        questions: true
      }
    });

    if (!event) {
      return verificationResponse("not-found", "Event not found.", undefined, { status: 404 });
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
      return verificationResponse("error", "You do not have access to verify this event.", undefined, { status: 403 });
    }

    const normalizedCode = body.code ? extractCode(body.code) : "";
    const normalizedIdentity = body.identity?.trim() ?? "";
    const normalizedQrPayload = body.qrPayload?.trim() ?? "";
    const normalizedTicketCode = body.ticketCode?.trim().toUpperCase() ?? "";
    const scannedPayload = normalizedQrPayload || (normalizedCode.includes(":") ? normalizedCode : "");
    const exactCode = normalizedTicketCode || (!scannedPayload ? normalizedCode : "");

    if (!exactCode && !normalizedIdentity && !scannedPayload) {
      return verificationResponse("error", "Provide a ticket code, QR code, or attendee identity.", undefined, { status: 400 });
    }

    const questions = Array.isArray(event.questions) ? event.questions as EventQuestion[] : [];
    const target = await findRegistration({
      eventId: event.id,
      exactCode,
      identity: normalizedIdentity,
      qrPayload: scannedPayload,
      questions
    });

    if (target.status === "multiple") {
      return verificationResponse("error", "Multiple tickets matched this name or email. Use the ticket code for exact verification.", undefined, { status: 409 });
    }

    if (target.status === "invalid-qr") {
      await logEntry(event.id, null, null, false, "INVALID_SIGNATURE");
      return verificationResponse("error", "This ticket is not valid for verification.", undefined, { status: 403 });
    }

    if (target.status === "wrong-event") {
      await logEntry(event.id, null, null, false, "WRONG_EVENT");
      return verificationResponse("error", "This ticket belongs to a different event.", undefined, { status: 403 });
    }

    const registration = target.registration;
    if (!registration) {
      await logEntry(event.id, exactCode || scannedPayload || normalizedIdentity || null, null, false, "TICKET_NOT_FOUND");
      return verificationResponse("not-found", "No ticket found for this event.", undefined, { status: 404 });
    }

    const attendeeName = getNameFromAnswers(registration.answers, questions) || body.entrantName?.trim() || "Attendee";
    const ticketCode = registration.ticket?.code ?? registration.confirmationCode ?? registration.id;

    if (registration.status !== "confirmed") {
      await logEntry(event.id, ticketCode, attendeeName, false, "NOT_CONFIRMED");
      return verificationResponse("error", "Ticket exists but the registration is not confirmed.", undefined, { status: 400 });
    }

    const admissionsTotal = Math.max(1, registration.ticket?.admissionsTotal ?? 1);
    const admissionsUsed = Math.max(0, registration.ticket?.admissionsUsed ?? (registration.checkedIn ? 1 : 0));

    if ((registration.ticket && admissionsUsed >= admissionsTotal) || (!registration.ticket && registration.checkedIn)) {
      await logEntry(event.id, ticketCode, attendeeName, false, "ALREADY_SCANNED");
      return verificationResponse(
        "already-used",
        "Ticket already verified and used.",
        buildTicketPayload({
          registrationId: registration.id,
          registrationNumber: registration.registrationNumber,
          attendeeName,
          attendeeEmail: registration.attendeeEmail,
          confirmationCode: registration.confirmationCode,
          ticketCode,
          scannedAt: registration.ticket?.scannedAt ?? registration.checkedInAt,
          checkedInAt: registration.checkedInAt,
          admissionsTotal,
          admissionsUsed
        })
      );
    }

    const verifiedAt = new Date();
    const nextAdmissionsUsed = admissionsUsed + 1;
    const nextVerifiedEntries = [
      ...normalizeVerifiedEntries(registration.ticket?.verifiedEntries),
      {
        email: registration.attendeeEmail,
        name: body.entrantName?.trim() || attendeeName,
        source: scannedPayload ? "native-scan" : normalizedIdentity ? "native-lookup" : "native-ticket-code",
        verifiedAt: verifiedAt.toISOString()
      }
    ] as Prisma.InputJsonValue;

    await prisma.$transaction(async (tx) => {
      if (registration.ticket) {
        await tx.ticket.update({
          where: { id: registration.ticket.id },
          data: {
            admissionsUsed: nextAdmissionsUsed,
            scannedAt: verifiedAt,
            verifiedEntries: nextVerifiedEntries
          }
        });
      }

      await tx.registration.update({
        where: { id: registration.id },
        data: {
          checkedIn: true,
          checkedInAt: verifiedAt
        }
      });
    });

    await logEntry(event.id, ticketCode, attendeeName, true);

    const remaining = Math.max(0, admissionsTotal - nextAdmissionsUsed);
    return verificationResponse(
      "verified",
      remaining > 0 ? `${nextAdmissionsUsed} of ${admissionsTotal} entries verified. ${remaining} remaining.` : "Ticket verified successfully.",
      buildTicketPayload({
        registrationId: registration.id,
        registrationNumber: registration.registrationNumber,
        attendeeName,
        attendeeEmail: registration.attendeeEmail,
        confirmationCode: registration.confirmationCode,
        ticketCode,
        scannedAt: verifiedAt,
        checkedInAt: verifiedAt,
        admissionsTotal,
        admissionsUsed: nextAdmissionsUsed
      })
    );
  } catch (error) {
    return createNativeAuthErrorResponse(error);
  }
}

async function findRegistration(input: {
  eventId: string;
  exactCode: string;
  identity: string;
  qrPayload: string;
  questions: EventQuestion[];
}): Promise<{ status: "found" | "missing" | "multiple" | "invalid-qr" | "wrong-event"; registration: RegistrationLookup | null }> {
  if (input.qrPayload && input.qrPayload.includes(":")) {
    const qr = verifyQRPayload(input.qrPayload);
    if (!qr.valid) return { status: "invalid-qr", registration: null };
    if (qr.eventId !== input.eventId) return { status: "wrong-event", registration: null };

    const registration = await prisma.registration.findFirst({
      where: {
        eventId: input.eventId,
        id: qr.userId!,
        OR: [{ confirmationCode: qr.ticketId! }, { id: qr.ticketId! }]
      },
      select: registrationSelect
    });

    return { status: registration ? "found" : "missing", registration: registration as RegistrationLookup | null };
  }

  const lookupCode = input.exactCode || input.qrPayload;
  if (lookupCode) {
    const ticket = await prisma.ticket.findUnique({
      where: { code: lookupCode.toUpperCase() },
      include: {
        registration: {
          select: {
            eventId: true,
            ...registrationSelect
          }
        }
      }
    });

    if (ticket?.registration.eventId === input.eventId) {
      const registration = {
        ...ticket.registration,
        ticket: {
          id: ticket.id,
          code: ticket.code,
          scannedAt: ticket.scannedAt,
          admissionsTotal: ticket.admissionsTotal,
          admissionsUsed: ticket.admissionsUsed,
          verifiedEntries: ticket.verifiedEntries
        }
      };
      return { status: "found", registration: registration as RegistrationLookup };
    }

    const registration = await prisma.registration.findFirst({
      where: {
        eventId: input.eventId,
        OR: [{ confirmationCode: lookupCode }, { qrCode: lookupCode }]
      },
      select: registrationSelect
    });

    return { status: registration ? "found" : "missing", registration: registration as RegistrationLookup | null };
  }

  const candidates = await prisma.registration.findMany({
    where: {
      eventId: input.eventId,
      status: "confirmed"
    },
    orderBy: { submittedAt: "desc" },
    select: registrationSelect,
    take: 1000
  }) as RegistrationLookup[];

  const query = input.identity.toLowerCase();
  const isEmailLookup = query.includes("@");
  const matches = candidates.filter((registration) => {
    if (isEmailLookup) {
      return (registration.attendeeEmail ?? "").toLowerCase() === query;
    }
    return getNameFromAnswers(registration.answers, input.questions).toLowerCase() === query;
  });

  if (matches.length > 1) return { status: "multiple", registration: null };
  return { status: matches[0] ? "found" : "missing", registration: matches[0] ?? null };
}

async function logEntry(eventId: string, ticketId: string | null, attendeeName: string | null, success: boolean, failReason?: string) {
  await prisma.entryLog.create({
    data: {
      attendeeName: attendeeName ?? "Unknown",
      eventId,
      failReason: failReason ?? null,
      success,
      ticketId: ticketId ?? "unknown"
    }
  }).catch(console.error);
}
