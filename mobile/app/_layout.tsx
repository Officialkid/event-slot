import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { NativeAppProvider, useNativeApp } from "../src/providers/NativeAppProvider";
import { appRouteToHref } from "../src/router/legacyRouteAdapter";
import { getRouteFromNotificationResponse } from "../src/services/notificationRouting";

function AppLayout() {
  const { session } = useNativeApp();
  const router = useRouter();

  useEffect(() => {
    if (!session) {
      return;
    }

    let mounted = true;

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!mounted || !response) {
          return;
        }

        const route = getRouteFromNotificationResponse(response);
        if (route) {
          router.push(appRouteToHref(route));
        }
      })
      .catch(() => {});

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = getRouteFromNotificationResponse(response);
      if (route) {
        router.push(appRouteToHref(route));
      }
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [router, session]);

  return (
    <>
      <StatusBar style="light" backgroundColor="#0A0A0A" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0A0A0A" } }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <NativeAppProvider>
      <AppLayout />
    </NativeAppProvider>
  );
}
