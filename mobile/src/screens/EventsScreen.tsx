import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { nativeConfig } from "../config";
import { EventSlotLinkStrip } from "../components/EventSlotLinkStrip";
import { EventSlotMessageCard } from "../components/EventSlotMessageCard";
import { EventSlotPageHeader } from "../components/EventSlotPageHeader";
import { EventSlotPanel } from "../components/EventSlotPanel";
import { EventSlotPill } from "../components/EventSlotPill";
import { EventSlotSegmentedOptions } from "../components/EventSlotSegmentedOptions";
import { EventSlotTabs } from "../components/EventSlotTabs";
import { NativeEvent } from "../domain/events";
import { shareNativePayload } from "../services/share";
import { fontFamily, typeScale } from "../typography";
import { NativeScreenProps } from "./types";

type NativeEventTab = "all" | "active" | "draft" | "closed";
type NativeEventOwnershipFilter = "all" | "owner" | "team";

const eventTabs: Array<{ key: NativeEventTab; label: string }> = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "draft", label: "Draft" },
  { key: "closed", label: "Closed" }
];

export function EventsScreen({ theme, navigate, events, eventsLoading, eventsError, refreshEvents }: NativeScreenProps) {
  const [activeTab, setActiveTab] = useState<NativeEventTab>("all");
  const [ownershipFilter, setOwnershipFilter] = useState<NativeEventOwnershipFilter>("all");
  const [sharedLinkFor, setSharedLinkFor] = useState<string | null>(null);
  const filteredEvents = useMemo(() => filterNativeEvents(events, activeTab, ownershipFilter), [events, activeTab, ownershipFilter]);
  const counts = useMemo(
    () => ({
      all: events.length,
      active: events.filter((event) => event.status === "Active").length,
      draft: events.filter((event) => event.status === "Draft").length,
      closed: events.filter((event) => event.status === "Closed").length
    }),
    [events]
  );
  const ownershipCounts = useMemo(
    () => ({
      all: events.length,
      owner: events.filter((event) => event.role === "Owner").length,
      team: events.filter((event) => event.role === "Team").length
    }),
    [events]
  );
  const currentEmptyTitle = getEmptyTitle(activeTab, ownershipFilter);
  const currentEmptyCaption =
    ownershipFilter === "all"
      ? "Create a new event or switch filters to review the rest of your workspace."
      : ownershipFilter === "owner"
        ? "You do not have matching owner events in this filter yet."
        : "You do not have matching team events in this filter yet.";

  return (
    <View style={styles.stack}>
      <EventSlotPageHeader
        theme={theme}
        title="Your events"
        actionLabel="Create new event"
        onActionPress={() => navigate({ name: "createEvent" })}
      />

      <EventSlotTabs
        items={eventTabs.map((tab) => ({ ...tab, count: counts[tab.key] }))}
        activeKey={activeTab}
        onSelect={setActiveTab}
        theme={theme}
      />

      <EventSlotPanel theme={theme} style={styles.filterCard}>
        <Text style={[styles.filterLabel, { color: theme.colors.muted }]}>WORKSPACE FILTER</Text>
        <EventSlotSegmentedOptions
          label={`Showing ${ownershipCounts[ownershipFilter]} ${ownershipFilter === "all" ? "workspace" : ownershipFilter} event${ownershipCounts[ownershipFilter] === 1 ? "" : "s"}`}
          options={[
            { label: `All (${ownershipCounts.all})`, value: "all" },
            { label: `Owner (${ownershipCounts.owner})`, value: "owner" },
            { label: `Team (${ownershipCounts.team})`, value: "team" }
          ]}
          selected={ownershipFilter}
          onSelect={(value) => setOwnershipFilter(value as NativeEventOwnershipFilter)}
          theme={theme}
        />
      </EventSlotPanel>

      {eventsLoading ? (
        <View style={styles.cardList}>
          {[1, 2].map((item) => (
            <EventSlotMessageCard
              key={item}
              title="Loading events"
              caption="We are preparing your organizer workspace."
              theme={theme}
              style={styles.loadingCard}
            />
          ))}
        </View>
      ) : null}

      {eventsError ? (
        <EventSlotMessageCard
          title="Events need live auth"
          caption={eventsError}
          theme={theme}
          actionLabel="Retry"
          onActionPress={refreshEvents}
        />
      ) : null}

      {!eventsLoading && !eventsError && filteredEvents.length === 0 ? (
        <EventSlotMessageCard
          title={currentEmptyTitle}
          caption={currentEmptyCaption}
          theme={theme}
          actionLabel="Create new event"
          onActionPress={() => navigate({ name: "createEvent" })}
        />
      ) : null}

      {!eventsLoading && !eventsError && filteredEvents.length > 0 ? (
        <View style={styles.cardList}>
          {filteredEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              theme={theme}
              sharedLinkFor={sharedLinkFor}
              onOpen={() => navigate({ name: "eventDetail", eventId: event.id })}
              onShareLink={async () => {
                const url = buildEventRegistrationUrl(event.slug);
                const shared = await shareNativePayload({
                  title: event.title,
                  message: `Register for ${event.title}`,
                  url
                });

                setSharedLinkFor(shared ? event.id : null);
                if (shared) {
                  setTimeout(() => setSharedLinkFor((current) => (current === event.id ? null : current)), 2000);
                }
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function filterNativeEvents(events: NativeEvent[], tab: NativeEventTab, ownershipFilter: NativeEventOwnershipFilter): NativeEvent[] {
  return events
    .filter((event) => {
      if (ownershipFilter === "owner") {
        return event.role === "Owner";
      }

      if (ownershipFilter === "team") {
        return event.role === "Team";
      }

      return true;
    })
    .filter((event) => {
      if (tab === "all") {
        return true;
      }

      if (tab === "active") {
        return event.status === "Active";
      }

      if (tab === "draft") {
        return event.status === "Draft";
      }

      return event.status === "Closed";
    });
}

function getEmptyTitle(tab: NativeEventTab, ownershipFilter: NativeEventOwnershipFilter) {
  const ownershipPrefix = ownershipFilter === "all" ? "" : ownershipFilter === "owner" ? "owner " : "team ";

  if (tab === "all") {
    return `No ${ownershipPrefix}events yet`.replace("  ", " ");
  }

  if (tab === "active") {
    return `No active ${ownershipPrefix}events`.replace("  ", " ");
  }

  if (tab === "draft") {
    return `No draft ${ownershipPrefix}events`.replace("  ", " ");
  }

  return `No closed ${ownershipPrefix}events`.replace("  ", " ");
}

type EventCardProps = {
  event: NativeEvent;
  theme: NativeScreenProps["theme"];
  sharedLinkFor: string | null;
  onOpen: () => void;
  onShareLink: () => void | Promise<void>;
};

function EventCard({ event, theme, sharedLinkFor, onOpen, onShareLink }: EventCardProps) {
  const registrationUrl = buildEventRegistrationUrl(event.slug);
  const summaryLine = `${event.attendees} confirmed \u2022 ${event.waitlist} waitlisted \u2022 ${event.capacity > 0 ? `${event.capacity} capacity` : "Unlimited"}`;
  const metaLine = [event.dateLabel, event.venue].filter(Boolean).join(" \u2022 ");
  const paidEvent = event.monetization === "paid" || event.paymentMode !== "Registration only";

  return (
    <EventSlotPanel theme={theme} style={styles.eventCard}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderCopy}>
          <View style={styles.titleRow}>
            <Text style={[styles.eventTitle, { color: theme.colors.text }]} numberOfLines={2}>
              {event.title}
            </Text>
            {paidEvent ? <EventSlotPill label="PAID" theme={theme} tone="accent" /> : null}
            <EventSlotPill label={event.status} theme={theme} />
          </View>
          <Text style={[styles.cardSummary, { color: theme.colors.secondary }]}>{summaryLine}</Text>
          {paidEvent && event.entryFeeLabel ? (
            <Text style={[styles.cardMeta, { color: theme.colors.accent }]}>{event.entryFeeLabel}</Text>
          ) : null}
          {metaLine ? <Text style={[styles.cardMeta, { color: theme.colors.muted }]}>{metaLine}</Text> : null}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onOpen}
          style={[styles.moreButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
        >
          <Text style={[styles.moreButtonText, { color: theme.colors.text }]}>{"\u22EF"}</Text>
        </Pressable>
      </View>

      <EventSlotLinkStrip
        theme={theme}
        url={registrationUrl}
        actions={[
          {
            key: "copy",
            label: sharedLinkFor === event.id ? "Copied" : "Copy",
            onPress: () => {
              void onShareLink();
            }
          }
        ]}
      />
    </EventSlotPanel>
  );
}

function buildEventRegistrationUrl(slug: string) {
  return `${nativeConfig.apiBaseUrl}/events/${slug}`;
}

const styles = StyleSheet.create({
  stack: {
    gap: 16
  },
  cardList: {
    gap: 14
  },
  filterCard: {
    gap: 10
  },
  filterLabel: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.8
  },
  loadingCard: {
    gap: 6,
    minHeight: 124
  },
  eventCard: {
    gap: 14
  },
  cardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between"
  },
  cardHeaderCopy: {
    flex: 1,
    gap: 8,
    minWidth: 0
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  eventTitle: {
    flex: 1,
    fontFamily: fontFamily.display,
    fontSize: 23,
    fontWeight: "400",
    lineHeight: 30
  },
  cardSummary: {
    ...typeScale.body
  },
  cardMeta: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 18
  },
  moreButton: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  moreButtonText: {
    fontSize: 18,
    fontWeight: "700"
  }
});
