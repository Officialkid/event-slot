import { StyleSheet, Text, View } from "react-native";

import { ActionCard } from "../components/ActionCard";
import { MetricCard } from "../components/MetricCard";
import { NativeScreenProps } from "./types";

export function DashboardScreen({ theme, session, navigate, events, eventsLoading, eventsError }: NativeScreenProps) {
  const confirmed = events.reduce((total, event) => total + event.attendees, 0);
  const waitlist = events.reduce((total, event) => total + event.waitlist, 0);
  const dashboardMetrics = [
    { label: "Events", value: eventsLoading ? "..." : `${events.length}`, trend: eventsError ? "Needs live auth" : "Live workspace" },
    { label: "Confirmed", value: eventsLoading ? "..." : `${confirmed}`, trend: "Ready for export" },
    { label: "Waitlist", value: eventsLoading ? "..." : `${waitlist}`, trend: "Auto promotion" },
    { label: "Mode", value: session.authMode === "demo" ? "Demo" : "Live", trend: session.authMode === "demo" ? "Safe preview" : "Connected" }
  ];

  return (
    <View style={styles.stack}>
      <View style={[styles.hero, { backgroundColor: theme.colors.hero, borderColor: theme.colors.border }]}>
        <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>BUILT FOR EVENT TEAMS</Text>
        <Text style={[styles.greeting, { color: theme.colors.secondary }]}>
          Welcome back, {session.displayName}
        </Text>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Run registration, waitlist, and check-in from one sharp app.
        </Text>
        <Text style={[styles.body, { color: theme.colors.secondary }]}>
          Native EventSlot starts with the same mobile-first experience, then adds camera scanning, offline drafts, and push-ready workflows.
        </Text>
      </View>

      <View style={styles.metricsGrid}>
        {dashboardMetrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} theme={theme} />
        ))}
      </View>

      <ActionCard
        theme={theme}
        title="Create an event"
        caption="A simplified native flow will mirror the web version without exposing unfinished payments."
        action="Start"
        onPress={() => navigate({ name: "createEvent" })}
      />
      <ActionCard
        theme={theme}
        title="Verify tickets"
        caption="Camera and manual lookup will become first-class native tools for event teams."
        action="Scan"
        onPress={() => navigate({ name: "verify" })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 16
  },
  hero: {
    borderRadius: 30,
    borderWidth: 1,
    gap: 16,
    padding: 22
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2.4
  },
  greeting: {
    fontSize: 14,
    fontWeight: "700"
  },
  title: {
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 38
  },
  body: {
    fontSize: 16,
    lineHeight: 25
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  }
});
