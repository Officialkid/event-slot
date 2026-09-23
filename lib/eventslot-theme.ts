export type EventSlotThemeMode = "dark" | "light";

const shared = {
  accent: "#C8F55A",
  accentHover: "#B8E040",
  success: "#4ADE80",
  warning: "#FACC15",
  error: "#F87171"
} as const;

export const eventslotTheme = {
  dark: {
    ...shared,
    page: "#0A0A0A",
    surface: "#111111",
    elevated: "#1A1A1A",
    hero: "#111111",
    nav: "rgba(10, 10, 10, 0.94)",
    activeTab: "rgba(34, 197, 94, 0.14)",
    input: "#0A0A0A",
    border: "#27272A",
    text: "#FFFFFF",
    secondary: "#A1A1AA",
    muted: "#52525B",
    greenPanel: "#17301F",
    avatar: "rgba(255, 255, 255, 0.12)",
    accentSoft: "rgba(34, 197, 94, 0.12)"
  },
  light: {
    accent: "#15803D",
    accentHover: "#166534",
    success: "#15803D",
    warning: "#D97706",
    error: "#DC2626",
    page: "#F8FAFC",
    surface: "#FFFFFF",
    elevated: "#F1F5F9",
    hero: "#FFFFFF",
    nav: "rgba(255, 255, 255, 0.94)",
    activeTab: "rgba(21, 128, 61, 0.08)",
    input: "#FFFFFF",
    border: "#E2E8F0",
    text: "#0F172A",
    secondary: "#475569",
    muted: "#64748B",
    greenPanel: "#15803D",
    avatar: "rgba(21, 128, 61, 0.12)",
    accentSoft: "#DCFCE7"
  }
} as const;

export function getEventSlotTheme(mode: EventSlotThemeMode) {
  return eventslotTheme[mode];
}
