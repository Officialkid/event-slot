import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { NativeDashboardStatsResponse } from "../api/contracts";
import { ActionCard } from "../components/ActionCard";
import { MetricCard } from "../components/MetricCard";
import { NativeDashboardInsight } from "../domain/dashboardInsights";
import { buildNativeDashboardInsights } from "../services/dashboardInsights";
import { loadNativeDashboardStats } from "../services/workspace";
import { NativeScreenProps } from "./types";

export function DashboardScreen({ theme, session, navigate, events, eventsLoading, eventsError, refreshEvents }: NativeScreenProps) {
  const [liveStats, setLiveStats] = useState<NativeDashboardStatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statsReloadKey, setStatsReloadKey] = useState(0);
  const confirmed = events.reduce((total, event) => total + event.attendees, 0);
  const waitlist = events.reduce((total, event) => total + event.waitlist, 0);

  useEffect(() => {
    let mounted = true;

    setLiveStats(null);
    setStatsError(null);

    if (session.authMode !== "live") {
      return () => {
        mounted = false;
      };
    }

    setStatsLoading(true);
    loadNativeDashboardStats(session)
      .then((stats) => {
        if (mounted) {
          setLiveStats(stats);
        }
      })
      .catch((error: unknown) => {
        if (mounted) {
          setStatsError(error instanceof Error ? error.message : "Could not load live dashboard stats.");
        }
      })
      .finally(() => {
        if (mounted) {
          setStatsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [session, statsReloadKey]);

  const handleRefreshDashboard = () => {
    refreshEvents();
    setStatsReloadKey((value) => value + 1);
  };

  const totalEvents = liveStats?.totalEvents ?? events.length;
  const totalConfirmed = liveStats?.totalRegistrations ?? confirmed;
  const totalWaitlist = liveStats?.totalWaitlisted ?? waitlist;
  const conversionRate = liveStats?.conversionRate ?? 0;
  const dataSource = session.authMode === "live"
    ? statsError
      ? "Live stats need attention"
      : liveStats
        ? "Live API"
        : "Loading live API"
    : "Demo preview";

  const dashboardMetrics = [
    { label: "Events", value: eventsLoading || statsLoading ? "..." : `${totalEvents}`, trend: dataSource },
    { label: "Confirmed", value: eventsLoading || statsLoading ? "..." : `${totalConfirmed}`, trend: "Ready for export" },
    { label: "Waitlist", value: eventsLoading || statsLoading ? "..." : `${totalWaitlist}`, trend: liveStats ? `${liveStats.waitlistEventCount} events` : "Auto promotion" },
    { label: "Conversion", value: statsLoading ? "..." : `${conversionRate}%`, trend: session.authMode === "demo" ? "Demo estimate" : "Live views" }
  ];
  const insights = buildNativeDashboardInsights({ events, liveStats });

  const handleInsightPress = (insight: NativeDashboardInsight) => {
    navigate({ name: insight.target });
  };

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
          EventSlot keeps your event team close to registrations, check-in, waitlists, exports, and mobile event-day actions.
        </Text>
      </View>

      <View style={styles.metricsGrid}>
        {dashboardMetrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} theme={theme} />
        ))}
      </View>

      <View style={[styles.insightPanel, { backgroundColor: theme.colors.hero, borderColor: theme.colors.border }]}>
        <Text style={[styles.statusTitle, { color: theme.colors.accent }]}>TODAY'S FOCUS</Text>
        <Text style={[styles.statusCopy, { color: theme.colors.secondary }]}>
          Native insights use loaded events and live dashboard stats to suggest what needs attention first.
        </Text>
        {insights.map((insight) => (
          <Pressable
            accessibilityRole="button"
            key={insight.key}
            onPress={() => handleInsightPress(insight)}
            style={[styles.insightCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          >
            <View style={styles.insightCopy}>
              <Text style={[styles.insightTitle, { color: theme.colors.text }]}>{insight.title}</Text>
              <Text style={[styles.statusCopy, { color: theme.colors.secondary }]}>{insight.caption}</Text>
            </View>
            <Text
              style={[
                styles.insightPill,
                {
                  backgroundColor: theme.colors.activeTab,
                  color: insight.tone === "ready" ? theme.colors.success : insight.tone === "attention" ? theme.colors.accent : theme.colors.muted
                }
              ]}
            >
              {insight.actionLabel}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={[styles.statusCard, { backgroundColor: theme.colors.surface, borderColor: statsError ? theme.colors.error : theme.colors.border }]}>
        <Text style={[styles.statusTitle, { color: statsError ? theme.colors.error : theme.colors.accent }]}>DASHBOARD DATA</Text>
        <Text style={[styles.statusCopy, { color: theme.colors.secondary }]}>
          {statsError ?? (session.authMode === "live"
            ? liveStats
              ? `${liveStats.activeEvents} active events, ${liveStats.eventsClosingThisWeek} closing this week.`
              : "Loading dashboard metrics from the native API."
            : "Demo mode uses local events for internal QA builds.")}
        </Text>
        {statsError ? (
          <Pressable accessibilityRole="button" onPress={handleRefreshDashboard} style={[styles.retryButton, { borderColor: theme.colors.border }]}>
            <Text style={[styles.retryText, { color: theme.colors.accent }]}>Refresh workspace</Text>
          </Pressable>
        ) : null}
      </View>

      <ActionCard
        theme={theme}
        title="Create an event"
        caption="Start an event draft, save progress locally, and publish when the details are ready."
        action="Start"
        onPress={() => navigate({ name: "createEvent" })}
      />
      <ActionCard
        theme={theme}
        title="Verify tickets"
        caption="Use camera scanning or manual lookup to support event-day entry."
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
  },
  statusCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 8,
    padding: 18
  },
  insightPanel: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    padding: 18
  },
  insightCard: {
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    padding: 14
  },
  insightCopy: {
    flex: 1,
    gap: 4
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: "900"
  },
  insightPill: {
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  statusTitle: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2.2
  },
  statusCopy: {
    fontSize: 14,
    lineHeight: 21
  },
  retryButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  retryText: {
    fontSize: 13,
    fontWeight: "900"
  }
});
