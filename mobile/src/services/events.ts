import { demoEvents } from "../data/demo";
import { EventDraft, NativeEvent } from "../domain/events";

export async function listNativeEvents(): Promise<NativeEvent[]> {
  return demoEvents;
}

export async function getNativeEvent(eventId: string): Promise<NativeEvent | undefined> {
  return demoEvents.find((event) => event.id === eventId);
}

export function createDraftPreview(draft: EventDraft): NativeEvent {
  return {
    id: "draft-preview",
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
    paymentMode: "Registration only",
    exportsReady: false
  };
}

