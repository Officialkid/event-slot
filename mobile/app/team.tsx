import { Redirect } from "expo-router";

import { TeamScreen } from "../src/screens/TeamScreen";
import { useLegacyScreenProps } from "../src/router/useLegacyScreenProps";
import { useNativeApp } from "../src/providers/NativeAppProvider";

export default function TeamRoute() {
  const { session } = useNativeApp();

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  const props = useLegacyScreenProps();
  return <TeamScreen {...props} />;
}
