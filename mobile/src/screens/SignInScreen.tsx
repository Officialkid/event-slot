import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Image, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";

import { eventSlotLogo } from "../brand";
import { nativeConfig } from "../config";
import { AppSession } from "../session";
import { loginNativeOrganizer, requestOrganizerOtp, signupOrganizer, toAppSession } from "../services/auth";
import { openSupportLink } from "../services/support";
import { AppTheme } from "../theme";
import { fontFamily, typeScale } from "../typography";

type SignInScreenProps = {
  theme: AppTheme;
  onLiveSignIn: (session: AppSession) => void;
  initialMode?: "signup" | "signin";
};

export function SignInScreen({ theme, onLiveSignIn, initialMode = "signin" }: SignInScreenProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"signup" | "signin">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [otpStatus, setOtpStatus] = useState<string | null>(null);
  const [otpLoading, setOtpLoading] = useState(false);
  const [loginStatus, setLoginStatus] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const showOtpField = nativeConfig.authMode === "live" && mode === "signin";
  const topInset = Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0;
  const webSignInUrl = `${nativeConfig.apiBaseUrl}/signin`;
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const handleWebSocialSignIn = async (provider: "Google" | "Apple") => {
    const opened = await openSupportLink(webSignInUrl);
    setLoginStatus(
      opened
        ? `${provider} sign-in opens through the live EventSlot web auth flow for now.`
        : `Could not open EventSlot web sign-in for ${provider} right now.`
    );
  };

  const handleModeChange = (nextMode: "signup" | "signin") => {
    setMode(nextMode);
    setLoginStatus(null);
    setOtpStatus(null);
    router.replace(nextMode === "signup" ? "/(auth)/sign-up" : "/(auth)/sign-in");
  };

  const handleForgotPassword = () => {
    setLoginStatus(null);
    setOtpStatus(null);
    router.push("/(auth)/forgot-password");
  };

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

  const handlePrimaryAction = async () => {
    const trimmedEmail = email.trim();
    const trimmedName = name.trim();

    if (!trimmedEmail || !password) {
      setLoginStatus(mode === "signup" ? "Enter your name, email, and password to create your account." : "Enter your email and password to continue.");
      return;
    }

    if (mode === "signup" && !trimmedName) {
      setLoginStatus("Enter your name to create your EventSlot account.");
      return;
    }

    if (mode === "signup" && !privacyAccepted) {
      setLoginStatus("Accept the EventSlot terms and privacy policy before creating your account.");
      return;
    }

    setLoginLoading(true);
    setLoginStatus(mode === "signup" ? "Creating your EventSlot account..." : "Signing in to EventSlot...");

    try {
      if (mode === "signup") {
        await signupOrganizer({
          name: trimmedName,
          email: trimmedEmail,
          password,
          privacyAccepted: true,
          preferredLanguage: "English - English"
        });
      }

      const nativeSession = await loginNativeOrganizer({
        email: trimmedEmail,
        password,
        otp: otp.trim() || undefined,
        deviceName: "EventSlot native app"
      });
      onLiveSignIn(toAppSession(nativeSession));
    } catch (error) {
      setLoginStatus(
        error instanceof Error
          ? error.message
          : mode === "signup"
            ? "Could not create your EventSlot account."
            : "Could not sign in to EventSlot."
      );
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.page, paddingTop: topInset }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : topInset}
        style={styles.keyboardWrap}
      >
        <ScrollView
          contentContainerStyle={styles.shell}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.hero, { backgroundColor: theme.colors.hero, borderColor: theme.colors.border }]}>
            <View style={styles.heroTop}>
              <View style={styles.brandWrap}>
                <Image source={eventSlotLogo} style={styles.logo} resizeMode="contain" />
                <View>
                  <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>EVENTSLOT</Text>
                  <Text style={[styles.brand, { color: theme.colors.text }]}>
                    Event<Text style={{ color: theme.colors.accent }}>Slot</Text>
                  </Text>
                </View>
              </View>
            </View>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              {mode === "signup" ? "Create your EventSlot account." : "Sign in to EventSlot."}
            </Text>
            <Text style={[styles.body, { color: theme.colors.secondary }]}>
              {mode === "signup"
                ? "Start with a real EventSlot account so the mobile app opens the same dashboard, events, alerts, and settings you use on the web."
                : "Use your real EventSlot organiser account to open the same mobile dashboard experience you already use on the web."}
            </Text>
          </View>

          <View style={[styles.formCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={[styles.readinessCard, { backgroundColor: theme.colors.hero, borderColor: theme.colors.border }]}>
              <Text style={[styles.readinessEyebrow, { color: theme.colors.accent }]}>NATIVE AUTH READINESS</Text>
              <Text style={[styles.readinessTitle, { color: theme.colors.text }]}>
                {nativeConfig.authMode === "live" ? "Live EventSlot auth enabled" : "Preview auth mode"}
              </Text>
              <Text style={[styles.readinessCopy, { color: theme.colors.secondary }]}>
                {nativeConfig.authMode === "live"
                  ? "This build is pointed at the real EventSlot API and will store bearer-token sessions securely on the device."
                  : "This build is still in preview auth mode, so sign-in is not yet using the full live EventSlot API path."}
              </Text>
            </View>

            <View style={[styles.modeTabs, { backgroundColor: theme.colors.hero, borderColor: theme.colors.border }]}>
              <Pressable
                accessibilityRole="button"
                onPress={() => handleModeChange("signup")}
                style={[styles.modeTab, mode === "signup" && { backgroundColor: theme.colors.activeTab }]}
              >
                <Text style={[styles.modeTabText, { color: mode === "signup" ? theme.colors.accent : theme.colors.secondary }]}>Create account</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => handleModeChange("signin")}
                style={[styles.modeTab, mode === "signin" && { backgroundColor: theme.colors.activeTab }]}
              >
                <Text style={[styles.modeTabText, { color: mode === "signin" ? theme.colors.accent : theme.colors.secondary }]}>Sign in</Text>
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => handleWebSocialSignIn("Google")}
              style={[styles.socialButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.hero }]}
            >
              <View style={styles.socialButtonContent}>
                <View style={styles.googleBadge}>
                  <Text style={styles.googleBadgeText}>G</Text>
                </View>
                <Text style={[styles.socialButtonText, { color: theme.colors.text }]}>Continue with Google</Text>
              </View>
            </Pressable>

            {Platform.OS === "ios" ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => handleWebSocialSignIn("Apple")}
                style={[styles.socialButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.hero }]}
              >
                <Text style={[styles.socialButtonText, { color: theme.colors.text }]}>Continue with Apple</Text>
              </Pressable>
            ) : null}

            {mode === "signup" ? (
              <>
                <Text style={[styles.label, { color: theme.colors.muted }]}>FULL NAME</Text>
                <TextInput
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor={theme.colors.muted}
                  style={[styles.input, { backgroundColor: theme.colors.input, borderColor: theme.colors.border, color: theme.colors.text }]}
                  value={name}
                />
              </>
            ) : null}
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
            {showOtpField ? (
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
            {mode === "signup" ? (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: privacyAccepted }}
                onPress={() => setPrivacyAccepted((current) => !current)}
                style={styles.checkboxRow}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      backgroundColor: privacyAccepted ? theme.colors.accent : theme.colors.input,
                      borderColor: theme.colors.border
                    }
                  ]}
                >
                  {privacyAccepted ? <Text style={styles.checkboxTick}>{"\u2713"}</Text> : null}
                </View>
                <Text style={[styles.checkboxText, { color: theme.colors.secondary }]}>
                  I consent to EventSlot processing my data in line with its Privacy Policy and the Kenya Data Protection Act 2019.
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={loginLoading}
              onPress={handlePrimaryAction}
              style={[styles.primaryButton, { backgroundColor: theme.colors.accent, opacity: loginLoading ? 0.65 : 1 }]}
            >
              <Text style={styles.primaryButtonText}>
                {loginLoading ? (mode === "signup" ? "Creating account..." : "Signing in...") : mode === "signup" ? "Create account" : "Sign in to EventSlot"}
              </Text>
            </Pressable>
            {mode === "signin" ? (
              <View style={styles.secondaryActions}>
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
                <Pressable
                  accessibilityRole="button"
                  onPress={handleForgotPassword}
                  style={[styles.secondaryButton, { borderColor: theme.colors.border }]}
                >
                  <Text style={[styles.secondaryButtonText, { color: theme.colors.secondary }]}>Forgot password</Text>
                </Pressable>
              </View>
            ) : null}
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
              EventSlot keeps your signed-in session in secure device storage.
            </Text>
            <View style={styles.routeFooter}>
              <Text style={[styles.routeFooterText, { color: theme.colors.secondary }]}>
                {mode === "signup" ? "Already have an account?" : "Don't have an account?"}
              </Text>
              <Pressable accessibilityRole="button" onPress={() => handleModeChange(mode === "signup" ? "signin" : "signup")}>
                <Text style={[styles.routeFooterLink, { color: theme.colors.accent }]}>
                  {mode === "signup" ? "Sign in" : "Sign up"}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  keyboardWrap: {
    flex: 1
  },
  shell: {
    alignItems: "center",
    flexGrow: 1,
    gap: 18,
    padding: 20,
    paddingBottom: 32
  },
  hero: {
    borderRadius: 28,
    borderWidth: 1,
    gap: 16,
    maxWidth: 560,
    padding: 22,
    width: "100%"
  },
  heroTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between"
  },
  brandWrap: {
    alignItems: "center",
    flexDirection: "row",
    flex: 1,
    gap: 12
  },
  logo: {
    borderRadius: 12,
    height: 40,
    width: 40
  },
  eyebrow: {
    ...typeScale.label,
    letterSpacing: 2.6
  },
  brand: {
    fontFamily: fontFamily.display,
    fontSize: 24,
    fontWeight: "400",
    lineHeight: 28,
    marginTop: 1
  },
  title: {
    fontFamily: fontFamily.medium,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.6,
    lineHeight: 34
  },
  body: {
    ...typeScale.body
  },
  formCard: {
    borderRadius: 28,
    borderWidth: 1,
    gap: 12,
    maxWidth: 560,
    padding: 20,
    width: "100%"
  },
  readinessCard: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 5,
    padding: 16
  },
  readinessEyebrow: {
    ...typeScale.label
  },
  readinessTitle: {
    fontFamily: fontFamily.medium,
    fontSize: 18,
    fontWeight: "900"
  },
  readinessCopy: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 19
  },
  modeTabs: {
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 4,
    padding: 4
  },
  modeTab: {
    alignItems: "center",
    borderRadius: 999,
    flex: 1,
    paddingVertical: 12
  },
  modeTabText: {
    ...typeScale.bodyStrong
  },
  socialButton: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 56,
    justifyContent: "center",
    paddingHorizontal: 16
  },
  socialButtonContent: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "center"
  },
  googleBadge: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    height: 26,
    justifyContent: "center",
    width: 26
  },
  googleBadgeText: {
    color: "#4285F4",
    fontFamily: fontFamily.medium,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 18
  },
  socialButtonText: {
    fontFamily: fontFamily.medium,
    fontSize: 15,
    fontWeight: "900"
  },
  label: {
    ...typeScale.label
  },
  input: {
    borderRadius: 18,
    borderWidth: 1,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  checkboxRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    marginTop: 4
  },
  checkbox: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    height: 24,
    justifyContent: "center",
    marginTop: 1,
    width: 24
  },
  checkboxTick: {
    color: "#0A0A0A",
    fontSize: 14,
    fontWeight: "900"
  },
  checkboxText: {
    flex: 1,
    ...typeScale.body
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
    flex: 1,
    paddingVertical: 14
  },
  secondaryActions: {
    flexDirection: "row",
    gap: 10
  },
  secondaryButtonText: {
    ...typeScale.bodyStrong
  },
  disclaimer: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center"
  },
  routeFooter: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginTop: 4
  },
  routeFooterText: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 18
  },
  routeFooterLink: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    fontWeight: "900"
  }
});
