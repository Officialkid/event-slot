import { EventDraft } from "../domain/events";
import { AppSession } from "../session";
import { NativeDraftValidationResult } from "./eventValidation";

export type NativeLaunchChecklistTone = "ready" | "review" | "blocked";

export type NativeLaunchChecklistItem = {
  key: string;
  title: string;
  caption: string;
  tone: NativeLaunchChecklistTone;
};

export function buildNativeEventLaunchChecklist(
  draft: EventDraft,
  validation: NativeDraftValidationResult,
  session: AppSession
): NativeLaunchChecklistItem[] {
  const requiredBasicsReady = validation.errors.length === 0;
  const attendeeCopyReady = Boolean(draft.description.trim() && draft.entryFeeLabel.trim());
  const directionsReady = draft.eventType === "virtual" ? Boolean(draft.virtualLink.trim()) : Boolean(draft.mapDirectionsUrl.trim());
  const consentReady = !draft.attendeeConsentEnabled || Boolean(draft.attendeeConsentText.trim());
  const uploadsReady = !draft.attachmentRequirement.enabled || Boolean(draft.attachmentRequirement.label.trim() && draft.attachmentRequirement.maxFileSizeMb > 0);

  return [
    {
      key: "basics",
      title: "Required basics",
      caption: requiredBasicsReady
        ? "Title, date, venue, capacity, and link rules are ready."
        : `${validation.errors.length} required item${validation.errors.length === 1 ? "" : "s"} still need attention.`,
      tone: requiredBasicsReady ? "ready" : "blocked"
    },
    {
      key: "attendee-copy",
      title: "Attendee clarity",
      caption: attendeeCopyReady
        ? "Description and contribution wording are visible before registration."
        : "Add description and external contribution wording so attendees do not assume the event is free.",
      tone: attendeeCopyReady ? "ready" : "review"
    },
    {
      key: "directions",
      title: draft.eventType === "virtual" ? "Virtual access" : "Venue directions",
      caption: directionsReady
        ? draft.eventType === "virtual"
          ? "Secure meeting link is ready for the native event payload."
          : "Organizer-provided Maps link is ready for attendees."
        : draft.eventType === "virtual"
          ? "Add the virtual meeting link before publishing."
          : "Add a Maps link so attendees can open directions from mobile.",
      tone: directionsReady ? "ready" : "review"
    },
    {
      key: "consent-uploads",
      title: "Consent and uploads",
      caption: consentReady && uploadsReady
        ? "Optional consent and upload settings are configured safely."
        : "Review consent wording and upload question settings before live publishing.",
      tone: consentReady && uploadsReady ? "ready" : "blocked"
    },
    {
      key: "native-publish",
      title: "Native publish mode",
      caption: session.authMode === "live"
        ? "Live mode is selected; the native API can be tested after backend approval."
        : "Demo mode keeps this draft local until native publishing is approved.",
      tone: session.authMode === "live" ? "review" : "blocked"
    }
  ];
}
