import { EventDraft } from "../domain/events";
import { isSupportedMapUrl } from "./maps";

export type NativeDraftValidationIssue = {
  field: keyof EventDraft | "registrationQuestions" | "attachmentRequirement.label" | "attachmentRequirement.caption" | "attachmentRequirement.maxFileSizeMb";
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

  if (draft.monetization === "paid") {
    const hasStandardPrice = parseCurrencyValue(draft.standardPrice) > 0;
    const namedTiers = draft.ticketTiers.filter((tier) => tier.name.trim() || tier.price.trim() || tier.capacity.trim());

    if (!hasStandardPrice && namedTiers.length === 0) {
      issues.push({
        field: "standardPrice",
        message: "Paid events need a standard price or at least one ticket tier.",
        severity: "error"
      });
    }

    if (draft.standardPrice.trim() && !hasStandardPrice) {
      issues.push({
        field: "standardPrice",
        message: "Standard price must be greater than zero for a paid event.",
        severity: "error"
      });
    }

    for (const tier of namedTiers) {
      const price = parseCurrencyValue(tier.price);
      const tierCapacity = tier.capacity.trim() ? Number.parseInt(tier.capacity, 10) : undefined;

      if (!tier.name.trim()) {
        issues.push({ field: "ticketTiers", message: "Each ticket tier needs a name.", severity: "error" });
      }

      if (!Number.isFinite(price) || price <= 0) {
        issues.push({ field: "ticketTiers", message: `Ticket tier "${tier.name || "Untitled"}" needs a valid price.`, severity: "error" });
      }

      if (tier.capacity.trim() && (!tierCapacity || tierCapacity <= 0)) {
        issues.push({ field: "ticketTiers", message: `Ticket tier "${tier.name || "Untitled"}" needs a valid capacity when one is provided.`, severity: "error" });
      }
    }
  }

  if (draft.attendeeConsentEnabled && !draft.attendeeConsentText.trim()) {
    issues.push({ field: "attendeeConsentText", message: "Write the consent wording or disable the consent screen.", severity: "error" });
  }

  const registrationQuestions = draft.registrationQuestions.filter((question) => question.label.trim() || question.type === "checkbox");

  if (registrationQuestions.length === 0) {
    issues.push({
      field: "registrationQuestions",
      message: "Add at least one registration question so attendees know what information to submit.",
      severity: "warning"
    });
  }

  for (const question of registrationQuestions) {
    if (!question.label.trim()) {
      issues.push({ field: "registrationQuestions", message: "Each registration question needs a label.", severity: "error" });
    }

    if (
      (question.type === "select" || question.type === "checkbox") &&
      (!question.options || question.options.filter((option) => option.trim()).length === 0)
    ) {
      issues.push({
        field: "registrationQuestions",
        message: `${question.type === "checkbox" ? "Checkbox" : "Select"} question "${question.label || "Untitled"}" needs at least one option.`,
        severity: "error"
      });
    }

    if (question.optionLimits) {
      for (const [option, limit] of Object.entries(question.optionLimits)) {
        if (option.trim() && limit != null && (!Number.isInteger(limit) || limit <= 0)) {
          issues.push({
            field: "registrationQuestions",
            message: `Option limits for "${question.label || "Untitled"}" must be whole numbers greater than zero.`,
            severity: "error"
          });
          break;
        }
      }
    }
  }

  if (registrationQuestions.some((question) => question.type === "file") && !draft.attachmentRequirement.enabled) {
    issues.push({
      field: "registrationQuestions",
      message: "Enable the upload requirement when you add a file registration question.",
      severity: "error"
    });
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

function parseCurrencyValue(value: string): number {
  const parsed = Number.parseFloat(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
