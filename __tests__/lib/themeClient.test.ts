import { applyTheme, resolveCurrentTheme } from "@/lib/themeClient"

describe("themeClient", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme")
    document.documentElement.removeAttribute("style")
    window.localStorage.clear()
  })

  it("defaults to dark mode when no light theme is active", () => {
    expect(resolveCurrentTheme()).toBe("dark")
  })

  it("applies and persists light mode", () => {
    applyTheme("light")

    expect(document.documentElement.getAttribute("data-theme")).toBe("light")
    expect(document.documentElement.style.background).toBe("rgb(247, 247, 242)")
    expect(document.documentElement.style.color).toBe("rgb(23, 23, 23)")
    expect(window.localStorage.getItem("eventslot-theme")).toBe("light")
    expect(resolveCurrentTheme()).toBe("light")
  })

  it("applies and persists dark mode", () => {
    applyTheme("dark")

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark")
    expect(document.documentElement.style.background).toBe("rgb(10, 10, 10)")
    expect(document.documentElement.style.color).toBe("rgb(240, 237, 230)")
    expect(window.localStorage.getItem("eventslot-theme")).toBe("dark")
    expect(resolveCurrentTheme()).toBe("dark")
  })
})
