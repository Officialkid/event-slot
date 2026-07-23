import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

import { DashboardScreen } from "./src/screens/DashboardScreen";
import { EventsScreen } from "./src/screens/EventsScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { VerifyScreen } from "./src/screens/VerifyScreen";
import { ThemeName, createTheme } from "./src/theme";

type TabKey = "home" | "events" | "verify" | "profile";

const tabs: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: "home", label: "Home", icon: "grid" },
  { key: "events", label: "Events", icon: "calendar" },
  { key: "verify", label: "Verify", icon: "scan" },
  { key: "profile", label: "Profile", icon: "user" }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [themeName, setThemeName] = useState<ThemeName>("dark");
  const theme = useMemo(() => createTheme(themeName), [themeName]);

  const Screen = {
    home: DashboardScreen,
    events: EventsScreen,
    verify: VerifyScreen,
    profile: ProfileScreen
  }[activeTab];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.page }]}>
      <StatusBar style={themeName === "dark" ? "light" : "dark"} />
      <View style={[styles.shell, { backgroundColor: theme.colors.page }]}>
        <View style={[styles.header, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <View>
            <Text style={[styles.brandEyebrow, { color: theme.colors.muted }]}>EVENTSLOT</Text>
            <Text style={[styles.brand, { color: theme.colors.text }]}>
              Event<Text style={{ color: theme.colors.accent }}>Slot</Text>
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Toggle theme"
            onPress={() => setThemeName((current) => (current === "dark" ? "light" : "dark"))}
            style={[styles.themeButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.elevated }]}
          >
            <Text style={{ color: theme.colors.text }}>{themeName === "dark" ? "sun" : "moon"}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Screen theme={theme} />
        </ScrollView>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create event"
          style={[styles.fab, { backgroundColor: theme.colors.accent }]}
          onPress={() => setActiveTab("events")}
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
                onPress={() => setActiveTab(tab.key)}
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
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2.8
  },
  brand: {
    fontSize: 26,
    fontWeight: "900"
  },
  themeButton: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48
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

