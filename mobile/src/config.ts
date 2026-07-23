import type { NativeAuthMode } from "./api/contracts";

const DEFAULT_API_BASE_URL = "https://www.eventsslot.com";

function cleanBaseUrl(value: string | undefined): string {
  const trimmed = value?.trim();

  if (!trimmed) {
    return DEFAULT_API_BASE_URL;
  }

  return trimmed.replace(/\/+$/, "");
}

function getAuthMode(value: string | undefined): NativeAuthMode {
  return value === "live" ? "live" : "demo";
}

export const nativeConfig = {
  apiBaseUrl: cleanBaseUrl(process.env.EXPO_PUBLIC_EVENTSSLOT_API_BASE_URL),
  authMode: getAuthMode(process.env.EXPO_PUBLIC_EVENTSSLOT_AUTH_MODE),
  uploadsEnabled: process.env.EXPO_PUBLIC_EVENTSSLOT_UPLOADS_ENABLED === "true"
};

export type NativeConfig = typeof nativeConfig;
