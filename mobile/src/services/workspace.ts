import {
  NativeDashboardStatsResponse,
  NativeEventWorkspaceResponse,
  NativeWorkspaceEvent,
  NativeWorkspaceEventsResponse
} from "../api/contracts";
import { eventslotRequest } from "../api/client";
import { NativeEvent } from "../domain/events";
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

export function mapWorkspaceEventToNativeEvent(event: NativeWorkspaceEvent): NativeEvent {
  const capacity = event.capacity ?? 0;
  const eventDate = event.eventDate ? new Date(event.eventDate) : null;
  const deadline = event.deadline ? new Date(event.deadline) : null;
  const status = normalizeEventStatus(event.status, event.archived, deadline);

  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
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
    entryFeeLabel: event.entryFeeLabel ?? undefined
  };
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
