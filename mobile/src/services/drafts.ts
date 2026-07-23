import { EventDraft } from "../domain/events";
import { defaultAttachmentRequirement } from "./uploads";

export const emptyEventDraft: EventDraft = {
  id: "local-event-draft",
  title: "",
  dateLabel: "",
  venue: "",
  capacity: "",
  description: "",
  eventType: "physical",
  accessType: "public",
  mapDirectionsUrl: "",
  entryFeeLabel: "",
  whatsappNumber: "",
  attendeeConsentEnabled: false,
  attendeeConsentText: "",
  attachmentRequirement: defaultAttachmentRequirement
};

type DraftStore = {
  eventDraft: EventDraft | null;
};

const memoryStore: DraftStore = {
  eventDraft: null
};

export async function loadEventDraft(): Promise<EventDraft> {
  return memoryStore.eventDraft ? { ...memoryStore.eventDraft } : { ...emptyEventDraft };
}

export async function saveEventDraft(draft: EventDraft): Promise<void> {
  memoryStore.eventDraft = { ...draft };
}

export async function clearEventDraft(): Promise<void> {
  memoryStore.eventDraft = null;
}

export function hasEventDraftChanges(draft: EventDraft): boolean {
  return Object.entries(draft).some(([key, value]) => {
    const baseline = emptyEventDraft[key as keyof EventDraft];
    return value !== baseline;
  });
}
