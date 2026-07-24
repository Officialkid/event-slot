import Constants from "expo-constants";
import { nativeConfig } from "../config";
import { NativeRuntimeInfoItem } from "../domain/runtimeInfo";

export function buildNativeRuntimeInfo(): NativeRuntimeInfoItem[] {
  const expoConfig = Constants.expoConfig;
  const androidPackage = expoConfig?.android?.package ?? "not configured";
  const iosBundle = expoConfig?.ios?.bundleIdentifier ?? "not configured";

  return [
    {
      key: "version",
      label: "App version",
      value: expoConfig?.version ?? "unknown",
      tone: "neutral"
    },
    {
      key: "api",
      label: "API origin",
      value: nativeConfig.apiBaseUrl,
      tone: nativeConfig.apiBaseUrl === "https://www.eventsslot.com" ? "ready" : "neutral"
    },
    {
      key: "auth",
      label: "Auth mode",
      value: nativeConfig.authMode.toUpperCase(),
      tone: nativeConfig.authMode === "live" ? "ready" : "blocked"
    },
    {
      key: "uploads",
      label: "Upload writes",
      value: nativeConfig.uploadsEnabled ? "ENABLED" : "GATED",
      tone: nativeConfig.uploadsEnabled ? "ready" : "blocked"
    },
    {
      key: "push",
      label: "Push backend",
      value: nativeConfig.pushEnabled ? "ENABLED" : "GATED",
      tone: nativeConfig.pushEnabled ? "ready" : "blocked"
    },
    {
      key: "android",
      label: "Android package",
      value: androidPackage,
      tone: androidPackage.includes(".native") ? "ready" : "neutral"
    },
    {
      key: "ios",
      label: "iOS bundle",
      value: iosBundle,
      tone: iosBundle.includes(".native") ? "ready" : "neutral"
    }
  ];
}

export function getRuntimeInfoReadinessMessage(): string {
  return "Use this section when testing so screenshots and reports show the exact native version, API origin, and gated release flags.";
}
