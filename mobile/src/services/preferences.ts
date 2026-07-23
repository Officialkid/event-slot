import { NativeNotificationChannel } from "../domain/notifications";
import { NativePreferences } from "../domain/preferences";
import { ThemeName } from "../theme";

export const defaultNativePreferences: NativePreferences = {
  themeName: "dark",
  notificationChannels: {
    "event-reminders": false,
    "team-invites": false,
    "waitlist-promotions": false,
    "tester-updates": false
  }
};

let storedPreferences: NativePreferences | null = null;

export async function loadNativePreferences(): Promise<NativePreferences> {
  return storedPreferences ? clonePreferences(storedPreferences) : clonePreferences(defaultNativePreferences);
}

export async function saveNativePreferences(preferences: NativePreferences): Promise<void> {
  storedPreferences = clonePreferences(preferences);
}

export async function saveThemePreference(themeName: ThemeName): Promise<NativePreferences> {
  const preferences = await loadNativePreferences();
  const nextPreferences = {
    ...preferences,
    themeName
  };

  await saveNativePreferences(nextPreferences);
  return nextPreferences;
}

export async function saveNotificationPreference(
  channel: NativeNotificationChannel,
  enabled: boolean
): Promise<NativePreferences> {
  const preferences = await loadNativePreferences();
  const nextPreferences = {
    ...preferences,
    notificationChannels: {
      ...preferences.notificationChannels,
      [channel]: enabled
    }
  };

  await saveNativePreferences(nextPreferences);
  return nextPreferences;
}

function clonePreferences(preferences: NativePreferences): NativePreferences {
  return {
    themeName: preferences.themeName,
    notificationChannels: { ...preferences.notificationChannels }
  };
}
