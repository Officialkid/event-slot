export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "sw", label: "Swahili", nativeLabel: "Kiswahili" },
  { code: "fr", label: "French", nativeLabel: "Français" },
  { code: "pt", label: "Portuguese", nativeLabel: "Português" },
  { code: "ar", label: "Arabic", nativeLabel: "العربية" },
  { code: "es", label: "Spanish", nativeLabel: "Español" },
  { code: "de", label: "German", nativeLabel: "Deutsch" },
  { code: "zh", label: "Chinese (Simplified)", nativeLabel: "简体中文" },
] as const

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"]

export const DEFAULT_LANGUAGE: SupportedLanguageCode = "en"

export function isSupportedLanguage(value: string | null | undefined): value is SupportedLanguageCode {
  return SUPPORTED_LANGUAGES.some((language) => language.code === value)
}

export function normalizePreferredLanguage(value: string | null | undefined): SupportedLanguageCode {
  return isSupportedLanguage(value) ? value : DEFAULT_LANGUAGE
}
