import { NativeRegistrationSummary } from "../api/contracts";
import { NativeEvent } from "../domain/events";
import { NativeRegistrationPreview, NativeRegistrationWorkspace } from "../domain/registrations";

const demoConfirmed: NativeRegistrationPreview[] = [
  {
    id: "demo-confirmed-1",
    attendeeName: "John Kimani Hika",
    attendeePhone: "0742126582",
    status: "confirmed",
    submittedAtLabel: "Recently",
    source: "Registration form"
  },
  {
    id: "demo-confirmed-2",
    attendeeName: "Daniel Mwalili",
    attendeePhone: "0745169345",
    status: "confirmed",
    submittedAtLabel: "Recently",
    source: "Registration form"
  },
  {
    id: "demo-confirmed-3",
    attendeeName: "Loise Wangechi",
    attendeePhone: "0743150764",
    status: "confirmed",
    submittedAtLabel: "Recently",
    source: "Registration form"
  }
];

export function buildDemoRegistrationWorkspace(event: NativeEvent): NativeRegistrationWorkspace {
  const confirmed = event.attendees > 0 ? demoConfirmed.slice(0, Math.min(event.attendees, demoConfirmed.length)) : [];
  const waitlist = Array.from({ length: Math.min(event.waitlist, 3) }, (_, index) => ({
    id: `demo-waitlist-${index + 1}`,
    attendeeName: `Waitlist attendee ${index + 1}`,
    status: "waitlist" as const,
    submittedAtLabel: "Waiting",
    waitlistPosition: index + 1,
    source: "Registration form"
  }));

  return { confirmed, waitlist };
}

export function mapRegistrationSummary(
  registration: NativeRegistrationSummary,
  status: NativeRegistrationPreview["status"]
): NativeRegistrationPreview {
  const answers = Array.isArray(registration.answers) ? registration.answers : [];
  const attendeeName = findAnswerValue(answers, ["name", "full name", "attendee"]) || "Unnamed attendee";
  const attendeeEmail = findAnswerValue(answers, ["email"]);
  const attendeePhone = findAnswerValue(answers, ["phone", "number", "whatsapp"]);

  return {
    id: registration.id,
    attendeeName,
    attendeeEmail,
    attendeePhone,
    status,
    submittedAtLabel: formatSubmittedAt(registration.submittedAt),
    waitlistPosition: registration.waitlistPosition ?? undefined,
    source: registration.source ?? undefined
  };
}

function findAnswerValue(answers: unknown[], hints: string[]) {
  for (const answer of answers) {
    if (!answer || typeof answer !== "object") {
      continue;
    }

    const record = answer as Record<string, unknown>;
    const label = String(record.label ?? record.question ?? record.questionId ?? "").toLowerCase();
    const value = record.value;
    const matchesHint = hints.some((hint) => label.includes(hint));

    if (matchesHint && typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function formatSubmittedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Submitted";
  }

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short"
  });
}
