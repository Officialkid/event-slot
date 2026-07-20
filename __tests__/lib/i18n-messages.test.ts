import { SUPPORTED_LANGUAGES } from "@/lib/i18n/languages"
import {
  I18N_MESSAGES,
  I18N_MESSAGE_KEYS,
  getI18nMessage,
  getMissingI18nLanguages,
} from "@/lib/i18n/messages"

describe("i18n message foundation", () => {
  it("defines message dictionaries for every supported launch language", () => {
    expect(getMissingI18nLanguages()).toEqual([])

    for (const language of SUPPORTED_LANGUAGES) {
      expect(I18N_MESSAGES).toHaveProperty(language.code)
    }
  })

  it("keeps every launch language complete for the shared message keys", () => {
    for (const language of SUPPORTED_LANGUAGES) {
      for (const key of I18N_MESSAGE_KEYS) {
        expect(I18N_MESSAGES[language.code][key]).toEqual(expect.any(String))
        expect(I18N_MESSAGES[language.code][key].trim().length).toBeGreaterThan(0)
      }
    }
  })

  it("falls back to English when an unsupported language is requested", () => {
    expect(getI18nMessage("unknown", "createEvent")).toBe("Create Event")
  })

  it("returns translated strings for languages that already have approved copy", () => {
    expect(getI18nMessage("sw", "createEvent")).toBe("Unda Tukio")
    expect(getI18nMessage("fr", "dashboard")).toBe("Tableau de bord")
  })
})
