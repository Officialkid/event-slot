import { NativeDashboardStatsResponse } from "../api/contracts";
import { NativeDashboardInsight } from "../domain/dashboardInsights";
import { NativeEvent } from "../domain/events";

export function buildNativeDashboardInsights(input: {
  events: NativeEvent[];
  liveStats: NativeDashboardStatsResponse | null;
}): NativeDashboardInsight[] {
  const activeEvents = input.events.filter((event) => event.status === "Active");
  const waitlistCount = input.liveStats?.totalWaitlisted ?? input.events.reduce((total, event) => total + event.waitlist, 0);
  const nearCapacityEvents = input.events.filter((event) => event.capacity > 0 && event.attendees / event.capacity >= 0.8);
  const closingThisWeek = input.liveStats?.eventsClosingThisWeek ?? countEventsClosingSoon(input.events);

  const insights: NativeDashboardInsight[] = [];

  if (closingThisWeek > 0) {
    insights.push({
      actionLabel: "Review events",
      caption: `${closingThisWeek} event${closingThisWeek === 1 ? " is" : "s are"} closing this week. Check capacity, reminders, and verifier readiness.`,
      key: "closing-this-week",
      target: "events",
      title: "Closing soon",
      tone: "attention"
    });
  }

  if (nearCapacityEvents.length > 0) {
    insights.push({
      actionLabel: "Open events",
      caption: `${nearCapacityEvents.length} event${nearCapacityEvents.length === 1 ? " is" : "s are"} at least 80% full. Prepare waitlist and check-in teams.`,
      key: "near-capacity",
      target: "events",
      title: "Near capacity",
      tone: "attention"
    });
  }

  if (waitlistCount > 0) {
    insights.push({
      actionLabel: "Review waitlist",
      caption: `${waitlistCount} attendee${waitlistCount === 1 ? "" : "s"} currently need waitlist follow-up or promotion readiness.`,
      key: "waitlist",
      target: "events",
      title: "Waitlist needs attention",
      tone: "attention"
    });
  }

  if (activeEvents.length > 0) {
    insights.push({
      actionLabel: "Verify tickets",
      caption: `${activeEvents.length} active event${activeEvents.length === 1 ? "" : "s"} can use native verifier-code access, camera scan, and manual lookup.`,
      key: "verify-ready",
      target: "verify",
      title: "Verifier tools ready",
      tone: "ready"
    });
  }

  if (insights.length === 0) {
    insights.push({
      actionLabel: "Create event",
      caption: "Create or load an event to unlock live insights, verifier tools, exports, and waitlist tracking.",
      key: "create-first",
      target: "createEvent",
      title: "Start with an event",
      tone: "blocked"
    });
  }

  return insights.slice(0, 3);
}

function countEventsClosingSoon(events: NativeEvent[]): number {
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  return events.filter((event) => {
    const timestamp = Date.parse(event.dateLabel);
    return !Number.isNaN(timestamp) && timestamp >= now && timestamp - now <= sevenDaysMs;
  }).length;
}
