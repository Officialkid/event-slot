import { applyTheme, resolveCurrentTheme } from "@/lib/themeClient"

describe("themeClient", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme")
    document.documentElement.removeAttribute("style")
    window.localStorage.clear()
  })

  it("defaults to light mode when no dark theme is active", () => {
    expect(resolveCurrentTheme()).toBe("light")
  })

  it("applies and persists light mode", () => {
    applyTheme("light")

    expect(document.documentElement.getAttribute("data-theme")).toBe("light")
    expect(document.documentElement.style.background).toBe("rgb(248, 250, 252)")
    expect(document.documentElement.style.color).toBe("rgb(15, 23, 42)")
    expect(window.localStorage.getItem("eventslot-theme")).toBe("light")
    expect(resolveCurrentTheme()).toBe("light")
  })

  it("applies and persists dark mode", () => {
    applyTheme("dark")

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark")
    expect(document.documentElement.style.background).toBe("rgb(10, 10, 10)")
    expect(document.documentElement.style.color).toBe("rgb(255, 255, 255)")
    expect(window.localStorage.getItem("eventslot-theme")).toBe("dark")
    expect(resolveCurrentTheme()).toBe("dark")
  })
})
