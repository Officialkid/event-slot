import { Redirect } from "expo-router";

import { UiStatesScreen } from "../src/screens/UiStatesScreen";
import { useLegacyScreenProps } from "../src/router/useLegacyScreenProps";
import { useNativeApp } from "../src/providers/NativeAppProvider";

export default function StatesRoute() {
  const { session } = useNativeApp();

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  const props = useLegacyScreenProps();
  return <UiStatesScreen {...props} />;
}
