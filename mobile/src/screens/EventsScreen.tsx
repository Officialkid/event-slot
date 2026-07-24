import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { NativeEvent } from "../domain/events";
import { NativeScreenProps } from "./types";

type NativeEventFilter = "all" | "active" | "draft" | "closed" | "owner" | "team";

const eventFilters: Array<{ key: NativeEventFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "draft", label: "Drafts" },
  { key: "closed", label: "Closed" },
  { key: "owner", label: "Owner" },
  { key: "team", label: "Team" }
];

export function EventsScreen({ theme, navigate, events, eventsLoading, eventsError, refreshEvents }: NativeScreenProps) {
  const [activeFilter, setActiveFilter] = useState<NativeEventFilter>("all");
  const filteredEvents = filterNativeEvents(events, activeFilter);
  const activeCount = events.filter((event) => event.status === "Active").length;
  const teamCount = events.filter((event) => event.role === "Team").length;

  return (
    <View style={styles.stack}>
      <Text style={[styles.heading, { color: theme.colors.text }]}>My Events</Text>
      <Text style={[styles.subcopy, { color: theme.colors.secondary }]}>
        The native app will show owned events and invited-team events in one clear list.
      </Text>

      <View style={[styles.summaryCard, { backgroundColor: theme.colors.hero, borderColor: theme.colors.border }]}>
        <Text style={[styles.summaryTitle, { color: theme.colors.text }]}>Native event workspace</Text>
        <Text style={[styles.summaryCopy, { color: theme.colors.secondary }]}>
          {events.length} events loaded, {activeCount} active, {teamCount} team-accessible.
        </Text>
      </View>

      <View style={styles.filterRow}>
        {eventFilters.map((filter) => {
          const active = filter.key === activeFilter;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              key={filter.key}
              onPress={() => setActiveFilter(filter.key)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: active ? theme.colors.activeTab : theme.colors.input,
                  borderColor: active ? theme.colors.accent : theme.colors.border
                }
              ]}
            >
              <Text style={[styles.filterText, { color: active ? theme.colors.accent : theme.colors.secondary }]}>
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {eventsLoading ? (
        <View style={[styles.stateCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.stateTitle, { color: theme.colors.text }]}>Loading events</Text>
          <Text style={[styles.stateCopy, { color: theme.colors.secondary }]}>
            We are preparing your owned and invited event workspace.
          </Text>
        </View>
      ) : null}

      {eventsError ? (
        <View style={[styles.stateCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.stateTitle, { color: theme.colors.text }]}>Events need live auth</Text>
          <Text style={[styles.stateCopy, { color: theme.colors.secondary }]}>{eventsError}</Text>
          <Text style={[styles.linkAction, { color: theme.colors.accent }]} onPress={refreshEvents}>
            Retry
          </Text>
        </View>
      ) : null}

      {!eventsLoading && !eventsError && events.length === 0 ? (
        <View style={[styles.stateCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.stateTitle, { color: theme.colors.text }]}>No events yet</Text>
          <Text style={[styles.stateCopy, { color: theme.colors.secondary }]}>
            Create your first event or accept a team invite to see it here.
          </Text>
        </View>
      ) : null}

      {!eventsLoading && !eventsError && events.length > 0 && filteredEvents.length === 0 ? (
        <View style={[styles.stateCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.stateTitle, { color: theme.colors.text }]}>No matching events</Text>
          <Text style={[styles.stateCopy, { color: theme.colors.secondary }]}>
            Change the filter to see more events in this native workspace.
          </Text>
        </View>
      ) : null}

      {filteredEvents.map((event) => (
        <Pressable
          accessibilityRole="button"
          key={event.id}
          onPress={() => navigate({ name: "eventDetail", eventId: event.id })}
          style={[styles.eventCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
        >
          <View style={styles.eventHeader}>
            <Text style={[styles.eventTitle, { color: theme.colors.text }]}>{event.title}</Text>
            <Text style={[styles.badge, { backgroundColor: theme.colors.activeTab, color: theme.colors.accent }]}>
              {event.status}
            </Text>
          </View>
          <View style={styles.eventMeta}>
            <Text style={[styles.metaText, { color: theme.colors.secondary }]}>{event.dateLabel}</Text>
            <Text style={[styles.metaText, { color: theme.colors.secondary }]}>
              {event.attendees}/{event.capacity} confirmed
            </Text>
          </View>
          <View style={styles.actionRow}>
            <Text style={[styles.linkAction, { color: theme.colors.accent }]} onPress={() => navigate({ name: "verify" })}>
              Verify tickets
            </Text>
            <Text style={[styles.linkAction, { color: theme.colors.accent }]}>
              View insights
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function filterNativeEvents(events: NativeEvent[], filter: NativeEventFilter): NativeEvent[] {
  if (filter === "active") {
    return events.filter((event) => event.status === "Active");
  }

  if (filter === "draft") {
    return events.filter((event) => event.status === "Draft");
  }

  if (filter === "closed") {
    return events.filter((event) => event.status === "Closed");
  }

  if (filter === "owner") {
    return events.filter((event) => event.role === "Owner");
  }

  if (filter === "team") {
    return events.filter((event) => event.role === "Team");
  }

  return events;
}

const styles = StyleSheet.create({
  stack: {
    gap: 14
  },
  heading: {
    fontSize: 32,
    fontWeight: "900"
  },
  subcopy: {
    fontSize: 15,
    lineHeight: 23
  },
  summaryCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 6,
    padding: 18
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "900"
  },
  summaryCopy: {
    fontSize: 14,
    lineHeight: 21
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  filterText: {
    fontSize: 12,
    fontWeight: "900"
  },
  eventCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 16,
    padding: 18
  },
  eventHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between"
  },
  eventTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 25
  },
  badge: {
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  eventMeta: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  metaText: {
    fontSize: 13,
    fontWeight: "700"
  },
  actionRow: {
    borderTopWidth: 1,
    borderTopColor: "rgba(128, 128, 128, 0.18)",
    flexDirection: "row",
    gap: 18,
    paddingTop: 14
  },
  linkAction: {
    fontSize: 13,
    fontWeight: "900"
  },
  stateCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 8,
    padding: 18
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: "900"
  },
  stateCopy: {
    fontSize: 14,
    lineHeight: 21
  }
});
