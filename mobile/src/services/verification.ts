import { eventslotRequest } from "../api/client";
import { nativeConfig } from "../config";
import { NativeEvent } from "../domain/events";
import {
  VerificationRequest,
  VerificationResult,
  VerifierAccessRequest,
  VerifierAccessResult
} from "../domain/verification";
import { AppSession } from "../session";

function buildDemoTicket(code: string, event: NativeEvent): VerificationResult {
  const normalizedCode = code.trim().toUpperCase();

  if (!normalizedCode) {
    return {
      status: "error",
      message: "Enter a ticket code, attendee name, or email to verify."
    };
  }

  if (normalizedCode.includes("USED")) {
    return {
      status: "already-used",
      message: "This demo ticket has already been checked in.",
      ticket: {
        registrationId: "demo-used",
        attendeeName: "Used Demo Attendee",
        ticketCode: normalizedCode,
        checkedIn: true,
        checkedInAt: new Date().toISOString(),
        admissionsTotal: 1,
        admissionsUsed: 1,
        admissionsRemaining: 0
      }
    };
  }

  if (normalizedCode.includes("404")) {
    return {
      status: "not-found",
      message: `No demo ticket matched ${normalizedCode} for ${event.title}.`
    };
  }

  return {
    status: "verified",
    message: `${normalizedCode} is valid for ${event.title}.`,
    ticket: {
      registrationId: "demo-verified",
      attendeeName: "Demo Attendee",
      attendeeEmail: "attendee@example.com",
      ticketCode: normalizedCode,
      confirmationCode: normalizedCode,
      checkedIn: true,
      checkedInAt: new Date().toISOString(),
      admissionsTotal: 1,
      admissionsUsed: 1,
      admissionsRemaining: 0
    }
  };
}

export async function requestVerifierAccess(input: VerifierAccessRequest): Promise<VerifierAccessResult> {
  return eventslotRequest<VerifierAccessResult>("/api/verify-tickets/access", {
    method: "POST",
    body: input
  });
}

export async function requestNativeVerifierAccess(
  input: VerifierAccessRequest,
  events: NativeEvent[]
): Promise<VerifierAccessResult> {
  const verifierCode = input.verifierCode.trim().toUpperCase();

  if (!verifierCode) {
    throw new Error("Enter the verifier code shared by the event organiser.");
  }

  if (nativeConfig.authMode === "demo") {
    const matchedEvent = events.find((event) => event.verifierCode.toUpperCase() === verifierCode);
    if (!matchedEvent) {
      throw new Error("No native demo event matched that verifier code.");
    }

    return {
      eventId: matchedEvent.id,
      slug: matchedEvent.slug,
      title: matchedEvent.title,
      verifierToken: `demo-verifier-${matchedEvent.slug}`,
      ticketsEnabled: true
    };
  }

  return requestVerifierAccess({
    ...input,
    verifierCode
  });
}

export async function verifyNativeTicket(
  session: AppSession,
  event: NativeEvent,
  input: Omit<VerificationRequest, "eventSlug" | "verifierToken">
): Promise<VerificationResult> {
  const lookupValue = input.ticketCode ?? input.identity ?? input.qrPayload ?? "";

  if (session.authMode === "demo" || nativeConfig.authMode === "demo") {
    return buildDemoTicket(lookupValue, event);
  }

  if (!session.accessToken) {
    throw new Error("Sign in again before verifying tickets.");
  }

  return eventslotRequest<VerificationResult>(`/api/native/events/${event.slug}/verify-ticket`, {
    method: "POST",
    body: input,
    token: session.accessToken
  });
}
