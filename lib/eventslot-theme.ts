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
    activeTab: "rgba(200, 245, 90, 0.14)",
    input: "#0A0A0A",
    border: "#27272A",
    text: "#FFFFFF",
    secondary: "#A1A1AA",
    muted: "#52525B",
    greenPanel: "#17301F",
    avatar: "rgba(255, 255, 255, 0.12)",
    accentSoft: "rgba(200,245,90,0.1)"
  },
  light: {
    ...shared,
    page: "#F7F7F2",
    surface: "#FFFFFF",
    elevated: "#F0F4E8",
    hero: "#FFFFFF",
    nav: "rgba(255, 255, 255, 0.94)",
    activeTab: "rgba(97, 124, 24, 0.10)",
    input: "#FFFFFF",
    border: "rgba(10, 10, 10, 0.10)",
    text: "#171717",
    secondary: "#505851",
    muted: "#6A7169",
    greenPanel: "#2F774F",
    avatar: "rgba(255, 255, 255, 0.24)",
    accentSoft: "rgba(200,245,90,0.18)"
  }
} as const;

export function getEventSlotTheme(mode: EventSlotThemeMode) {
  return eventslotTheme[mode];
}
