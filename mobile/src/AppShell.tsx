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
          accessibilityLabel="Create event"
          style={[styles.fab, { backgroundColor: theme.colors.accent }]}
          onPress={() => setRoute({ name: "createEvent" })}
        >
          <Text style={styles.fabText}>+</Text>
        </Pressable>

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
