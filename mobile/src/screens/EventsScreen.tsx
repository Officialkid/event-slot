import { StyleSheet, Text, View } from "react-native";

import { demoEvents } from "../data/demo";
import { NativeScreenProps } from "./types";

export function EventsScreen({ theme, navigate }: NativeScreenProps) {
  return (
    <View style={styles.stack}>
      <Text style={[styles.heading, { color: theme.colors.text }]}>My Events</Text>
      <Text style={[styles.subcopy, { color: theme.colors.secondary }]}>
        The native app will show owned events and invited-team events in one clear list.
      </Text>

      {demoEvents.map((event) => (
        <View key={event.title} style={[styles.eventCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.eventHeader}>
            <Text style={[styles.eventTitle, { color: theme.colors.text }]}>{event.title}</Text>
            <Text style={[styles.badge, { backgroundColor: theme.colors.activeTab, color: theme.colors.accent }]}>
              {event.status}
            </Text>
          </View>
          <View style={styles.eventMeta}>
            <Text style={[styles.metaText, { color: theme.colors.secondary }]}>{event.date}</Text>
            <Text style={[styles.metaText, { color: theme.colors.secondary }]}>
              {event.attendees}/{event.capacity} confirmed
            </Text>
          </View>
          <View style={styles.actionRow}>
            <Text style={[styles.linkAction, { color: theme.colors.accent }]} onPress={() => navigate("verify")}>
              Verify tickets
            </Text>
            <Text style={[styles.linkAction, { color: theme.colors.accent }]}>
              View insights
            </Text>
          </View>
        </View>
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
  }
});
