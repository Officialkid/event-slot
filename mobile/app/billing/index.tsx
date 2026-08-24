import { Redirect } from "expo-router";

import { useNativeApp } from "../../src/providers/NativeAppProvider";
import { useLegacyScreenProps } from "../../src/router/useLegacyScreenProps";
import { BillingScreen } from "../../src/screens/BillingScreen";

export default function BillingRoute() {
  const { session } = useNativeApp();

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  const props = useLegacyScreenProps();
  return <BillingScreen {...props} />;
}
