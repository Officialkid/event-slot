"use client"

import { useMemo, useState } from "react"
import { SUPPORTED_LANGUAGES, type SupportedLanguageCode } from "@/lib/i18n/languages"

type TranslationState = "idle" | "loading" | "ready" | "error"

type Props = {
  eventSlug: string
  description: string
  onTranslated?: (translation: PublicEventTranslation) => void
  onShowOriginal?: () => void
}

export type PublicEventTranslation = {
  targetLanguage: SupportedLanguageCode
  title?: string
  description?: string
  location?: string
  entryFeeLabel?: string
  organizerName?: string
  questions?: { id: string; label: string; options?: string[] }[]
}

const CAPTION_LIMIT = 260
const COLLAPSED_LINE_LIMIT = 4

function getDescriptionCopy(language: SupportedLanguageCode) {
  const copy = {
    en: { readMore: "Read more", showLess: "Show less", translate: "Translate", showOriginal: "Show original", translateTo: "Translate to", apply: "Apply", translating: "Translating..." },
    sw: { readMore: "Soma zaidi", showLess: "Onyesha kidogo", translate: "Tafsiri", showOriginal: "Onyesha asili", translateTo: "Tafsiri kwa", apply: "Tekeleza", translating: "Inatafsiri..." },
    fr: { readMore: "Lire plus", showLess: "Afficher moins", translate: "Traduire", showOriginal: "Afficher l'original", translateTo: "Traduire en", apply: "Appliquer", translating: "Traduction..." },
    pt: { readMore: "Ler mais", showLess: "Mostrar menos", translate: "Traduzir", showOriginal: "Mostrar original", translateTo: "Traduzir para", apply: "Aplicar", translating: "Traduzindo..." },
    es: { readMore: "Leer mas", showLess: "Mostrar menos", translate: "Traducir", showOriginal: "Mostrar original", translateTo: "Traducir a", apply: "Aplicar", translating: "Traduciendo..." },
    de: { readMore: "Mehr lesen", showLess: "Weniger anzeigen", translate: "Uebersetzen", showOriginal: "Original anzeigen", translateTo: "Uebersetzen nach", apply: "Anwenden", translating: "Wird uebersetzt..." },
    ar: { readMore: "اقرأ المزيد", showLess: "عرض أقل", translate: "ترجمة", showOriginal: "عرض الأصل", translateTo: "ترجم إلى", apply: "تطبيق", translating: "جارٍ الترجمة..." },
    zh: { readMore: "阅读更多", showLess: "收起", translate: "翻译", showOriginal: "显示原文", translateTo: "翻译为", apply: "应用", translating: "正在翻译..." },
  } satisfies Record<SupportedLanguageCode, Record<string, string>>
  return copy[language] ?? copy.en
}

function hasLongContent(value: string) {
  return value.length > CAPTION_LIMIT || value.split(/\r?\n/).length > COLLAPSED_LINE_LIMIT
}

function buildCaption(value: string) {
  if (value.length <= CAPTION_LIMIT) return value
  return `${value.slice(0, CAPTION_LIMIT).trimEnd()}...`
}

export function EventDescriptionBlock({ eventSlug, description, onTranslated, onShowOriginal }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [showLanguagePicker, setShowLanguagePicker] = useState(false)
  const [targetLanguage, setTargetLanguage] = useState<SupportedLanguageCode>("sw")
  const [translatedText, setTranslatedText] = useState("")
  const [translationState, setTranslationState] = useState<TranslationState>("idle")
  const [translationError, setTranslationError] = useState("")

  const isLong = useMemo(() => hasLongContent(description), [description])
  const visibleText = translatedText || (expanded || !isLong ? description : buildCaption(description))
  const copy = getDescriptionCopy(targetLanguage)

  async function translateDescription(language: SupportedLanguageCode) {
    setTargetLanguage(language)
    setTranslationState("loading")
    setTranslationError("")

    try {
      const response = await fetch(`/api/events/${encodeURIComponent(eventSlug)}/translate-description`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguage: language }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok || typeof data?.translation !== "string") {
        throw new Error(data?.error ?? "Translation is not available right now.")
      }

      const publicTranslation = data.publicTranslation && typeof data.publicTranslation === "object"
        ? data.publicTranslation as PublicEventTranslation
        : null
      setTranslatedText(publicTranslation?.description || data.translation)
      if (publicTranslation) {
        onTranslated?.(publicTranslation)
        window.dispatchEvent(new CustomEvent(`eventslot:public-translation:${eventSlug}`, {
          detail: publicTranslation,
        }))
      }
      setExpanded(true)
      setTranslationState("ready")
    } catch (error) {
      setTranslationState("error")
      setTranslationError(error instanceof Error ? error.message : "Translation is not available right now.")
    }
  }

  return (
    <div className="space-y-3">
      <p style={{ fontSize: "1rem", color: "var(--text-secondary)", lineHeight: 1.75, margin: 0, whiteSpace: "pre-wrap" }}>
        {visibleText}
      </p>

      <div className="flex flex-wrap items-center gap-3 text-[0.82rem]">
        {isLong && !translatedText && (
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="font-semibold"
            style={{ color: "var(--accent)", background: "transparent", border: 0, padding: 0, cursor: "pointer" }}
          >
            {expanded ? copy.showLess : copy.readMore}
          </button>
        )}

        <button
          type="button"
          onClick={() => setShowLanguagePicker((current) => !current)}
          className="font-semibold"
          style={{ color: "var(--accent)", background: "transparent", border: 0, padding: 0, cursor: "pointer" }}
        >
          {copy.translate}
        </button>

        {translatedText && (
          <button
            type="button"
            onClick={() => {
              setTranslatedText("")
              setTranslationState("idle")
              onShowOriginal?.()
              window.dispatchEvent(new CustomEvent(`eventslot:public-translation:${eventSlug}`, {
                detail: null,
              }))
            }}
            style={{ color: "var(--text-muted)", background: "transparent", border: 0, padding: 0, cursor: "pointer" }}
          >
            {copy.showOriginal}
          </button>
        )}
      </div>

      {showLanguagePicker && (
        <div className="flex flex-wrap items-center gap-2 rounded-[14px] px-3 py-3" style={{ border: "1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)", background: "color-mix(in srgb, var(--surface) 97%, white 3%)" }}>
          <label className="text-[0.78rem] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>
            {copy.translateTo}
          </label>
          <select
            value={targetLanguage}
            onChange={(event) => void translateDescription(event.target.value as SupportedLanguageCode)}
            disabled={translationState === "loading"}
            className="rounded-full px-3 py-2 text-[0.85rem]"
            style={{ color: "var(--text-primary)", background: "var(--bg-input)", border: "1px solid color-mix(in srgb, var(--text-primary) 12%, transparent)" }}
          >
            {SUPPORTED_LANGUAGES.map((language) => (
              <option key={language.code} value={language.code}>
                {language.label} - {language.nativeLabel}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void translateDescription(targetLanguage)}
            disabled={translationState === "loading"}
            className="rounded-full px-3 py-2 text-[0.85rem] font-bold"
            style={{ color: "#0A0A0A", background: "#C8F55A", border: 0, opacity: translationState === "loading" ? 0.65 : 1 }}
          >
            {translationState === "loading" ? copy.translating : copy.apply}
          </button>
        </div>
      )}

      {translationState === "error" && (
        <p className="m-0 text-[0.8rem]" style={{ color: "#FF8A7A" }}>
          {translationError}
        </p>
      )}
    </div>
  )
}
