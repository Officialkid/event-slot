export type NativeNotificationChannel = "event-reminders" | "team-invites" | "waitlist-promotions" | "tester-updates";

export type NativeNotificationPreference = {
  channel: NativeNotificationChannel;
  title: string;
  caption: string;
  enabled: boolean;
};

export type NativePushRegistration = {
  deviceId: string;
  deviceName?: string | null;
  experienceId?: string | null;
  pushToken: string;
  platform: "android" | "ios";
  userEmail: string;
};

export type NativePushRegistrationResult =
  | {
      status: "registered-local";
      registration: NativePushRegistration;
      message: string;
    }
  | {
      status: "denied" | "unavailable" | "error";
      message: string;
    };

export type NativePushBackendRegistrationResult =
  | {
      status: "registered-backend";
      message: string;
    }
  | {
      status: "blocked" | "error";
      message: string;
    };
