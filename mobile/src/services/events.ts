import { demoEvents } from "../data/demo";
import { EventDraft, NativeEvent } from "../domain/events";
import { AppSession } from "../session";
import { loadNativeWorkspaceEvents } from "./workspace";

export async function listNativeEvents(session: AppSession): Promise<NativeEvent[]> {
  if (session.authMode === "live") {
    return loadNativeWorkspaceEvents(session);
  }

  return demoEvents;
}

export function findNativeEvent(events: NativeEvent[], eventId: string): NativeEvent | undefined {
  return events.find((event) => event.id === eventId);
}

export function findNativeEventBySlug(events: NativeEvent[], eventSlug: string): NativeEvent | undefined {
  return events.find((event) => event.slug === eventSlug);
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
    paymentMode: draft.monetization === "paid" ? "Paid externally" : "Registration only",
    monetization: draft.monetization,
    exportsReady: false,
    eventType: draft.eventType,
    accessType: draft.accessType,
    virtualLink: draft.virtualLink.trim() || undefined,
    mapDirectionsUrl: draft.mapDirectionsUrl.trim() || undefined,
    entryFeeLabel: draft.entryFeeLabel.trim() || undefined,
    showRemainingSpots: draft.showRemainingSpots,
    standardPrice: draft.standardPrice.trim() || undefined,
    ticketTiers: draft.ticketTiers
      .filter((tier) => tier.name.trim() || tier.price.trim() || tier.capacity.trim())
      .map((tier) => ({ ...tier })),
    whatsappNumber: draft.whatsappNumber.trim() || undefined,
    attendeeConsentEnabled: draft.attendeeConsentEnabled,
    attendeeConsentText: draft.attendeeConsentText.trim() || undefined,
    registrationQuestions: draft.registrationQuestions
      .map((question) => {
        const options = question.options?.filter(Boolean);

        return {
          id: question.id,
          label: question.label.trim(),
          type: question.type,
          required: question.required,
          options,
          allowMultiple: question.type === "checkbox" ? question.allowMultiple : undefined,
          optionLimits: options
            ? Object.fromEntries(
                options
                  .map((option) => [option, question.optionLimits?.[option] ?? null] as const)
                  .filter(([, limit]) => typeof limit === "number" && Number.isFinite(limit) && limit > 0)
              )
            : undefined
        };
      })
      .filter((question) => question.label),
    attachmentRequirement: draft.attachmentRequirement.enabled ? draft.attachmentRequirement : undefined
  };
}
