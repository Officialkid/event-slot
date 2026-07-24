import { useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";

import { nativeConfig } from "../config";
import { getNativeAuthReadinessItems, loginNativeOrganizer, requestOrganizerOtp, toAppSession } from "../services/auth";
import { AppSession } from "../session";
import { AppTheme } from "../theme";

type SignInScreenProps = {
  theme: AppTheme;
  onDemoSignIn: () => void;
  onLiveSignIn: (session: AppSession) => void;
  onToggleTheme: () => void;
};

export function SignInScreen({ theme, onDemoSignIn, onLiveSignIn, onToggleTheme }: SignInScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpStatus, setOtpStatus] = useState<string | null>(null);
  const [otpLoading, setOtpLoading] = useState(false);
  const [loginStatus, setLoginStatus] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const liveMode = nativeConfig.authMode === "live";
  const allowDemoFallback = !liveMode;
  const authReadinessItems = getNativeAuthReadinessItems();

  const handleOtpRequest = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setOtpStatus("Enter your email first so EventSlot knows where to send the code.");
      return;
    }

    setOtpLoading(true);
    setOtpStatus(null);

    try {
      await requestOrganizerOtp({ email: trimmedEmail });
      setOtpStatus("OTP request sent. Check your email, then enter the code if EventSlot asks for it.");
    } catch (error) {
      setOtpStatus(error instanceof Error ? error.message : "Could not request OTP right now.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handlePrimarySignIn = async () => {
    if (!liveMode) {
      onDemoSignIn();
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setLoginStatus("Enter your email and password to continue.");
      return;
    }

    setLoginLoading(true);
    setLoginStatus("Signing in with native auth...");

    try {
      const nativeSession = await loginNativeOrganizer({
        email: trimmedEmail,
        password,
        otp: otp.trim() || undefined,
        deviceName: "EventSlot native app"
      });
      onLiveSignIn(toAppSession(nativeSession));
    } catch (error) {
      setLoginStatus(error instanceof Error ? error.message : "Could not sign in with native auth.");
    } finally {
      setLoginLoading(false);
    }
  };

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
            Sign in to manage events, registrations, ticket verification, exports, settings, and mobile-ready event operations.
          </Text>
          <Text style={[styles.modePill, { backgroundColor: theme.colors.activeTab, color: theme.colors.accent }]}>
            {nativeConfig.authMode === "demo" ? "DEMO MODE" : "EVENTSLOT ACCOUNT"}
          </Text>
        </View>

        <View style={[styles.readinessCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.label, { color: theme.colors.muted }]}>NATIVE AUTH READINESS</Text>
          {authReadinessItems.map((item) => (
            <View key={item} style={styles.readinessRow}>
              <Text style={[styles.readinessDot, { color: theme.colors.accent }]}>*</Text>
              <Text style={[styles.readinessText, { color: theme.colors.secondary }]}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.formCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.label, { color: theme.colors.muted }]}>EMAIL ADDRESS</Text>
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="you@eventsslot.com"
            placeholderTextColor={theme.colors.muted}
            style={[styles.input, { backgroundColor: theme.colors.input, borderColor: theme.colors.border, color: theme.colors.text }]}
            value={email}
          />
          <Text style={[styles.label, { color: theme.colors.muted }]}>PASSWORD</Text>
          <TextInput
            onChangeText={setPassword}
            placeholder="Enter password"
            placeholderTextColor={theme.colors.muted}
            secureTextEntry
            style={[styles.input, { backgroundColor: theme.colors.input, borderColor: theme.colors.border, color: theme.colors.text }]}
            value={password}
          />
          {liveMode ? (
            <>
              <Text style={[styles.label, { color: theme.colors.muted }]}>OTP CODE</Text>
              <TextInput
                keyboardType="number-pad"
                onChangeText={setOtp}
                placeholder="Only if your account asks for it"
                placeholderTextColor={theme.colors.muted}
                style={[styles.input, { backgroundColor: theme.colors.input, borderColor: theme.colors.border, color: theme.colors.text }]}
                value={otp}
              />
            </>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={loginLoading}
            onPress={handlePrimarySignIn}
            style={[styles.primaryButton, { backgroundColor: theme.colors.accent, opacity: loginLoading ? 0.65 : 1 }]}
          >
            <Text style={styles.primaryButtonText}>
              {loginLoading ? "Signing in..." : liveMode ? "Sign in to EventSlot" : "Continue to demo"}
            </Text>
          </Pressable>
          {allowDemoFallback ? (
            <Pressable
              accessibilityRole="button"
              onPress={onDemoSignIn}
              style={[styles.secondaryButton, { borderColor: theme.colors.border }]}
            >
              <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>Use demo instead</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={otpLoading}
            onPress={handleOtpRequest}
            style={[styles.secondaryButton, { borderColor: theme.colors.border, opacity: otpLoading ? 0.6 : 1 }]}
          >
            <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>
              {otpLoading ? "Requesting OTP..." : "Send OTP code"}
            </Text>
          </Pressable>
          {otpStatus ? (
            <Text style={[styles.disclaimer, { color: theme.colors.secondary }]}>
              {otpStatus}
            </Text>
          ) : null}
          {loginStatus ? (
            <Text style={[styles.disclaimer, { color: theme.colors.secondary }]}>
              {loginStatus}
            </Text>
          ) : null}
          <Text style={[styles.disclaimer, { color: theme.colors.muted }]}>
            {liveMode
              ? "EventSlot keeps your signed-in session in secure device storage."
              : "Demo mode is only for internal QA builds."}
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
  modePill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.8,
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  formCard: {
    borderRadius: 28,
    borderWidth: 1,
    gap: 12,
    padding: 20
  },
  readinessCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    padding: 18
  },
  readinessDot: {
    fontSize: 18,
    lineHeight: 21
  },
  readinessRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8
  },
  readinessText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20
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
  secondaryButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 14
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "900"
  },
  disclaimer: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center"
  }
});
