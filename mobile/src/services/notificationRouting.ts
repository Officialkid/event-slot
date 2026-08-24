import * as Notifications from "expo-notifications";

import { AppRoute, EventWorkspaceRouteTab, TabKey } from "../tabs";

const tabKeys: TabKey[] = ["home", "events", "alerts", "more"];
const workspaceTabs: EventWorkspaceRouteTab[] = [
  "overview",
  "confirmed",
  "waitlist",
  "checkin",
  "email",
  "analytics",
  "insights",
  "settings",
  "team",
  "exports"
];

export type NativeNotificationRoutePayload =
  | AppRoute
  | {
      screen?: string;
      tab?: string;
      eventSlug?: string;
      registrationId?: string;
      eventId?: string;
    };

export function getRouteFromNotificationResponse(response: Notifications.NotificationResponse): AppRoute | null {
  return getRouteFromNotificationData(response.notification.request.content.data);
}

export function getRouteFromNotificationData(data: unknown): AppRoute | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const record = data as Record<string, unknown>;
  const routeCandidate = record.route;
  if (routeCandidate && typeof routeCandidate === "object") {
    const parsedRoute = parseRoutePayload(routeCandidate as NativeNotificationRoutePayload);
    if (parsedRoute) {
      return parsedRoute;
    }
  }

  return parseRoutePayload(record as NativeNotificationRoutePayload);
}

export function buildNotificationRouteData(route: AppRoute): Record<string, string> {
  switch (route.name) {
    case "home":
    case "events":
    case "alerts":
    case "more":
      return { screen: route.name };
    case "verify":
    case "profile":
    case "billing":
    case "payg":
    case "team":
    case "states":
    case "createEvent":
      return { screen: route.name };
    case "eventDetail":
      return {
        screen: route.name,
        eventId: route.eventId
      };
    case "eventWorkspace":
      return {
        screen: route.name,
        eventSlug: route.eventSlug,
        tab: route.tab
      };
    case "registrationDetail":
      return {
        screen: route.name,
        eventSlug: route.eventSlug,
        registrationId: route.registrationId
      };
    default:
      return { screen: "alerts" };
  }
}

function parseRoutePayload(payload: NativeNotificationRoutePayload): AppRoute | null {
  const record = payload as Record<string, unknown>;
  const screen =
    typeof record.screen === "string"
      ? record.screen
      : typeof record.name === "string"
        ? record.name
        : null;
  if (!screen) {
    return null;
  }

  if (isTabKey(screen)) {
    return { name: screen };
  }

  switch (screen) {
    case "verify":
    case "profile":
    case "billing":
    case "payg":
    case "team":
    case "states":
    case "createEvent":
      return { name: screen };
    case "eventDetail":
      return typeof record.eventId === "string" && record.eventId.trim()
        ? { name: "eventDetail", eventId: record.eventId }
        : null;
    case "eventWorkspace":
      return typeof record.eventSlug === "string" && isWorkspaceTab(record.tab)
        ? { name: "eventWorkspace", eventSlug: record.eventSlug, tab: record.tab }
        : null;
    case "registrationDetail":
      return typeof record.eventSlug === "string" &&
        record.eventSlug.trim() &&
        typeof record.registrationId === "string" &&
        record.registrationId.trim()
        ? {
            name: "registrationDetail",
            eventSlug: record.eventSlug,
            registrationId: record.registrationId
          }
        : null;
    default:
      return null;
  }
}

function isTabKey(value: string): value is TabKey {
  return tabKeys.includes(value as TabKey);
}

function isWorkspaceTab(value: unknown): value is EventWorkspaceRouteTab {
  return typeof value === "string" && workspaceTabs.includes(value as EventWorkspaceRouteTab);
}
