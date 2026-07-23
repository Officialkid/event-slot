import { CreatedEventResponse, CreateEventRequest } from "../api/contracts";
import { eventslotRequest } from "../api/client";
import { EventDraft } from "../domain/events";
import { AppSession } from "../session";
import { validateEventDraft } from "./eventValidation";

export type NativeCreateEventPreparation =
  | {
      ready: true;
      request: CreateEventRequest;
    }
  | {
      ready: false;
      reason: string;
    };

export async function submitNativeEventDraft(
  session: AppSession,
  draft: EventDraft
): Promise<CreatedEventResponse> {
  if (session.authMode !== "live" || !session.accessToken) {
    throw new Error("Native publishing needs a live bearer-token session before it can create events.");
  }

  const preparation = prepareNativeCreateEventRequest(draft);
  if (!preparation.ready) {
    throw new Error(preparation.reason);
  }

  return eventslotRequest<CreatedEventResponse>("/api/native/events", {
    method: "POST",
    body: preparation.request,
    token: session.accessToken
  });
}

export function prepareNativeCreateEventRequest(draft: EventDraft): NativeCreateEventPreparation {
  const validation = validateEventDraft(draft);
  if (!validation.canSubmit) {
    return {
      ready: false,
      reason: validation.errors[0]?.message ?? "Fix the draft validation errors before publishing."
    };
  }

  if (draft.eventType === "virtual") {
    return {
      ready: false,
      reason: "Native virtual publishing still needs a Google Meet link field before it can go live."
    };
  }

  const eventDate = parseEventDate(draft.dateLabel);
  if (!eventDate) {
    return {
      ready: false,
      reason: "Use a date format the native app can convert before live publishing."
    };
  }

  const capacity = Number.parseInt(draft.capacity, 10);
  const request: CreateEventRequest = {
    accessType: draft.accessType,
    attendeeConsentEnabled: draft.attendeeConsentEnabled,
    attendeeConsentText: draft.attendeeConsentEnabled ? draft.attendeeConsentText.trim() : undefined,
    capacity,
    contactMode: draft.whatsappNumber.trim() ? "whatsapp" : "email",
    deadline: eventDate.toISOString(),
    description: draft.description,
    entryFeeLabel: draft.entryFeeLabel.trim() || undefined,
    eventDate: eventDate.toISOString(),
    eventType: draft.eventType,
    isPaid: false,
    location: draft.venue.trim(),
    mapDirectionsUrl: draft.mapDirectionsUrl.trim() || undefined,
    ticketsEnabled: true,
    title: draft.title.trim(),
    whatsappNumber: draft.whatsappNumber.trim() || undefined
  };

  return {
    ready: true,
    request
  };
}

export function getNativeCreateEventReadinessMessage(session: AppSession): string {
  if (session.authMode === "demo") {
    return "Native event publishing is wired behind a live-mode guard. Keep using local drafts until bearer-token auth and /api/native/events are implemented.";
  }

  if (!session.accessToken) {
    return "Live mode is selected, but the native session has no access token yet.";
  }

  return "Live native event publishing can call the backend once the draft passes validation and the native endpoint is available.";
}

function parseEventDate(dateLabel: string): Date | null {
  const timestamp = Date.parse(dateLabel);
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return new Date(timestamp);
}
