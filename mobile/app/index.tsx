import { Redirect } from "expo-router";

import { SplashScreen } from "../src/screens/SplashScreen";
import { useNativeApp } from "../src/providers/NativeAppProvider";

export default function IndexRoute() {
  const { bootLoading, onboardingCompleted, session, theme } = useNativeApp();

  if (bootLoading) {
    return <SplashScreen theme={theme} />;
  }

  if (session) {
    return <Redirect href="/(tabs)" />;
  }

  if (!onboardingCompleted) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  return <Redirect href="/(auth)/sign-in" />;
}
