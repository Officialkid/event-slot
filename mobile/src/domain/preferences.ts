import { NativeNotificationChannel } from "./notifications";

export type NativePreferences = {
  onboardingCompleted: boolean;
  preferredLanguage: string;
  themeName: "dark";
  notificationChannels: Record<NativeNotificationChannel, boolean>;
};
