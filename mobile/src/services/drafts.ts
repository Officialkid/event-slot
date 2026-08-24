import { EventDraft, NativeRegistrationQuestion } from "../domain/events";
import { loadNativeStorageValue, removeNativeStorageValue, saveNativeStorageValue } from "./nativeStorage";
import { defaultAttachmentRequirement } from "./uploads";

const defaultTicketTiers = [
  { id: "regular", name: "Regular", price: "", capacity: "" }
];

const defaultRegistrationQuestions: NativeRegistrationQuestion[] = [
  { id: "name", label: "Full name", type: "text", required: true },
  { id: "email", label: "Email address", type: "email", required: true }
];

export const emptyEventDraft: EventDraft = {
  id: "local-event-draft",
  title: "",
  dateLabel: "",
  venue: "",
  capacity: "",
  description: "",
  eventType: "physical",
  virtualLink: "",
  accessType: "public",
  monetization: "free",
  mapDirectionsUrl: "",
  entryFeeLabel: "",
  showRemainingSpots: true,
  standardPrice: "",
  ticketTiers: defaultTicketTiers,
  whatsappNumber: "",
  attendeeConsentEnabled: false,
  attendeeConsentText: "",
  registrationQuestions: defaultRegistrationQuestions,
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
    ...emptyEventDraft,
    ...draft,
    virtualLink: draft.virtualLink ?? "",
    monetization: draft.monetization ?? "free",
    showRemainingSpots: draft.showRemainingSpots ?? true,
    standardPrice: draft.standardPrice ?? "",
    ticketTiers: (draft.ticketTiers ?? defaultTicketTiers).map((tier, index) => ({
      id: tier.id || `tier-${index + 1}`,
      name: tier.name ?? "",
      price: tier.price ?? "",
      capacity: tier.capacity ?? ""
    })),
    registrationQuestions: (draft.registrationQuestions ?? defaultRegistrationQuestions).map((question, index) => ({
      id: question.id || `question-${index + 1}`,
      label: question.label ?? "",
      type: question.type ?? "text",
      required: question.required ?? false,
      options: question.options?.map((option) => option ?? "").filter(Boolean),
      allowMultiple: question.allowMultiple ?? false,
      optionLimits: question.optionLimits
        ? Object.fromEntries(
            Object.entries(question.optionLimits)
              .map(([option, limit]) => [option, typeof limit === "number" && Number.isFinite(limit) ? limit : null] as const)
              .filter(([option]) => option.trim().length > 0)
          )
        : undefined
    })),
    attachmentRequirement: {
      ...defaultAttachmentRequirement,
      ...(draft.attachmentRequirement ?? defaultAttachmentRequirement)
    }
  };
}

function isStoredEventDraft(value: EventDraft | StoredEventDraft): value is StoredEventDraft {
  return "draft" in value && "savedAt" in value;
}

function stableDraftSnapshot(draft: EventDraft): string {
  return JSON.stringify({
    ...draft,
    ticketTiers: draft.ticketTiers.map((tier) => ({ ...tier })),
    registrationQuestions: draft.registrationQuestions.map((question) => ({
      ...question,
      options: question.options ? [...question.options] : undefined,
      optionLimits: question.optionLimits ? { ...question.optionLimits } : undefined
    })),
    attachmentRequirement: { ...draft.attachmentRequirement }
  });
}
