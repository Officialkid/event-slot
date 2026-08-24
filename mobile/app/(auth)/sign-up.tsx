import { Redirect } from "expo-router";

import { useNativeApp } from "../../src/providers/NativeAppProvider";
import { SignInScreen } from "../../src/screens/SignInScreen";
import { SplashScreen } from "../../src/screens/SplashScreen";

export default function SignUpRoute() {
  const { bootLoading, session, signIn, theme } = useNativeApp();

  if (bootLoading) {
    return <SplashScreen theme={theme} />;
  }

  if (session) {
    return <Redirect href="/(tabs)" />;
  }

  return <SignInScreen theme={theme} onLiveSignIn={signIn} initialMode="signup" />;
}
