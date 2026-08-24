import { CreatedEventResponse, CreateEventRequest } from "../api/contracts";
import { eventslotRequest } from "../api/client";
import { EventDraft, NativeTicketTierDraft } from "../domain/events";
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

  const eventDate = parseEventDate(draft.dateLabel);
  if (!eventDate) {
    return {
      ready: false,
      reason: "Use a date format the native app can convert before live publishing."
    };
  }

  const capacity = Number.parseInt(draft.capacity, 10);
  const standardPrice = parseCurrencyValue(draft.standardPrice);
  const ticketTiers = buildTicketTierPayload(draft.ticketTiers);
  const isPaid = draft.monetization === "paid";
  const request: CreateEventRequest = {
    accessType: draft.accessType,
    attendeeConsentEnabled: draft.attendeeConsentEnabled,
    attendeeConsentText: draft.attendeeConsentEnabled ? draft.attendeeConsentText.trim() : undefined,
    capacity,
    contactMode: draft.whatsappNumber.trim() ? "whatsapp" : "email",
    deadline: eventDate.toISOString(),
    description: draft.description,
    entryFeeLabel: buildEntryFeeLabel(draft, standardPrice),
    eventDate: eventDate.toISOString(),
    eventType: draft.eventType,
    isPaid,
    location: draft.venue.trim(),
    mapDirectionsUrl: draft.mapDirectionsUrl.trim() || undefined,
    showRemainingSpots: draft.showRemainingSpots,
    standardPrice: isPaid && standardPrice > 0 ? standardPrice : undefined,
    ticketTiers: isPaid && ticketTiers.length > 0 ? ticketTiers : undefined,
    ticketsEnabled: true,
    title: draft.title.trim(),
    questions: draft.registrationQuestions
      .map((question) => {
        const options = question.options?.map((option) => option.trim()).filter(Boolean);

        return {
          id: question.id,
          label: question.label.trim(),
          type: question.type,
          required: question.required,
          options,
          allowMultiple: question.type === "checkbox" ? !!question.allowMultiple : undefined,
          optionLimits: buildQuestionOptionLimits(question, options)
        };
      })
      .filter((question) => question.label),
    virtualLink: draft.eventType === "virtual" ? draft.virtualLink.trim() : undefined,
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

function parseCurrencyValue(value: string): number {
  const parsed = Number.parseFloat(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildTicketTierPayload(ticketTiers: NativeTicketTierDraft[]) {
  return ticketTiers
    .filter((tier) => tier.name.trim() || tier.price.trim() || tier.capacity.trim())
    .map((tier) => {
      const capacity = Number.parseInt(tier.capacity, 10);

      return {
        name: tier.name.trim(),
        price: parseCurrencyValue(tier.price),
        capacity: Number.isFinite(capacity) && capacity > 0 ? capacity : undefined
      };
    });
}

function buildEntryFeeLabel(draft: EventDraft, standardPrice: number): string | undefined {
  if (draft.monetization === "free") {
    return undefined;
  }

  if (draft.entryFeeLabel.trim()) {
    return draft.entryFeeLabel.trim();
  }

  if (standardPrice > 0) {
    return `KES ${standardPrice.toLocaleString()}`;
  }

  const firstTier = draft.ticketTiers.find((tier) => tier.name.trim() && parseCurrencyValue(tier.price) > 0);
  if (!firstTier) {
    return undefined;
  }

  return `${firstTier.name.trim()} - KES ${parseCurrencyValue(firstTier.price).toLocaleString()}`;
}

function buildQuestionOptionLimits(
  question: EventDraft["registrationQuestions"][number],
  options: string[] | undefined
): Record<string, number | null | undefined> | undefined {
  if (!options || options.length === 0 || !question.optionLimits) {
    return undefined;
  }

  const entries = options
    .map((option) => {
      const rawLimit = question.optionLimits?.[option];
      return [option, typeof rawLimit === "number" && Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : null] as const;
    })
    .filter(([, limit]) => limit != null);

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}
