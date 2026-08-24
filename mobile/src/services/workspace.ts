import {
  NativeDashboardStatsResponse,
  NativePublicEventResponse,
  NativeEventWorkspaceResponse,
  NativeWorkspaceEvent,
  NativeWorkspaceEventsResponse
} from "../api/contracts";
import { eventslotRequest } from "../api/client";
import { NativeEvent, NativeRegistrationQuestion } from "../domain/events";
import { AppSession } from "../session";

export async function loadNativeDashboardStats(session: AppSession): Promise<NativeDashboardStatsResponse> {
  assertLiveToken(session);

  return eventslotRequest<NativeDashboardStatsResponse>("/api/native/dashboard/stats", {
    token: session.accessToken
  });
}

export async function loadNativeWorkspaceEvents(session: AppSession): Promise<NativeEvent[]> {
  assertLiveToken(session);

  const response = await eventslotRequest<NativeWorkspaceEventsResponse>("/api/native/events?limit=100", {
    token: session.accessToken
  });

  return response.events.map(mapWorkspaceEventToNativeEvent);
}

export async function loadNativeEventWorkspace(session: AppSession, slug: string): Promise<NativeEventWorkspaceResponse> {
  assertLiveToken(session);

  return eventslotRequest<NativeEventWorkspaceResponse>(`/api/native/events/${encodeURIComponent(slug)}`, {
    token: session.accessToken
  });
}

export async function loadNativePublicEvent(slug: string): Promise<NativeEvent> {
  const response = await eventslotRequest<NativePublicEventResponse>(`/api/native/public/events/${encodeURIComponent(slug)}`);
  return mapPublicEventToNativeEvent(response);
}

export function mergeNativeEventWorkspace(baseEvent: NativeEvent, workspace: NativeEventWorkspaceResponse): NativeEvent {
  return {
    ...baseEvent,
    description: typeof workspace.event.description === "string" ? workspace.event.description : baseEvent.description,
    attendeeConsentEnabled:
      typeof workspace.event.attendeeConsentEnabled === "boolean"
        ? workspace.event.attendeeConsentEnabled
        : baseEvent.attendeeConsentEnabled,
    attendeeConsentText:
      typeof workspace.event.attendeeConsentText === "string"
        ? workspace.event.attendeeConsentText
        : baseEvent.attendeeConsentText,
    communityLink: typeof workspace.event.communityLink === "string" ? workspace.event.communityLink : baseEvent.communityLink,
    whatsappNumber: typeof workspace.event.whatsappNumber === "string" ? workspace.event.whatsappNumber : baseEvent.whatsappNumber,
    contactMode:
      workspace.event.contactMode === "CALL"
        ? "CALL"
        : workspace.event.contactMode === "WHATSAPP"
          ? "WHATSAPP"
          : baseEvent.contactMode,
    ticketTiers: Array.isArray(workspace.event.ticketTiers)
      ? workspace.event.ticketTiers.map((tier) => ({
          id: tier.id,
          name: tier.name,
          presetKey: tier.presetKey ?? undefined,
          badgeColor: tier.badgeColor ?? undefined,
          textColor: tier.textColor ?? undefined,
          metallic: tier.metallic ?? undefined,
          prestige: tier.prestige ?? undefined,
          price: String(tier.priceKes ?? 0),
          capacity: String(tier.capacity ?? ""),
          description: tier.description ?? undefined,
          bundleSize: tier.bundleSize ? String(tier.bundleSize) : undefined,
          soldCount: tier.soldCount,
          waitlistCount: tier.waitlistCount,
          status: tier.status
        }))
      : baseEvent.ticketTiers,
    registrationQuestions: parseWorkspaceQuestions(workspace.event.questions) ?? baseEvent.registrationQuestions
  };
}

export function mapWorkspaceEventToNativeEvent(event: NativeWorkspaceEvent): NativeEvent {
  const capacity = event.capacity ?? 0;
  const eventDate = event.eventDate ? new Date(event.eventDate) : null;
  const deadline = event.deadline ? new Date(event.deadline) : null;
  const status = normalizeEventStatus(event.status, event.archived, deadline);

  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: undefined,
    status,
    dateLabel: formatDateLabel(eventDate ?? deadline),
    timeLabel: formatTimeLabel(eventDate),
    venue: event.location || "Venue not set",
    attendees: event.confirmedCount,
    waitlist: event.waitlistCount,
    capacity,
    verifierCode: event.verifierCode || event.dashboardToken || "Hidden",
    role: event.role ?? "Owner",
    paymentMode: event.entryFeeLabel ? "Paid externally" : "Registration only",
    exportsReady: !!event.exportsReady,
    eventType: event.eventType === "VIRTUAL" || event.eventType === "virtual" ? "virtual" : "physical",
    accessType: event.accessType === "PRIVATE" || event.accessType === "private" ? "private" : "public",
    mapDirectionsUrl: event.mapDirectionsUrl ?? undefined,
    entryFeeLabel: event.entryFeeLabel ?? undefined,
    showRemainingSpots: typeof event.showRemainingSpots === "boolean" ? event.showRemainingSpots : undefined
  };
}

export function mapPublicEventToNativeEvent(response: NativePublicEventResponse): NativeEvent {
  const event = response.event;
  const capacity = event.capacity ?? 0;
  const eventDate = event.eventDate ? new Date(event.eventDate) : null;
  const deadline = event.deadline ? new Date(event.deadline) : null;
  const waitlistCount = typeof event.waitlistCount === "number" ? event.waitlistCount : 0;
  const ticketTiers = (event.ticketTiers ?? [])
    .filter((tier) => tier.name.trim() || tier.priceKes > 0 || tier.capacity > 0)
    .map((tier) => ({
      id: tier.id,
      name: tier.name,
      presetKey: tier.presetKey ?? undefined,
      badgeColor: tier.badgeColor ?? undefined,
      textColor: tier.textColor ?? undefined,
      metallic: tier.metallic ?? undefined,
      prestige: tier.prestige ?? undefined,
      price: String(tier.priceKes ?? 0),
      capacity: String(tier.capacity ?? ""),
      description: tier.description ?? undefined,
      bundleSize: tier.bundleSize ? String(tier.bundleSize) : undefined,
      soldCount: tier.soldCount,
      waitlistCount: tier.waitlistCount,
      status: tier.status
    }));

  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: typeof event.description === "string" ? event.description : undefined,
    imageUrl: event.imageUrl ?? undefined,
    status: normalizeEventStatus(event.status ?? null, false, deadline),
    dateLabel: formatDateLabel(eventDate ?? deadline),
    timeLabel: formatTimeLabel(eventDate),
    venue: event.location || "Venue not set",
    attendees: event.confirmedCount,
    waitlist: waitlistCount,
    capacity,
    verifierCode: "Public",
    role: "Owner",
    paymentMode: event.entryFeeLabel ? "Paid externally" : "Registration only",
    monetization: event.isPaid ? "paid" : "free",
    exportsReady: false,
    eventType: event.eventType === "VIRTUAL" || event.eventType === "virtual" ? "virtual" : "physical",
    accessType: event.accessType === "PRIVATE" || event.accessType === "private" ? "private" : "public",
    mapDirectionsUrl: event.mapDirectionsUrl ?? undefined,
    entryFeeLabel: event.entryFeeLabel ?? undefined,
    showRemainingSpots: typeof event.showRemainingSpots === "boolean" ? event.showRemainingSpots : undefined,
    whatsappNumber: typeof event.whatsappNumber === "string" ? event.whatsappNumber : undefined,
    contactMode: event.contactMode === "CALL" ? "CALL" : event.contactMode === "WHATSAPP" ? "WHATSAPP" : undefined,
    communityLink: event.communityLink ?? undefined,
    organizerName: event.organizerName ?? undefined,
    attendeeConsentEnabled: typeof event.attendeeConsentEnabled === "boolean" ? event.attendeeConsentEnabled : undefined,
    attendeeConsentText: typeof event.attendeeConsentText === "string" ? event.attendeeConsentText : undefined,
    registrationQuestions: parseWorkspaceQuestions(event.questions),
    ticketTiers: ticketTiers.length > 0 ? ticketTiers : undefined
  };
}

function parseWorkspaceQuestions(value: unknown): NativeRegistrationQuestion[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const parsed = value
    .map((item): NativeRegistrationQuestion | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const id = String(record.id ?? "").trim();
      const label = String(record.label ?? "").trim();
      const rawType = String(record.type ?? "").trim().toLowerCase();

      if (!id || !label) {
        return null;
      }

      const normalizedType = normalizeQuestionType(rawType);
      if (!normalizedType) {
        return null;
      }

      return {
        id,
        label,
        type: normalizedType,
        required: typeof record.required === "boolean" ? record.required : undefined,
        options: Array.isArray(record.options)
          ? record.options.map((option) => String(option).trim()).filter(Boolean)
          : undefined,
        allowMultiple: typeof record.allowMultiple === "boolean" ? record.allowMultiple : undefined,
        optionLimits: isOptionLimitsRecord(record.optionLimits) ? record.optionLimits : undefined
      };
    })
    .filter((item): item is NativeRegistrationQuestion => Boolean(item));

  return parsed.length > 0 ? parsed : undefined;
}

function normalizeQuestionType(value: string): NativeRegistrationQuestion["type"] | null {
  if (
    value === "text" ||
    value === "email" ||
    value === "phone" ||
    value === "select" ||
    value === "checkbox" ||
    value === "textarea" ||
    value === "number" ||
    value === "file"
  ) {
    return value;
  }

  return null;
}

function isOptionLimitsRecord(value: unknown): value is Record<string, number | null | undefined> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((entry) => entry == null || (typeof entry === "number" && Number.isFinite(entry)));
}

function assertLiveToken(session: AppSession): asserts session is AppSession & { accessToken: string } {
  if (session.authMode !== "live" || !session.accessToken) {
    throw new Error("Live native workspace loading needs an authenticated native access token.");
  }
}

function normalizeEventStatus(status: string | null, archived: boolean, deadline: Date | null): NativeEvent["status"] {
  if (archived) {
    return "Closed";
  }

  if (status?.toLowerCase() === "draft") {
    return "Draft";
  }

  if (deadline && deadline.getTime() < Date.now()) {
    return "Closed";
  }

  return "Active";
}

function formatDateLabel(date: Date | null) {
  if (!date || Number.isNaN(date.getTime())) {
    return "Date not set";
  }

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function formatTimeLabel(date: Date | null) {
  if (!date || Number.isNaN(date.getTime())) {
    return "TBD";
  }

  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  });
}
