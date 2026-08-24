import { NativeEvent } from "../domain/events";
import { NativeInsightCard, NativeInsightHistoryEntry } from "../domain/eventInsights";
import { AppSession } from "../session";
import { NativeEventAnalytics } from "./eventAnalytics";
import { loadNativeStorageValue, removeNativeStorageValue, saveNativeStorageValue } from "./nativeStorage";

const insightHistoryStorageKey = "eventslot.native.insight-history";
const insightHistoryLimit = 12;

export function buildNativeInsightCards(event: NativeEvent, analytics: NativeEventAnalytics): NativeInsightCard[] {
  const waitlistPressure = event.waitlist > 0 && event.attendees > 0;
  const highFill = analytics.fillRate >= 85;
  const lowMomentum = analytics.averageRegistrationsPerBucket < 2;

  return [
    {
      id: "conversion-baseline",
      tone: analytics.waitlistConversionRate >= 70 ? "success" : "info",
      title: analytics.waitlistConversionRate >= 70 ? "Strong attendee quality" : "Conversion baseline",
      body: `${event.attendees} confirmed and ${event.waitlist} waitlisted puts this event at ${analytics.fillRate}% fill.`
    },
    {
      id: "waitlist-pressure",
      tone: waitlistPressure ? "warning" : "tip",
      title: waitlistPressure ? "Waitlist pressure" : "Capacity available",
      body: waitlistPressure
        ? `${event.waitlist} people are waiting. Consider opening more capacity or sending updates to set expectations.`
        : "Waitlist pressure is currently low, so you can focus on boosting confirmed attendance."
    },
    {
      id: "source-focus",
      tone: analytics.strongestSource ? "tip" : "info",
      title: analytics.strongestSource ? `${analytics.strongestSource} leads` : "Source tracking light",
      body: analytics.strongestSource
        ? `Your strongest source right now is ${analytics.strongestSource}. Reuse that channel for the next push.`
        : "Source data is still light. Encourage organizers to track where attendees heard about the event."
    },
    {
      id: "suggested-next-action",
      tone: "action",
      title: "Suggested next action",
      body: highFill
        ? "Send a reminder to confirmed attendees now and decide whether to expand capacity before the event fills."
        : lowMomentum
          ? "Share the event again in two high-intent communities today to lift registration momentum."
          : "Send a concise update to confirmed attendees and share the registration link once more while momentum is healthy."
    }
  ];
}

export function getInsightQuotaPreview(session: AppSession): { used: number; limit: number } {
  const plan = session.plan.toLowerCase();

  if (plan === "business") {
    return { used: 0, limit: 999 };
  }

  if (plan === "pro") {
    return { used: 2, limit: 10 };
  }

  if (plan === "standard") {
    return { used: 1, limit: 5 };
  }

  return { used: 3, limit: 5 };
}

export async function loadNativeInsightHistory(eventSlug: string): Promise<NativeInsightHistoryEntry[]> {
  const history = await loadNativeStorageValue<NativeInsightHistoryEntry[]>(insightHistoryStorageKey);
  return (history ?? []).filter((entry) => entry.eventSlug === eventSlug);
}

export async function saveNativeInsightHistoryEntry(
  input: {
    eventSlug: string;
    cards: NativeInsightCard[];
    quotaUsed: number;
    quotaLimit: number;
  }
): Promise<NativeInsightHistoryEntry[]> {
  const history = (await loadNativeStorageValue<NativeInsightHistoryEntry[]>(insightHistoryStorageKey)) ?? [];
  const nextEntry: NativeInsightHistoryEntry = {
    id: `${new Date().toISOString()}-${input.eventSlug}`,
    eventSlug: input.eventSlug,
    generatedAt: new Date().toISOString(),
    cards: input.cards,
    quotaUsed: input.quotaUsed,
    quotaLimit: input.quotaLimit
  };
  const nextHistory = [nextEntry, ...history].slice(0, insightHistoryLimit);
  await saveNativeStorageValue(insightHistoryStorageKey, nextHistory);
  return nextHistory.filter((entry) => entry.eventSlug === input.eventSlug);
}

export async function clearNativeInsightHistory(): Promise<void> {
  await removeNativeStorageValue(insightHistoryStorageKey);
}

export function getNativeInsightReadinessMessage(): string {
  return "AI insight cards can now be generated and reviewed per event on this device while live quota enforcement and server-generated reports are still pending.";
}
