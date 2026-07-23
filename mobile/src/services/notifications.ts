import { nativeConfig } from "../config";
import { NativeNotificationPreference, NativePushRegistration } from "../domain/notifications";
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
    return "Push notifications are disabled until permission prompts, Expo push tokens, and backend registration are reviewed.";
  }

  return "Push notifications are enabled for integration testing.";
}

export function buildNotificationPreferences(preferences: NativePreferences): NativeNotificationPreference[] {
  return defaultNotificationPreferences.map((preference) => ({
    ...preference,
    enabled: Boolean(preferences.notificationChannels[preference.channel])
  }));
}

export async function registerPushToken(_registration: NativePushRegistration): Promise<never> {
  throw new Error("Native push registration is not enabled yet.");
}
