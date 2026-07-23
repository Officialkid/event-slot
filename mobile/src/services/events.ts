import { demoEvents } from "../data/demo";
import { EventDraft, NativeEvent } from "../domain/events";
import { AppSession } from "../session";

export async function listNativeEvents(session: AppSession): Promise<NativeEvent[]> {
  if (session.authMode === "live") {
    throw new Error("Live native event loading needs the mobile session endpoint before it can be enabled.");
  }

  return demoEvents;
}

export function findNativeEvent(events: NativeEvent[], eventId: string): NativeEvent | undefined {
  return events.find((event) => event.id === eventId);
}

export function createDraftPreview(draft: EventDraft): NativeEvent {
  return {
    id: draft.id || "draft-preview",
    slug: "draft-preview",
    title: draft.title || "Untitled Event",
    status: "Draft",
    dateLabel: draft.dateLabel || "Date not set",
    timeLabel: "TBD",
    venue: draft.venue || "Venue not set",
    attendees: 0,
    waitlist: 0,
    capacity: Number.parseInt(draft.capacity, 10) || 0,
    verifierCode: "NEW",
    role: "Owner",
    paymentMode: draft.entryFeeLabel ? "Paid externally" : "Registration only",
    exportsReady: false,
    eventType: draft.eventType,
    accessType: draft.accessType,
    mapDirectionsUrl: draft.mapDirectionsUrl.trim() || undefined,
    entryFeeLabel: draft.entryFeeLabel.trim() || undefined,
    whatsappNumber: draft.whatsappNumber.trim() || undefined,
    attendeeConsentEnabled: draft.attendeeConsentEnabled,
    attendeeConsentText: draft.attendeeConsentText.trim() || undefined,
    attachmentRequirement: draft.attachmentRequirement.enabled ? draft.attachmentRequirement : undefined
  };
}
