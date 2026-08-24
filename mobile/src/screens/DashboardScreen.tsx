import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ORGANIZER_SURFACE_COPY } from "../../../lib/organizerSurfaceContent";
import { ActionCard } from "../components/ActionCard";
import { EventSlotMetricGrid } from "../components/EventSlotMetricGrid";
import { NativeDashboardStatsResponse } from "../api/contracts";
import { EventSlotMessageCard } from "../components/EventSlotMessageCard";
import { EventSlotPageHeader } from "../components/EventSlotPageHeader";
import { EventSlotStatusCard } from "../components/EventSlotStatusCard";
import { MetricCard } from "../components/MetricCard";
import { buildNativeDashboardInsights } from "../services/dashboardInsights";
import { NativeScreenProps } from "./types";
import { loadNativeDashboardStats } from "../services/workspace";
import { typeScale } from "../typography";

export function DashboardScreen({ theme, session, navigate, events, eventsLoading, refreshEvents }: NativeScreenProps) {
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
  const activeEvents = liveStats?.activeEvents ?? events.filter((event) => event.status === "Active").length;
  const metrics = [
    {
      label: ORGANIZER_SURFACE_COPY.dashboard.metrics.totalEvents,
      value: eventsLoading || statsLoading ? "..." : `${totalEvents}`,
      trend: liveStats ? `${liveStats.eventsThisMonth > 0 ? `+${liveStats.eventsThisMonth}` : "0"} this month` : "Event overview"
    },
    {
      label: ORGANIZER_SURFACE_COPY.dashboard.metrics.registrations,
      value: eventsLoading || statsLoading ? "..." : `${totalConfirmed}`,
      trend: liveStats
        ? formatRegistrationTrend(liveStats.registrationsThisMonth, liveStats.registrationsLastMonth)
        : "Across all events"
    },
    {
      label: ORGANIZER_SURFACE_COPY.dashboard.metrics.activeNow,
      value: eventsLoading || statsLoading ? "..." : `${activeEvents}`,
      trend: liveStats
        ? liveStats.eventsClosingThisWeek > 0
          ? `${liveStats.eventsClosingThisWeek} closing this week`
          : "No closures this week"
        : "Live event activity"
    },
    {
      label: ORGANIZER_SURFACE_COPY.dashboard.metrics.onWaitlist,
      value: eventsLoading || statsLoading ? "..." : `${totalWaitlist}`,
      trend: liveStats
        ? totalWaitlist === 0
          ? "All caught up"
          : `Across ${liveStats.waitlistEventCount} events`
        : "Waitlist overview"
    }
  ];

  const needsAttention = liveStats?.eventsNearCapacity ?? [];
  const upcomingEvents = liveStats?.upcomingEvents ?? [];
  const recentActivity = liveStats?.recentActivity ?? [];
  const featuredEvents = events.slice(0, 3);
  const isFreePlan = session.plan.toLowerCase() === "free";
  const focusInsights = buildNativeDashboardInsights({ events, liveStats });

  return (
    <View style={styles.stack}>
      <EventSlotPageHeader
        theme={theme}
        eyebrow={`${getGreeting()}, ${session.displayName}`}
        title={ORGANIZER_SURFACE_COPY.dashboard.header.mobileTitle}
        actionLabel={ORGANIZER_SURFACE_COPY.dashboard.header.createCta}
        onActionPress={() => navigate({ name: "createEvent" })}
      />

      {isFreePlan ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => navigate({ name: "billing" })}
          style={[styles.planBanner, { backgroundColor: theme.colors.activeTab, borderColor: theme.colors.accent }]}
        >
          <Text style={[styles.planTitle, { color: theme.colors.accent }]}>Free plan · Upgrade</Text>
          <Text style={[styles.planCopy, { color: theme.colors.secondary }]}>
            Unlock more organizer tools, higher limits, and richer attendee flows from the billing screen.
          </Text>
        </Pressable>
      ) : null}

      <EventSlotMetricGrid>
        {metrics.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} value={metric.value} trend={metric.trend} theme={theme} />
        ))}
      </EventSlotMetricGrid>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>TODAY'S FOCUS</Text>
        <View style={styles.quickGrid}>
          {focusInsights.map((insight) => (
            <ActionCard
              key={insight.key}
              title={insight.title}
              caption={insight.caption}
              action={insight.actionLabel}
              onPress={() => navigate({ name: insight.target })}
              theme={theme}
            />
          ))}
        </View>
      </View>

      <DashboardSection
        title="Your events"
        theme={theme}
        emptyTitle="Create your first event"
        emptyCaption="Your live or demo events will appear here once your workspace is ready."
        loading={eventsLoading}
        loadingTitle="Loading your events"
        loadingCaption="We are preparing your event cards."
        hasItems={featuredEvents.length > 0}
      >
        <View style={[styles.groupCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          {featuredEvents.map((event, index) => {
            const paidEvent = event.monetization === "paid" || event.paymentMode !== "Registration only";

            return (
              <Pressable
                accessibilityRole="button"
                key={event.id}
                onPress={() => navigate({ name: "eventDetail", eventId: event.id })}
                style={[
                  styles.listRow,
                  index < featuredEvents.length - 1 && { borderBottomColor: theme.colors.border, borderBottomWidth: StyleSheet.hairlineWidth }
                ]}
              >
                <View style={styles.listCopy}>
                  <View style={styles.dashboardEventTitleRow}>
                    <Text style={[styles.listTitle, { color: theme.colors.text }]}>{event.title}</Text>
                    {paidEvent ? <Text style={[styles.dashboardEventBadge, { color: theme.colors.accent }]}>PAID</Text> : null}
                  </View>
                  <Text style={[styles.listCaption, { color: theme.colors.secondary }]}>
                    {[event.dateLabel, event.venue].filter(Boolean).join(" | ")}
                  </Text>
                  <Text style={[styles.listCaption, { color: theme.colors.muted }]}>
                    {event.attendees} confirmed | {event.waitlist} waitlisted
                  </Text>
                </View>
                <Text style={[styles.rowAction, { color: theme.colors.secondary }]}>Open</Text>
              </Pressable>
            );
          })}
        </View>
      </DashboardSection>

      <DashboardSection
        title={ORGANIZER_SURFACE_COPY.dashboard.sections.needsAttention.title}
        theme={theme}
        emptyTitle={ORGANIZER_SURFACE_COPY.dashboard.sections.needsAttention.emptyTitle}
        emptyCaption={ORGANIZER_SURFACE_COPY.dashboard.sections.needsAttention.emptyCaption}
        loading={statsLoading}
        loadingTitle="Loading capacity signals"
        loadingCaption="We are checking which events are approaching full capacity."
        hasItems={needsAttention.length > 0}
      >
        <View style={[styles.groupCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          {needsAttention.map((event, index) => {
            const fill = Math.min(100, Math.round((event.confirmedCount / event.capacity) * 100));
            return (
              <Pressable
                accessibilityRole="button"
                key={event.slug}
                onPress={() => {
                  const matched = events.find((item) => item.slug === event.slug);
                  if (matched) {
                    navigate({ name: "eventDetail", eventId: matched.id });
                    return;
                  }
                  navigate({ name: "events" });
                }}
                style={[
                  styles.listRow,
                  index < needsAttention.length - 1 && { borderBottomColor: theme.colors.border, borderBottomWidth: StyleSheet.hairlineWidth }
                ]}
              >
                <View style={styles.listCopy}>
                  <Text style={[styles.listTitle, { color: theme.colors.text }]}>{event.title}</Text>
                  <Text style={[styles.listCaption, { color: theme.colors.secondary }]}>
                    {event.confirmedCount} of {event.capacity} slots filled
                  </Text>
                  <View style={[styles.progressTrack, { backgroundColor: theme.colors.elevated }]}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${fill}%`, backgroundColor: fill >= 95 ? theme.colors.error : theme.colors.accent }
                      ]}
                    />
                  </View>
                </View>
                <Text style={[styles.rowAction, { color: theme.colors.secondary }]}>Open</Text>
              </Pressable>
            );
          })}
        </View>
      </DashboardSection>

      <DashboardSection
        title={ORGANIZER_SURFACE_COPY.dashboard.sections.upcomingEvents.title}
        theme={theme}
        emptyTitle={ORGANIZER_SURFACE_COPY.dashboard.sections.upcomingEvents.emptyTitle}
        emptyCaption={ORGANIZER_SURFACE_COPY.dashboard.sections.upcomingEvents.emptyCaption}
        loading={statsLoading}
        loadingTitle="Loading upcoming events"
        loadingCaption="We are pulling the next events from your live workspace."
        hasItems={upcomingEvents.length > 0}
      >
        <View style={[styles.groupCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          {upcomingEvents.map((event, index) => (
            <View
              key={event.slug}
              style={[
                styles.listRow,
                index < upcomingEvents.length - 1 && { borderBottomColor: theme.colors.border, borderBottomWidth: StyleSheet.hairlineWidth }
              ]}
            >
              <View style={styles.listCopy}>
                <Text style={[styles.listTitle, { color: theme.colors.text }]}>{event.title}</Text>
                <Text style={[styles.listCaption, { color: theme.colors.secondary }]}>
                  {formatDateLine(event.eventDate, event.deadline)}
                </Text>
              </View>
              <Text style={[styles.rowValue, { color: theme.colors.text }]}>
                {event.confirmedCount}/{event.capacity ?? "-"}
              </Text>
            </View>
          ))}
        </View>
      </DashboardSection>

      <DashboardSection
        title={ORGANIZER_SURFACE_COPY.dashboard.sections.recentActivity.title}
        theme={theme}
        emptyTitle={ORGANIZER_SURFACE_COPY.dashboard.sections.recentActivity.emptyTitle}
        emptyCaption={ORGANIZER_SURFACE_COPY.dashboard.sections.recentActivity.emptyCaption}
        loading={statsLoading}
        loadingTitle="Loading registrations"
        loadingCaption="Recent attendee activity will appear here."
        hasItems={recentActivity.length > 0}
      >
        <View style={[styles.groupCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          {recentActivity.map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.listRow,
                index < recentActivity.length - 1 && { borderBottomColor: theme.colors.border, borderBottomWidth: StyleSheet.hairlineWidth }
              ]}
            >
              <View style={styles.listCopy}>
                <Text style={[styles.listTitle, { color: theme.colors.text }]}>{item.name}</Text>
                <Text style={[styles.listCaption, { color: theme.colors.secondary }]}>{item.eventTitle}</Text>
              </View>
              <Text style={[styles.rowAction, { color: theme.colors.secondary }]}>{formatRelativeTime(item.submittedAt)}</Text>
            </View>
          ))}
        </View>
      </DashboardSection>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{ORGANIZER_SURFACE_COPY.dashboard.sections.quickActions.title}</Text>
        <View style={styles.quickGrid}>
          <ActionCard
            title="Create event"
            caption="Start a new event draft from mobile."
            action="Open"
            onPress={() => navigate({ name: "createEvent" })}
            theme={theme}
          />
          <ActionCard
            title="Verify tickets"
            caption="Check in attendees using scan or lookup."
            action="Open"
            onPress={() => navigate({ name: "verify" })}
            theme={theme}
          />
        </View>
      </View>

      <EventSlotStatusCard
        label="DASHBOARD STATUS"
        message={statsError ?? (session.authMode === "live"
          ? liveStats
            ? "Live dashboard data is connected."
            : "Loading dashboard metrics."
          : "Preparing your workspace details.")}
        theme={theme}
        emphasis={statsError ? "error" : "accent"}
        actionLabel={eventsLoading || statsLoading ? "Refreshing..." : "Refresh"}
        onActionPress={handleRefreshDashboard}
        style={[styles.statusCard, statsError ? { borderColor: theme.colors.error } : undefined]}
      />
    </View>
  );
}

type DashboardSectionProps = {
  title: string;
  theme: NativeScreenProps["theme"];
  loading: boolean;
  loadingTitle: string;
  loadingCaption: string;
  emptyTitle: string;
  emptyCaption: string;
  hasItems: boolean;
  children: React.ReactNode;
};

function DashboardSection({
  title,
  theme,
  loading,
  loadingTitle,
  loadingCaption,
  emptyTitle,
  emptyCaption,
  hasItems,
  children
}: DashboardSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{title}</Text>
      {loading ? (
        <EventSlotMessageCard title={loadingTitle} caption={loadingCaption} theme={theme} />
      ) : hasItems ? (
        children
      ) : (
        <EventSlotMessageCard title={emptyTitle} caption={emptyCaption} theme={theme} />
      )}
    </View>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatRegistrationTrend(current: number, previous: number) {
  const diff = current - previous;
  if (diff > 0) return `+${diff} vs last month`;
  if (diff < 0) return `${Math.abs(diff)} fewer vs last month`;
  return "Same as last month";
}

function formatDateLine(eventDate: string | null, deadline: string | null) {
  if (eventDate && deadline) return `${eventDate} | closes ${deadline}`;
  return eventDate ?? deadline ?? "Date not set";
}

function formatRelativeTime(value: string) {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return "Recently";
  const diffMs = Date.now() - parsed;
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const styles = StyleSheet.create({
  stack: {
    gap: 16
  },
  section: {
    gap: 10
  },
  planBanner: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    padding: 16
  },
  planTitle: {
    fontSize: 14,
    fontWeight: "900"
  },
  planCopy: {
    fontSize: 13,
    lineHeight: 18
  },
  sectionTitle: {
    ...typeScale.sectionTitle
  },
  groupCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden"
  },
  listRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    justifyContent: "space-between",
    padding: 16
  },
  listCopy: {
    flex: 1,
    gap: 6
  },
  listTitle: {
    fontSize: 16,
    fontWeight: "700"
  },
  listCaption: {
    fontSize: 13,
    lineHeight: 18
  },
  dashboardEventTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  dashboardEventBadge: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1
  },
  rowAction: {
    fontSize: 12,
    fontWeight: "700"
  },
  rowValue: {
    fontSize: 14,
    fontWeight: "800"
  },
  progressTrack: {
    borderRadius: 999,
    height: 4,
    marginTop: 2,
    overflow: "hidden"
  },
  progressFill: {
    borderRadius: 999,
    height: "100%"
  },
  quickGrid: {
    gap: 12
  },
  statusCard: {
    gap: 10
  }
});
