import { EventDraft } from "../domain/events";
import { isSupportedMapUrl } from "./maps";

export type NativeDraftValidationIssue = {
  field: keyof EventDraft | "attachmentRequirement.label" | "attachmentRequirement.caption" | "attachmentRequirement.maxFileSizeMb";
  message: string;
  severity: "error" | "warning";
};

export type NativeDraftValidationResult = {
  canSubmit: boolean;
  errors: NativeDraftValidationIssue[];
  warnings: NativeDraftValidationIssue[];
};

export function validateEventDraft(draft: EventDraft): NativeDraftValidationResult {
  const issues: NativeDraftValidationIssue[] = [];
  const capacity = Number.parseInt(draft.capacity, 10);

  if (!draft.title.trim()) {
    issues.push({ field: "title", message: "Add an event title.", severity: "error" });
  }

  if (!draft.dateLabel.trim()) {
    issues.push({ field: "dateLabel", message: "Add the event date before publishing.", severity: "error" });
  }

  if (!draft.venue.trim()) {
    issues.push({ field: "venue", message: "Add a venue or online location.", severity: "error" });
  }

  if (!draft.capacity.trim() || Number.isNaN(capacity) || capacity <= 0) {
    issues.push({ field: "capacity", message: "Capacity must be a number greater than zero.", severity: "error" });
  }

  if (draft.mapDirectionsUrl.trim() && !isSupportedMapUrl(draft.mapDirectionsUrl)) {
    issues.push({ field: "mapDirectionsUrl", message: "Use a supported Google Maps link for directions.", severity: "error" });
  }

  if (draft.eventType === "virtual" && !draft.virtualLink.trim()) {
    issues.push({ field: "virtualLink", message: "Add the virtual meeting link before publishing a virtual event.", severity: "error" });
  }

  if (draft.virtualLink.trim() && !isSupportedVirtualLink(draft.virtualLink)) {
    issues.push({ field: "virtualLink", message: "Use a secure https meeting link for the virtual event.", severity: "error" });
  }

  if (draft.attendeeConsentEnabled && !draft.attendeeConsentText.trim()) {
    issues.push({ field: "attendeeConsentText", message: "Write the consent wording or disable the consent screen.", severity: "error" });
  }

  if (draft.attachmentRequirement.enabled) {
    if (!draft.attachmentRequirement.label.trim()) {
      issues.push({ field: "attachmentRequirement.label", message: "Add a label for the upload question.", severity: "error" });
    }

    if (!draft.attachmentRequirement.caption.trim()) {
      issues.push({ field: "attachmentRequirement.caption", message: "Add help text so attendees know what to upload.", severity: "warning" });
    }

    if (!Number.isFinite(draft.attachmentRequirement.maxFileSizeMb) || draft.attachmentRequirement.maxFileSizeMb <= 0) {
      issues.push({ field: "attachmentRequirement.maxFileSizeMb", message: "Set a valid maximum upload size in MB.", severity: "error" });
    }
  }

  if (!draft.description.trim()) {
    issues.push({ field: "description", message: "A short description helps attendees understand the event.", severity: "warning" });
  }

  if (!draft.whatsappNumber.trim()) {
    issues.push({ field: "whatsappNumber", message: "Add WhatsApp or support contact details before launch.", severity: "warning" });
  }

  if (!draft.mapDirectionsUrl.trim() && draft.eventType === "physical") {
    issues.push({ field: "mapDirectionsUrl", message: "A Maps link makes physical events easier to attend.", severity: "warning" });
  }

  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");

  return {
    canSubmit: errors.length === 0,
    errors,
    warnings
  };
}

function isSupportedVirtualLink(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:";
  } catch {
    return false;
  }
}
