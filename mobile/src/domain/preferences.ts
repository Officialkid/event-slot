import { NativeNotificationChannel } from "./notifications";
import { ThemeName } from "../theme";

export type NativePreferences = {
  themeName: ThemeName;
  notificationChannels: Record<NativeNotificationChannel, boolean>;
};
