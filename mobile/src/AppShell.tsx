import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  StatusBar,
  Text,
  View
} from "react-native";

import { CreateEventScreen } from "./screens/CreateEventScreen";
import { DashboardScreen } from "./screens/DashboardScreen";
import { EventDetailScreen } from "./screens/EventDetailScreen";
import { EventsScreen } from "./screens/EventsScreen";
import { ForgotPasswordScreen } from "./screens/ForgotPasswordScreen";
import { NotificationsScreen } from "./screens/NotificationsScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { RegistrationDetailScreen } from "./screens/RegistrationDetailScreen";
import { TeamScreen } from "./screens/TeamScreen";
import { UiStatesScreen } from "./screens/UiStatesScreen";
import { VerifyScreen } from "./screens/VerifyScreen";
import { AppSession } from "./session";
import { listNativeEvents } from "./services/events";
import { buildNativeWorkspaceSyncSummary, getNativeWorkspaceSyncReadinessMessage } from "./services/workspaceSync";
import { AppTheme } from "./theme";
import { AppRoute, tabs } from "./tabs";
import { NativeEvent } from "./domain/events";
import { getTabGlyph } from "./brand";
import { fontFamily } from "./typography";

type AppShellProps = {
  session: AppSession;
  theme: AppTheme;
  onSignOut: () => void;
};

export function AppShell({ session, theme, onSignOut }: AppShellProps) {
  const [route, setRoute] = useState<AppRoute>({ name: "home" });
  const [events, setEvents] = useState<NativeEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const topInset = Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0;
  const activeTab =
    route.name === "eventDetail" || route.name === "registrationDetail" || route.name === "createEvent"
      ? "events"
      : route.name === "verify" || route.name === "profile" || route.name === "forgotPassword" || route.name === "team" || route.name === "states"
        ? "more"
        : route.name;
  const currentTitle = getScreenTitle(route);
  const currentSubtitle = getScreenSubtitle(route);

  const refreshEvents = useCallback(() => {
    setEventsLoading(true);
    setEventsError(null);
    listNativeEvents(session)
      .then((nextEvents) => {
        setEvents(nextEvents);
        setLastSyncedAt(new Date().toISOString());
      })
      .catch((error: unknown) => {
        setEventsError(error instanceof Error ? error.message : "Could not load events.");
      })
      .finally(() => setEventsLoading(false));
  }, [session]);

  useEffect(() => {
    refreshEvents();
  }, [refreshEvents]);

  const workspaceSync = useMemo(
    () =>
      buildNativeWorkspaceSyncSummary({
        events,
        error: eventsError,
        lastSyncedAt,
        loading: eventsLoading,
        session
      }),
    [events, eventsError, eventsLoading, lastSyncedAt, session]
  );

  const screen = useMemo(() => {
    const props = {
      session,
      theme,
      navigate: setRoute,
      onSignOut,
      events,
      eventsLoading,
      eventsError,
      refreshEvents
    };

    switch (route.name) {
      case "createEvent":
        return <CreateEventScreen {...props} />;
      case "eventDetail":
        return <EventDetailScreen {...props} eventId={route.eventId} />;
      case "registrationDetail":
        return <RegistrationDetailScreen {...props} eventSlug={route.eventSlug} registrationId={route.registrationId} />;
      case "events":
        return <EventsScreen {...props} />;
      case "alerts":
        return <NotificationsScreen {...props} />;
      case "verify":
        return <VerifyScreen {...props} />;
      case "forgotPassword":
        return <ForgotPasswordScreen theme={theme} />;
      case "team":
        return <TeamScreen {...props} />;
      case "states":
        return <UiStatesScreen {...props} />;
      case "more":
      case "profile":
        return <ProfileScreen {...props} />;
      case "home":
      default:
        return <DashboardScreen {...props} />;
    }
  }, [events, eventsError, eventsLoading, onSignOut, refreshEvents, route, session, theme]);

  const navigateFromSheet = (nextRoute: AppRoute) => {
    setQuickActionsOpen(false);
    setRoute(nextRoute);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.page, paddingTop: topInset }]}>
      <View style={[styles.shell, { backgroundColor: theme.colors.page }]}>
        <View style={[styles.header, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <View style={styles.brandWrap}>
            <View style={styles.titleWrap}>
              <Text style={[styles.pageTitle, { color: theme.colors.text }]}>{currentTitle}</Text>
              <Text style={[styles.pageSubtitle, { color: theme.colors.muted }]}>{currentSubtitle}</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <View style={[styles.tokenChip, { borderColor: theme.colors.border, backgroundColor: theme.colors.activeTab }]}>
              <Text style={[styles.tokenText, { color: theme.colors.accent }]}>{session.tokenBalance} tokens</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open help and app states"
              onPress={() => setRoute({ name: "states" })}
              style={[styles.iconButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.elevated }]}
            >
              <Text style={[styles.iconGlyph, { color: theme.colors.text }]}>?</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open alerts"
              onPress={() => setRoute({ name: "alerts" })}
              style={[styles.iconButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.elevated }]}
            >
              <Text style={[styles.iconGlyph, { color: theme.colors.text }]}>{"\u25CB"}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open more actions"
              onPress={() => setQuickActionsOpen(true)}
              style={[styles.iconButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.elevated }]}
            >
              <Text style={[styles.iconGlyph, { color: theme.colors.text }]}>{"\u22EF"}</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View
            style={[
              styles.syncBanner,
              {
                backgroundColor: theme.colors.surface,
                borderColor:
                  workspaceSync.status === "error"
                    ? theme.colors.error
                    : workspaceSync.status === "ready"
                      ? theme.colors.success
                      : theme.colors.border
              }
            ]}
          >
            <View style={styles.syncCopy}>
              <Text style={[styles.syncEyebrow, { color: theme.colors.accent }]}>WORKSPACE SYNC</Text>
              <Text style={[styles.syncTitle, { color: theme.colors.text }]}>{workspaceSync.title}</Text>
              <Text style={[styles.syncCaption, { color: theme.colors.secondary }]}>{workspaceSync.caption}</Text>
              <Text style={[styles.syncHelper, { color: theme.colors.muted }]}>{getNativeWorkspaceSyncReadinessMessage()}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={refreshEvents}
              style={[styles.syncButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.activeTab }]}
            >
              <Text style={[styles.syncButtonText, { color: theme.colors.accent }]}>
                {eventsLoading ? "Syncing..." : "Retry sync"}
              </Text>
            </Pressable>
          </View>
          {screen}
        </ScrollView>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open quick actions"
          style={[styles.fab, { backgroundColor: theme.colors.accent }]}
          onPress={() => setQuickActionsOpen(true)}
        >
          <Text style={styles.fabText}>+</Text>
        </Pressable>

        {quickActionsOpen ? (
          <View style={styles.sheetLayer} pointerEvents="box-none">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close quick actions"
              onPress={() => setQuickActionsOpen(false)}
              style={styles.sheetScrim}
            />
            <View style={[styles.bottomSheet, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={[styles.sheetHandle, { backgroundColor: theme.colors.border }]} />
              <Text style={[styles.sheetEyebrow, { color: theme.colors.accent }]}>WORKSPACE</Text>
              <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>More</Text>
              <Text style={[styles.sheetCopy, { color: theme.colors.secondary }]}>
                Profile, team access, verifier tools, and app guidance live here so the main navigation stays simple.
              </Text>
              <View style={styles.sheetGrid}>
                <SheetAction label="Create event" caption="Start a new draft" theme={theme} onPress={() => navigateFromSheet({ name: "createEvent" })} />
                <SheetAction label="Verify tickets" caption="Scan or enter ticket codes" theme={theme} onPress={() => navigateFromSheet({ name: "verify" })} />
                <SheetAction label="Profile" caption="Account and preferences" theme={theme} onPress={() => navigateFromSheet({ name: "profile" })} />
                <SheetAction label="Team" caption="Invites and member access" theme={theme} onPress={() => navigateFromSheet({ name: "team" })} />
                <SheetAction label="App states" caption="Review the 10 mobile UX states" theme={theme} onPress={() => navigateFromSheet({ name: "states" })} />
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={onSignOut}
                style={[styles.sheetCloseButton, { borderColor: theme.colors.border }]}
              >
                <Text style={[styles.sheetCloseText, { color: theme.colors.error }]}>Sign out</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={[styles.tabBar, { borderColor: theme.colors.border, backgroundColor: theme.colors.nav }]}>
          {tabs.map((tab) => {
            const active = tab.key === activeTab;
            return (
              <Pressable
                key={tab.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setRoute({ name: tab.key })}
                style={[styles.tabItem, active && { backgroundColor: theme.colors.activeTab }]}
              >
                <Text style={[styles.tabIcon, { color: active ? theme.colors.accent : theme.colors.muted }]}>
                  {getTabGlyph(tab.key)}
                </Text>
                <Text style={[styles.tabLabel, { color: active ? theme.colors.accent : theme.colors.secondary }]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

type SheetActionProps = {
  label: string;
  caption: string;
  theme: AppTheme;
  onPress: () => void;
};

function SheetAction({ label, caption, theme, onPress }: SheetActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.sheetAction, { backgroundColor: theme.colors.hero, borderColor: theme.colors.border }]}
    >
      <Text style={[styles.sheetActionLabel, { color: theme.colors.text }]}>{label}</Text>
      <Text style={[styles.sheetActionCaption, { color: theme.colors.secondary }]}>{caption}</Text>
    </Pressable>
  );
}

function getScreenTitle(route: AppRoute) {
  switch (route.name) {
    case "home":
      return "Dashboard";
    case "events":
      return "My Events";
    case "alerts":
      return "Notifications";
    case "more":
      return "More";
    case "verify":
      return "Verify";
    case "profile":
      return "Profile";
    case "forgotPassword":
      return "Reset password";
    case "team":
      return "Team";
    case "states":
      return "App states";
    case "createEvent":
      return "Create event";
    case "eventDetail":
      return "Event detail";
    case "registrationDetail":
      return "Attendee detail";
    default:
      return "Dashboard";
  }
}

function getScreenSubtitle(route: AppRoute) {
  if (route.name === "verify") {
    return "EVENTSLOT VERIFIER";
  }

  if (route.name === "forgotPassword") {
    return "EVENTSLOT ACCOUNT";
  }

  return "EVENTSLOT ORGANIZER";
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  shell: {
    flex: 1,
    paddingHorizontal: 16
  },
  header: {
    alignItems: "center",
    borderRadius: 26,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    padding: 18
  },
  brandWrap: {
    flex: 1,
    minWidth: 0
  },
  titleWrap: {
    gap: 4
  },
  pageTitle: {
    fontFamily: fontFamily.display,
    fontSize: 28,
    fontWeight: "400",
    lineHeight: 32
  },
  pageSubtitle: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.8
  },
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  tokenChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  tokenText: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    fontWeight: "900"
  },
  iconButton: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  iconGlyph: {
    fontSize: 18,
    fontWeight: "700"
  },
  content: {
    paddingBottom: 130,
    paddingTop: 18
  },
  syncBanner: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    marginBottom: 18,
    padding: 16
  },
  syncCopy: {
    gap: 4
  },
  syncEyebrow: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2
  },
  syncTitle: {
    fontFamily: fontFamily.medium,
    fontSize: 18,
    fontWeight: "900"
  },
  syncCaption: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 18
  },
  syncHelper: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    lineHeight: 17
  },
  syncButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 12
  },
  syncButtonText: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    fontWeight: "900"
  },
  fab: {
    alignItems: "center",
    borderRadius: 28,
    bottom: 90,
    height: 64,
    justifyContent: "center",
    position: "absolute",
    right: 22,
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 18,
    width: 64
  },
  fabText: {
    color: "#0A0A0A",
    fontSize: 34,
    fontWeight: "500",
    lineHeight: 36
  },
  sheetLayer: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 20
  },
  sheetScrim: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  bottomSheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    bottom: 0,
    gap: 12,
    left: 0,
    padding: 18,
    paddingBottom: 104,
    position: "absolute",
    right: 0,
    shadowColor: "#000",
    shadowOpacity: 0.26,
    shadowRadius: 22
  },
  sheetHandle: {
    alignSelf: "center",
    borderRadius: 999,
    height: 4,
    marginBottom: 4,
    width: 48
  },
  sheetEyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2.4
  },
  sheetTitle: {
    fontFamily: fontFamily.display,
    fontSize: 28,
    fontWeight: "400"
  },
  sheetCopy: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 20
  },
  sheetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  sheetAction: {
    borderRadius: 20,
    borderWidth: 1,
    flexBasis: "48%",
    flexGrow: 1,
    gap: 5,
    minHeight: 92,
    padding: 14
  },
  sheetActionLabel: {
    fontFamily: fontFamily.medium,
    fontSize: 16,
    fontWeight: "900"
  },
  sheetActionCaption: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
  },
  sheetCloseButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 13
  },
  sheetCloseText: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    fontWeight: "900"
  },
  tabBar: {
    alignItems: "center",
    borderRadius: 28,
    borderWidth: 1,
    bottom: 16,
    flexDirection: "row",
    gap: 8,
    left: 16,
    padding: 10,
    position: "absolute",
    right: 16
  },
  tabItem: {
    alignItems: "center",
    borderRadius: 22,
    flex: 1,
    gap: 4,
    paddingVertical: 10
  },
  tabIcon: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  tabLabel: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    fontWeight: "700"
  }
});
