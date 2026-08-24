import { Redirect } from "expo-router";

import { useNativeApp } from "../../src/providers/NativeAppProvider";
import { useLegacyScreenProps } from "../../src/router/useLegacyScreenProps";
import { PaygSettingsScreen } from "../../src/screens/PaygSettingsScreen";

export default function PaygRoute() {
  const { session } = useNativeApp();

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  const props = useLegacyScreenProps();
  return <PaygSettingsScreen {...props} />;
}
