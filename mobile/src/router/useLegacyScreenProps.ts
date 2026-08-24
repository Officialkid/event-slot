import { useRouter } from "expo-router";

import { useNativeApp } from "../providers/NativeAppProvider";
import { NativeScreenProps } from "../screens/types";
import { appRouteToHref } from "./legacyRouteAdapter";

export function useLegacyScreenProps(): NativeScreenProps {
  const router = useRouter();
  const { events, eventsError, eventsLoading, refreshEvents, session, signOut, theme } = useNativeApp();

  if (!session) {
    throw new Error("Legacy screen props require an active session.");
  }

  return {
    session,
    theme,
    navigate: (route) => {
      router.push(appRouteToHref(route));
    },
    onSignOut: signOut,
    events,
    eventsLoading,
    eventsError,
    refreshEvents
  };
}
