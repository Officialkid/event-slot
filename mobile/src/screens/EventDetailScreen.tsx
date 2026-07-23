import { Pressable, StyleSheet, Text, View } from "react-native";

import { findNativeEvent } from "../services/events";
import { EventDetailScreenProps } from "./types";

export function EventDetailScreen({ eventId, theme, navigate, events, eventsLoading, eventsError, refreshEvents }: EventDetailScreenProps) {
  const event = findNativeEvent(events, eventId);

  if (eventsLoading) {
    return (
      <View style={styles.stack}>
        <Pressable accessibilityRole="button" onPress={() => navigate({ name: "events" })}>
          <Text style={[styles.backLink, { color: theme.colors.accent }]}>Back to events</Text>
        </Pressable>
        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Loading event</Text>
          <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>
            We are opening the native event workspace.
          </Text>
        </View>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.stack}>
        <Pressable accessibilityRole="button" onPress={() => navigate({ name: "events" })}>
          <Text style={[styles.backLink, { color: theme.colors.accent }]}>Back to events</Text>
        </Pressable>
        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Event unavailable</Text>
          <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>
            {eventsError ?? "This event could not be found in the native workspace."}
          </Text>
          <Text style={[styles.backLink, { color: theme.colors.accent }]} onPress={refreshEvents}>
            Refresh events
          </Text>
        </View>
      </View>
    );
  }

  const fillPercent = event.capacity > 0 ? Math.round((event.attendees / event.capacity) * 100) : 0;

  return (
    <View style={styles.stack}>
      <Pressable accessibilityRole="button" onPress={() => navigate({ name: "events" })}>
        <Text style={[styles.backLink, { color: theme.colors.accent }]}>Back to events</Text>
      </Pressable>

      <View style={[styles.hero, { backgroundColor: theme.colors.hero, borderColor: theme.colors.border }]}>
        <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>{event.status.toUpperCase()} EVENT</Text>
        <Text style={[styles.title, { color: theme.colors.text }]}>{event.title}</Text>
        <Text style={[styles.body, { color: theme.colors.secondary }]}>
          {event.dateLabel} · {event.timeLabel} · {event.venue}
        </Text>
      </View>

      <View style={styles.grid}>
        <InfoTile label="Confirmed" value={`${event.attendees}`} caption={`${fillPercent}% full`} theme={theme} />
        <InfoTile label="Waitlist" value={`${event.waitlist}`} caption="Auto promote later" theme={theme} />
        <InfoTile label="Capacity" value={`${event.capacity}`} caption={event.paymentMode} theme={theme} />
        <InfoTile label="Verify code" value={event.verifierCode} caption={`${event.role} access`} theme={theme} />
      </View>

      <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Native workspace</Text>
        <ActionLine label="Registrations" value="View confirmed, waitlist, and attendee records" theme={theme} />
        <ActionLine label="Exports" value={event.exportsReady ? "CSV and PDF ready" : "No exports yet"} theme={theme} />
        <ActionLine label="Verifier team" value="Invite scanners with event-specific code" theme={theme} />
        <ActionLine label="Maps" value="Add or update organiser-provided directions" theme={theme} />
      </View>
    </View>
  );
}

type TileProps = {
  label: string;
  value: string;
  caption: string;
  theme: EventDetailScreenProps["theme"];
};

function InfoTile({ label, value, caption, theme }: TileProps) {
  return (
    <View style={[styles.tile, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <Text style={[styles.tileLabel, { color: theme.colors.muted }]}>{label}</Text>
      <Text style={[styles.tileValue, { color: theme.colors.text }]}>{value}</Text>
      <Text style={[styles.tileCaption, { color: theme.colors.secondary }]}>{caption}</Text>
    </View>
  );
}

type ActionLineProps = {
  label: string;
  value: string;
  theme: EventDetailScreenProps["theme"];
};

function ActionLine({ label, value, theme }: ActionLineProps) {
  return (
    <View style={[styles.actionLine, { borderColor: theme.colors.border }]}>
      <Text style={[styles.actionLabel, { color: theme.colors.text }]}>{label}</Text>
      <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 14
  },
  backLink: {
    fontSize: 14,
    fontWeight: "900"
  },
  hero: {
    borderRadius: 30,
    borderWidth: 1,
    gap: 12,
    padding: 22
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2.4
  },
  title: {
    fontSize: 31,
    fontWeight: "900",
    lineHeight: 36
  },
  body: {
    fontSize: 15,
    lineHeight: 23
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  tile: {
    borderRadius: 22,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    minWidth: "47%",
    padding: 16
  },
  tileLabel: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.8,
    textTransform: "uppercase"
  },
  tileValue: {
    fontSize: 26,
    fontWeight: "900"
  },
  tileCaption: {
    fontSize: 12,
    fontWeight: "700"
  },
  section: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 8
  },
  actionLine: {
    borderTopWidth: 1,
    gap: 4,
    paddingVertical: 14
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: "900"
  },
  actionValue: {
    fontSize: 13,
    lineHeight: 19
  }
});
