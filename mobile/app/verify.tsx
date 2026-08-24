import { Redirect } from "expo-router";

import { VerifyScreen } from "../src/screens/VerifyScreen";
import { useLegacyScreenProps } from "../src/router/useLegacyScreenProps";
import { useNativeApp } from "../src/providers/NativeAppProvider";

export default function VerifyRoute() {
  const { session } = useNativeApp();

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  const props = useLegacyScreenProps();
  return <VerifyScreen {...props} />;
}
