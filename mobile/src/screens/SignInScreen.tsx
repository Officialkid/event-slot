import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";

import { AppTheme } from "../theme";

type SignInScreenProps = {
  theme: AppTheme;
  onDemoSignIn: () => void;
  onToggleTheme: () => void;
};

export function SignInScreen({ theme, onDemoSignIn, onToggleTheme }: SignInScreenProps) {
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.page }]}>
      <View style={styles.shell}>
        <View style={[styles.hero, { backgroundColor: theme.colors.hero, borderColor: theme.colors.border }]}>
          <View style={styles.heroTop}>
            <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>EVENTSLOT NATIVE</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Toggle theme"
              onPress={onToggleTheme}
              style={[styles.themeButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.elevated }]}
            >
              <Text style={{ color: theme.colors.text }}>{theme.name === "dark" ? "sun" : "moon"}</Text>
            </Pressable>
          </View>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Manage events from a real mobile app.
          </Text>
          <Text style={[styles.body, { color: theme.colors.secondary }]}>
            This native rebuild will keep the EventSlot web platform stable while we add native sign-in, scanning, offline drafts, push notifications, and smoother mobile navigation.
          </Text>
        </View>

        <View style={[styles.formCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.label, { color: theme.colors.muted }]}>EMAIL ADDRESS</Text>
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@eventsslot.com"
            placeholderTextColor={theme.colors.muted}
            style={[styles.input, { backgroundColor: theme.colors.input, borderColor: theme.colors.border, color: theme.colors.text }]}
          />
          <Text style={[styles.label, { color: theme.colors.muted }]}>PASSWORD</Text>
          <TextInput
            placeholder="Enter password"
            placeholderTextColor={theme.colors.muted}
            secureTextEntry
            style={[styles.input, { backgroundColor: theme.colors.input, borderColor: theme.colors.border, color: theme.colors.text }]}
          />
          <Pressable
            accessibilityRole="button"
            onPress={onDemoSignIn}
            style={[styles.primaryButton, { backgroundColor: theme.colors.accent }]}
          >
            <Text style={styles.primaryButtonText}>Continue to demo shell</Text>
          </Pressable>
          <Text style={[styles.disclaimer, { color: theme.colors.muted }]}>
            Real auth wiring comes next. This keeps the native work separate from the live web system until it is fully ready.
          </Text>
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
    gap: 18,
    justifyContent: "center",
    padding: 18
  },
  hero: {
    borderRadius: 32,
    borderWidth: 1,
    gap: 18,
    padding: 24
  },
  heroTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2.4
  },
  themeButton: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  title: {
    fontSize: 38,
    fontWeight: "900",
    lineHeight: 42
  },
  body: {
    fontSize: 16,
    lineHeight: 25
  },
  formCard: {
    borderRadius: 28,
    borderWidth: 1,
    gap: 12,
    padding: 20
  },
  label: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2
  },
  input: {
    borderRadius: 18,
    borderWidth: 1,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 999,
    marginTop: 8,
    paddingVertical: 16
  },
  primaryButtonText: {
    color: "#0A0A0A",
    fontSize: 15,
    fontWeight: "900"
  },
  disclaimer: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center"
  }
});

