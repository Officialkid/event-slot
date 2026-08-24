import { Redirect } from "expo-router";

import { useNativeApp } from "../../src/providers/NativeAppProvider";
import { OnboardingScreen, onboardingSlideCount } from "../../src/screens/OnboardingScreen";
import { SplashScreen } from "../../src/screens/SplashScreen";

export default function OnboardingRoute() {
  const { bootLoading, finishOnboarding, onboardingCompleted, onboardingStep, session, setOnboardingStep, theme } =
    useNativeApp();

  if (bootLoading) {
    return <SplashScreen theme={theme} />;
  }

  if (session) {
    return <Redirect href="/(tabs)" />;
  }

  if (onboardingCompleted) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <OnboardingScreen
      theme={theme}
      stepIndex={onboardingStep}
      onNext={() => setOnboardingStep(Math.min(onboardingStep + 1, onboardingSlideCount - 1))}
      onSkip={finishOnboarding}
      onFinish={finishOnboarding}
    />
  );
}
