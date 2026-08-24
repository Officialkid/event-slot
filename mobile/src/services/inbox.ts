import { NativeInboxItem } from "../domain/inbox";
import { NativeEvent } from "../domain/events";
import { loadNativeStorageValue, saveNativeStorageValue } from "./nativeStorage";

const inboxReadStorageKey = "eventslot.native.inbox.read";

export async function loadReadInboxItemIds(): Promise<string[]> {
  const stored = await loadNativeStorageValue<string[]>(inboxReadStorageKey);
  return Array.isArray(stored) ? stored : [];
}

export async function saveReadInboxItemIds(ids: string[]) {
  await saveNativeStorageValue(inboxReadStorageKey, [...new Set(ids)]);
}

export async function markInboxItemRead(id: string): Promise<string[]> {
  const current = await loadReadInboxItemIds();
  const next = [...new Set([...current, id])];
  await saveReadInboxItemIds(next);
  return next;
}

export async function markAllInboxItemsRead(items: NativeInboxItem[]): Promise<string[]> {
  const next = [...new Set(items.map((item) => item.id))];
  await saveReadInboxItemIds(next);
  return next;
}

export function buildNativeInbox(events: NativeEvent[], readIds: string[]): NativeInboxItem[] {
  const items = events.slice(0, 8).flatMap((event, index) => {
    const ageLabel = buildAgeLabel(index);
    const nextItems: NativeInboxItem[] = [];
    const paidEvent = event.monetization === "paid" || event.paymentMode !== "Registration only";
    const spotsLeft = Math.max(event.capacity - event.attendees, 0);

    if (event.attendees > 0) {
      nextItems.push({
        id: `${event.id}-registration`,
        title: "New registration",
        body: `${event.title} has ${event.attendees} confirmed attendee${event.attendees === 1 ? "" : "s"} ready for review.`,
        ageLabel,
        unread: index < 3,
        route: { name: "eventWorkspace", eventSlug: event.slug, tab: "confirmed" },
        tone: "success",
        category: "registrations"
      });
    }

    if (event.waitlist > 0) {
      nextItems.push({
        id: `${event.id}-waitlist`,
        title: "Waitlist activity",
        body: `${event.waitlist} attendee${event.waitlist === 1 ? "" : "s"} are waiting for space on ${event.title}.`,
        ageLabel,
        unread: index < 2,
        route: { name: "eventWorkspace", eventSlug: event.slug, tab: "waitlist" },
        tone: "warning",
        category: "waitlist"
      });
    }

    if (event.capacity > 0) {
      nextItems.push({
        id: `${event.id}-capacity`,
        title: spotsLeft <= 5 ? "Capacity almost full" : "Capacity update",
        body:
          spotsLeft <= 5
            ? `${event.title} only has ${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left before waitlist pressure increases.`
            : `${event.title} is still open with ${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} remaining.`,
        ageLabel,
        unread: index < 2,
        route: { name: "eventWorkspace", eventSlug: event.slug, tab: spotsLeft <= 5 ? "waitlist" : "overview" },
        tone: spotsLeft <= 5 ? "warning" : "muted",
        category: "capacity"
      });
    }

    if (paidEvent) {
      nextItems.push({
        id: `${event.id}-payment`,
        title: "Payment received",
        body: `${event.title} is collecting paid registrations${event.entryFeeLabel ? ` at ${event.entryFeeLabel}` : ""}.`,
        ageLabel,
        unread: index < 2,
        route: { name: "eventWorkspace", eventSlug: event.slug, tab: "analytics" },
        tone: "accent",
        category: "payments"
      });
    }

    nextItems.push({
      id: `${event.id}-insight`,
      title: "AI insight ready",
      body: `Review the latest EventSlot recommendations for ${event.title}.`,
      ageLabel,
      unread: index === 0,
      route: { name: "eventWorkspace", eventSlug: event.slug, tab: "insights" },
      tone: "accent",
      category: "insights"
    });

    if (event.role === "Team") {
      nextItems.push({
        id: `${event.id}-team`,
        title: "Team access update",
        body: `You have team workspace access on ${event.title}. Review roles and coordination details.`,
        ageLabel,
        unread: index === 0,
        route: { name: "eventWorkspace", eventSlug: event.slug, tab: "team" },
        tone: "muted",
        category: "team"
      });
    }

    return nextItems;
  });

  return items.map((item) => ({
    ...item,
    unread: readIds.includes(item.id) ? false : item.unread
  }));
}

function buildAgeLabel(index: number) {
  const daysAgo = index + 1;
  if (daysAgo === 1) {
    return "1 day ago";
  }

  return `${daysAgo} days ago`;
}
