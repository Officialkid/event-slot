import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";

import { AppShell } from "./src/AppShell";
import { OnboardingScreen, onboardingSlideCount } from "./src/screens/OnboardingScreen";
import { SignInScreen } from "./src/screens/SignInScreen";
import { SplashScreen } from "./src/screens/SplashScreen";
import { AppSession } from "./src/session";
import { loadNativePreferences, saveOnboardingCompletion } from "./src/services/preferences";
import { cleanupNativeSession } from "./src/services/sessionCleanup";
import { restoreStoredSession, saveStoredSession } from "./src/services/sessionStore";
import { createTheme } from "./src/theme";

export default function App() {
  const [session, setSession] = useState<AppSession | null>(null);
  const [bootLoading, setBootLoading] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const theme = useMemo(() => createTheme(), []);

  useEffect(() => {
    let mounted = true;

    Promise.allSettled([loadNativePreferences(), restoreStoredSession()]).then(([preferencesResult, sessionResult]) => {
      if (!mounted) {
        return;
      }

      if (preferencesResult.status === "fulfilled") {
        setOnboardingCompleted(preferencesResult.value.onboardingCompleted);
      } else {
        setOnboardingCompleted(false);
      }

      if (sessionResult.status === "fulfilled" && sessionResult.value) {
        setSession(sessionResult.value);
      }

      setTimeout(() => {
        if (mounted) {
          setBootLoading(false);
        }
      }, 1200);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const handleLiveSignIn = (nextSession: AppSession) => {
    saveStoredSession(nextSession).catch(() => {});
    setSession(nextSession);
  };

  const handleSignOut = () => {
    cleanupNativeSession(session).catch(() => {});
    setSession(null);
  };

  const finishOnboarding = () => {
    setOnboardingCompleted(true);
    saveOnboardingCompletion(true).catch(() => {});
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.page }}>
      <StatusBar style="light" backgroundColor="#0A0A0A" />
      {bootLoading ? (
        <SplashScreen theme={theme} />
      ) : session ? (
        <AppShell
          session={session}
          theme={theme}
          onSignOut={handleSignOut}
        />
      ) : !onboardingCompleted ? (
        <OnboardingScreen
          theme={theme}
          stepIndex={onboardingStep}
          onNext={() => setOnboardingStep((current) => Math.min(current + 1, onboardingSlideCount - 1))}
          onSkip={finishOnboarding}
          onFinish={finishOnboarding}
        />
      ) : (
        <SignInScreen
          theme={theme}
          onLiveSignIn={handleLiveSignIn}
        />
      )}
    </View>
  );
}
