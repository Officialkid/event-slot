import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { nativeConfig } from "../config";
import {
  NativeNotificationPreference,
  NativePushRegistration,
  NativePushRegistrationResult
} from "../domain/notifications";
import { NativePreferences } from "../domain/preferences";

export const defaultNotificationPreferences: NativeNotificationPreference[] = [
  {
    channel: "event-reminders",
    title: "Event reminders",
    caption: "Remind organisers and attendees before important event moments.",
    enabled: false
  },
  {
    channel: "team-invites",
    title: "Team invites",
    caption: "Notify invited event team members when they receive access.",
    enabled: false
  },
  {
    channel: "waitlist-promotions",
    title: "Waitlist promotions",
    caption: "Alert attendees when they are promoted from waitlist to confirmed.",
    enabled: false
  },
  {
    channel: "tester-updates",
    title: "Tester updates",
    caption: "Notify early testers when a new native build is ready.",
    enabled: false
  }
];

export function getPushReadinessMessage(): string {
  if (!nativeConfig.pushEnabled) {
    return "Native push permission and Expo token capture are wired, but backend token registration remains disabled until the native push API is reviewed.";
  }

  return "Push notifications are enabled for integration testing.";
}

export function buildNotificationPreferences(preferences: NativePreferences): NativeNotificationPreference[] {
  return defaultNotificationPreferences.map((preference) => ({
    ...preference,
    enabled: Boolean(preferences.notificationChannels[preference.channel])
  }));
}

export async function prepareNativePushRegistration(userEmail: string): Promise<NativePushRegistrationResult> {
  if (!Device.isDevice) {
    return {
      status: "unavailable",
      message: "Push notifications require a physical Android or iOS device."
    };
  }

  const existingPermission = await Notifications.getPermissionsAsync();
  const finalPermission = existingPermission.granted
    ? existingPermission
    : await Notifications.requestPermissionsAsync();

  if (!finalPermission.granted) {
    return {
      status: "denied",
      message: "Notification permission was not granted. You can still use EventSlot manually."
    };
  }

  await configureAndroidNotificationChannel();

  const projectId = getExpoProjectId();
  const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);

  return {
    status: "registered-local",
    registration: {
      deviceId: Device.osBuildId ?? Device.modelId ?? "unknown-device",
      deviceName: Device.deviceName ?? Device.modelName ?? null,
      experienceId: Constants.expoConfig?.slug ?? null,
      platform: Platform.OS === "ios" ? "ios" : "android",
      pushToken: token.data,
      userEmail
    },
    message: nativeConfig.pushEnabled
      ? "Expo push token captured and ready for backend registration."
      : "Expo push token captured locally. Backend registration is still disabled for release safety."
  };
}

export async function registerPushToken(_registration: NativePushRegistration): Promise<never> {
  throw new Error("Backend native push registration is not enabled yet.");
}

async function configureAndroidNotificationChannel() {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync("eventslot-default", {
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: "#B9FF3B",
    name: "EventSlot updates",
    vibrationPattern: [0, 250, 250, 250]
  });
}

function getExpoProjectId(): string | undefined {
  const easProjectId = Constants.easConfig?.projectId;
  const extraProjectId = Constants.expoConfig?.extra?.eas?.projectId;

  return typeof easProjectId === "string"
    ? easProjectId
    : typeof extraProjectId === "string"
      ? extraProjectId
      : undefined;
}
