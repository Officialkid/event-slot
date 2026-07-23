export type NativeNotificationChannel = "event-reminders" | "team-invites" | "waitlist-promotions" | "tester-updates";

export type NativeNotificationPreference = {
  channel: NativeNotificationChannel;
  title: string;
  caption: string;
  enabled: boolean;
};

export type NativePushRegistration = {
  deviceId: string;
  pushToken: string;
  platform: "android" | "ios";
  userEmail: string;
};
