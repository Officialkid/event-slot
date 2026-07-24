import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

import { CreateEventScreen } from "./screens/CreateEventScreen";
import { DashboardScreen } from "./screens/DashboardScreen";
import { EventDetailScreen } from "./screens/EventDetailScreen";
import { EventsScreen } from "./screens/EventsScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { VerifyScreen } from "./screens/VerifyScreen";
import { AppSession } from "./session";
import { listNativeEvents } from "./services/events";
import { AppTheme } from "./theme";
import { AppRoute, tabs } from "./tabs";
import { NativeEvent } from "./domain/events";

type AppShellProps = {
  session: AppSession;
  theme: AppTheme;
  onSignOut: () => void;
  onToggleTheme: () => void;
};

export function AppShell({ session, theme, onSignOut, onToggleTheme }: AppShellProps) {
  const [route, setRoute] = useState<AppRoute>({ name: "home" });
  const [events, setEvents] = useState<NativeEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const activeTab = route.name === "eventDetail" || route.name === "createEvent" ? "events" : route.name;

  const refreshEvents = useCallback(() => {
    setEventsLoading(true);
    setEventsError(null);
    listNativeEvents(session)
      .then(setEvents)
      .catch((error: unknown) => {
        setEventsError(error instanceof Error ? error.message : "Could not load events.");
      })
      .finally(() => setEventsLoading(false));
  }, [session]);

  useEffect(() => {
    refreshEvents();
  }, [refreshEvents]);

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
      case "events":
        return <EventsScreen {...props} />;
      case "verify":
        return <VerifyScreen {...props} />;
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
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.page }]}>
      <View style={[styles.shell, { backgroundColor: theme.colors.page }]}>
        <View style={[styles.header, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <View>
            <Text style={[styles.brandEyebrow, { color: theme.colors.muted }]}>EVENTSLOT NATIVE</Text>
            <Text style={[styles.brand, { color: theme.colors.text }]}>
              Event<Text style={{ color: theme.colors.accent }}>Slot</Text>
            </Text>
          </View>
          <View style={styles.headerActions}>
            <View style={[styles.tokenChip, { borderColor: theme.colors.border, backgroundColor: theme.colors.activeTab }]}>
              <Text style={[styles.tokenText, { color: theme.colors.accent }]}>{session.tokenBalance} tokens</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Toggle theme"
              onPress={onToggleTheme}
              style={[styles.iconButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.elevated }]}
            >
              <Text style={{ color: theme.colors.text }}>{theme.name === "dark" ? "sun" : "moon"}</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
              <Text style={[styles.sheetEyebrow, { color: theme.colors.accent }]}>QUICK ACTIONS</Text>
              <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>What do you want to do?</Text>
              <Text style={[styles.sheetCopy, { color: theme.colors.secondary }]}>
                Fast mobile shortcuts for the actions organizers use most during an event day.
              </Text>
              <View style={styles.sheetGrid}>
                <SheetAction
                  label="Create event"
                  caption="Start a saved native draft"
                  theme={theme}
                  onPress={() => navigateFromSheet({ name: "createEvent" })}
                />
                <SheetAction
                  label="Verify tickets"
                  caption="Scan or enter ticket codes"
                  theme={theme}
                  onPress={() => navigateFromSheet({ name: "verify" })}
                />
                <SheetAction
                  label="My events"
                  caption="Open live event workspace"
                  theme={theme}
                  onPress={() => navigateFromSheet({ name: "events" })}
                />
                <SheetAction
                  label="Profile"
                  caption="Settings and release gates"
                  theme={theme}
                  onPress={() => navigateFromSheet({ name: "profile" })}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => setQuickActionsOpen(false)}
                style={[styles.sheetCloseButton, { borderColor: theme.colors.border }]}
              >
                <Text style={[styles.sheetCloseText, { color: theme.colors.text }]}>Close</Text>
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
                style={[
                  styles.tabItem,
                  active && { backgroundColor: theme.colors.activeTab }
                ]}
              >
                <Text style={[styles.tabIcon, { color: active ? theme.colors.accent : theme.colors.muted }]}>
                  {tab.icon}
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
  brandEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2.5
  },
  brand: {
    fontSize: 26,
    fontWeight: "900"
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
  content: {
    paddingBottom: 130,
    paddingTop: 18
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
    fontSize: 24,
    fontWeight: "900"
  },
  sheetCopy: {
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
    fontSize: 16,
    fontWeight: "900"
  },
  sheetActionCaption: {
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
    fontSize: 12,
    fontWeight: "700"
  }
});
