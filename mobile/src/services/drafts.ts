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

export type StoredEventDraft = {
  version: 1;
  savedAt: string;
  draft: EventDraft;
};

export type EventDraftRecord = {
  draft: EventDraft;
  savedAt: string | null;
};

export async function loadEventDraft(): Promise<EventDraft> {
  const record = await loadEventDraftRecord();
  return record.draft;
}

export async function loadEventDraftRecord(): Promise<EventDraftRecord> {
  const stored = await loadNativeStorageValue<EventDraft | StoredEventDraft>(eventDraftStorageKey);

  if (!stored) {
    return { draft: cloneEventDraft(emptyEventDraft), savedAt: null };
  }

  if (isStoredEventDraft(stored)) {
    return {
      draft: cloneEventDraft(stored.draft),
      savedAt: stored.savedAt
    };
  }

  return {
    draft: cloneEventDraft(stored),
    savedAt: null
  };
}

export async function saveEventDraft(draft: EventDraft): Promise<string> {
  const savedAt = new Date().toISOString();
  await saveNativeStorageValue<StoredEventDraft>(eventDraftStorageKey, {
    version: 1,
    savedAt,
    draft: cloneEventDraft(draft)
  });
  return savedAt;
}

export async function clearEventDraft(): Promise<void> {
  await removeNativeStorageValue(eventDraftStorageKey);
}

export function hasEventDraftChanges(draft: EventDraft): boolean {
  return stableDraftSnapshot(draft) !== stableDraftSnapshot(emptyEventDraft);
}

export function formatDraftSavedAt(savedAt: string | null): string {
  if (!savedAt) {
    return "not saved yet";
  }

  const savedDate = new Date(savedAt);
  if (Number.isNaN(savedDate.getTime())) {
    return "saved on this device";
  }

  return savedDate.toLocaleString(undefined, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  });
}

function cloneEventDraft(draft: EventDraft): EventDraft {
  return {
    ...draft,
    attachmentRequirement: { ...draft.attachmentRequirement }
  };
}

function isStoredEventDraft(value: EventDraft | StoredEventDraft): value is StoredEventDraft {
  return "draft" in value && "savedAt" in value;
}

function stableDraftSnapshot(draft: EventDraft): string {
  return JSON.stringify({
    ...draft,
    attachmentRequirement: { ...draft.attachmentRequirement }
  });
}
