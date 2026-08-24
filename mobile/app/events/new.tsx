import { Redirect } from "expo-router";

import { useNativeApp } from "../../src/providers/NativeAppProvider";
import { CreateEventScreen } from "../../src/screens/CreateEventScreen";
import { useLegacyScreenProps } from "../../src/router/useLegacyScreenProps";

export default function CreateEventRoute() {
  const { session } = useNativeApp();

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  const props = useLegacyScreenProps();
  return <CreateEventScreen {...props} />;
}
