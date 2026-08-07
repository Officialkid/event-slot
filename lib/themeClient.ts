import { getEventSlotTheme, type EventSlotThemeMode } from "@/lib/eventslot-theme"

export type ThemeMode = EventSlotThemeMode

export function resolveCurrentTheme(): ThemeMode {
  if (typeof document === "undefined") return "dark"
  const current = document.documentElement.getAttribute("data-theme")
  return current === "light" ? "light" : "dark"
}

export function applyTheme(nextTheme: ThemeMode) {
  if (typeof document === "undefined") return
  const palette = getEventSlotTheme(nextTheme)

  document.documentElement.setAttribute("data-theme", nextTheme)
  document.documentElement.style.background = palette.page
  document.documentElement.style.color = palette.text

  if (typeof window !== "undefined") {
    window.localStorage.setItem("eventslot-theme", nextTheme)
  }
}
