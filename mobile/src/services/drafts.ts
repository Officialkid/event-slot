import { EventDraft } from "../domain/events";
import { loadNativeStorageValue, removeNativeStorageValue, saveNativeStorageValue } from "./nativeStorage";
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

const eventDraftStorageKey = "eventslot.native.event-draft";

export async function loadEventDraft(): Promise<EventDraft> {
  const eventDraft = await loadNativeStorageValue<EventDraft>(eventDraftStorageKey);
  return eventDraft ? cloneEventDraft(eventDraft) : cloneEventDraft(emptyEventDraft);
}

export async function saveEventDraft(draft: EventDraft): Promise<void> {
  await saveNativeStorageValue(eventDraftStorageKey, cloneEventDraft(draft));
}

export async function clearEventDraft(): Promise<void> {
  await removeNativeStorageValue(eventDraftStorageKey);
}

export function hasEventDraftChanges(draft: EventDraft): boolean {
  return Object.entries(draft).some(([key, value]) => {
    const baseline = emptyEventDraft[key as keyof EventDraft];
    return value !== baseline;
  });
}

function cloneEventDraft(draft: EventDraft): EventDraft {
  return {
    ...draft,
    attachmentRequirement: { ...draft.attachmentRequirement }
  };
}
