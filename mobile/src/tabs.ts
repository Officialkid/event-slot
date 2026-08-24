export type TabKey = "home" | "events" | "alerts" | "more";
export type EventWorkspaceRouteTab =
  | "overview"
  | "confirmed"
  | "waitlist"
  | "checkin"
  | "email"
  | "analytics"
  | "insights"
  | "settings"
  | "team"
  | "exports";

export type AppRoute =
  | { name: TabKey }
  | { name: "verify" }
  | { name: "profile" }
  | { name: "forgotPassword" }
  | { name: "billing" }
  | { name: "payg" }
  | { name: "team" }
  | { name: "states" }
  | { name: "eventDetail"; eventId: string }
  | { name: "eventWorkspace"; eventSlug: string; tab: EventWorkspaceRouteTab }
  | { name: "registrationDetail"; eventSlug: string; registrationId: string }
  | { name: "createEvent" };

export const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "home", label: "Home" },
  { key: "events", label: "Events" },
  { key: "alerts", label: "Alerts" },
  { key: "more", label: "More" }
];
