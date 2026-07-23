import { Pressable, StyleSheet, Text, View } from "react-native";

import { NativeScreenProps } from "./types";

export function EventsScreen({ theme, navigate, events, eventsLoading, eventsError, refreshEvents }: NativeScreenProps) {
  return (
    <View style={styles.stack}>
      <Text style={[styles.heading, { color: theme.colors.text }]}>My Events</Text>
      <Text style={[styles.subcopy, { color: theme.colors.secondary }]}>
        The native app will show owned events and invited-team events in one clear list.
      </Text>

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

      {events.map((event) => (
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
