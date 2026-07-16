export type ThemeMode = "dark" | "light"

export function resolveCurrentTheme(): ThemeMode {
  if (typeof document === "undefined") return "dark"
  const current = document.documentElement.getAttribute("data-theme")
  return current === "light" ? "light" : "dark"
}

export function applyTheme(nextTheme: ThemeMode) {
  if (typeof document === "undefined") return

  document.documentElement.setAttribute("data-theme", nextTheme)
  document.documentElement.style.background = nextTheme === "light" ? "#F7F7F2" : "#0A0A0A"
  document.documentElement.style.color = nextTheme === "light" ? "#171717" : "#F0EDE6"

  if (typeof window !== "undefined") {
    window.localStorage.setItem("eventslot-theme", nextTheme)
  }
}
