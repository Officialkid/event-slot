import { NextRequest, NextResponse } from "next/server"
import { askAIWithMeta } from "@/lib/ai"
import { SUPPORTED_LANGUAGES, isSupportedLanguage } from "@/lib/i18n/languages"
import prisma from "@/lib/prisma"

type Props = {
  params: Promise<{ slug: string }>
}

const languageLabelByCode = Object.fromEntries(
  SUPPORTED_LANGUAGES.map((language) => [language.code, `${language.label} (${language.nativeLabel})`])
) as Record<string, string>

function safeParseTranslationPayload(content: string) {
  try {
    const cleaned = content.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "")
    const parsed = JSON.parse(cleaned) as {
      title?: unknown
      description?: unknown
      location?: unknown
      entryFeeLabel?: unknown
      organizerName?: unknown
      questions?: unknown
    }
    const questions = Array.isArray(parsed.questions)
      ? parsed.questions
          .map((question) => {
            if (!question || typeof question !== "object") return null
            const entry = question as { id?: unknown; label?: unknown; options?: unknown }
            return {
              id: typeof entry.id === "string" ? entry.id : "",
              label: typeof entry.label === "string" ? entry.label : "",
              options: Array.isArray(entry.options) ? entry.options.filter((option): option is string => typeof option === "string") : [],
            }
          })
          .filter((question): question is { id: string; label: string; options: string[] } => Boolean(question?.id && question.label))
      : []

    return {
      title: typeof parsed.title === "string" ? parsed.title.trim() : "",
      description: typeof parsed.description === "string" ? parsed.description.trim() : "",
      location: typeof parsed.location === "string" ? parsed.location.trim() : "",
      entryFeeLabel: typeof parsed.entryFeeLabel === "string" ? parsed.entryFeeLabel.trim() : "",
      organizerName: typeof parsed.organizerName === "string" ? parsed.organizerName.trim() : "",
      questions,
    }
  } catch {
    return null
  }
}

export async function POST(req: NextRequest, props: Props) {
  const { slug } = await props.params

  try {
    const body = await req.json().catch(() => null)
    const targetLanguage = typeof body?.targetLanguage === "string" ? body.targetLanguage : ""

    if (!isSupportedLanguage(targetLanguage)) {
      return NextResponse.json({ error: "Choose a supported language." }, { status: 400 })
    }

    const event = await prisma.event.findUnique({
      where: { slug },
      select: {
        title: true,
        description: true,
        location: true,
        entryFeeLabel: true,
        questions: true,
        archived: true,
        status: true,
        organizer: { select: { name: true } },
      },
    })

    if (!event || event.archived || event.status !== "active") {
      return NextResponse.json({ error: "Event not found." }, { status: 404 })
    }

    const description = event.description?.trim()
    if (!description) {
      return NextResponse.json({ error: "This event has no description to translate." }, { status: 400 })
    }

    const languageLabel = languageLabelByCode[targetLanguage]
    const questions = Array.isArray(event.questions)
      ? event.questions
          .filter((question): question is { id: string; label: string; options?: string[] } => {
            if (!question || typeof question !== "object") return false
            const entry = question as { id?: unknown; label?: unknown }
            return typeof entry.id === "string" && typeof entry.label === "string"
          })
          .map((question) => ({
            id: question.id,
            label: question.label,
            options: Array.isArray(question.options) ? question.options.filter((option): option is string => typeof option === "string") : [],
          }))
      : []
    const result = await askAIWithMeta({
      taskType: "qa",
      maxTokens: 3000,
      system: [
        "You translate public event content for EventSlot attendees.",
        "Preserve the meaning, line breaks, spacing, emojis, dates, names, phone numbers, prices, and URLs.",
        "Do not invent facts, change prices, change dates, change phone numbers, or add extra information.",
        "Return only valid minified JSON using this exact shape:",
        '{"title":"","description":"","location":"","entryFeeLabel":"","organizerName":"","questions":[{"id":"","label":"","options":[""]}]}',
      ].join(" "),
      prompt: [
        `Event title: ${event.title}`,
        `Target language: ${languageLabel}`,
        "Translate this public event payload. Preserve question ids exactly and preserve option order.",
        JSON.stringify({
          title: event.title,
          description,
          location: event.location ?? "",
          entryFeeLabel: event.entryFeeLabel ?? "",
          organizerName: event.organizer?.name ?? "",
          questions,
        }),
      ].join("\n\n"),
    })

    if (!result.content) {
      return NextResponse.json(
        {
          error: "Translation is not available right now.",
          retryRecommended: result.retryRecommended,
          providerStatus: result.providerStatus,
        },
        { status: 503 }
      )
    }

    const parsedTranslation = safeParseTranslationPayload(result.content)
    const translation = parsedTranslation?.description || result.content.trim()

    return NextResponse.json({
      translation,
      publicTranslation: parsedTranslation
        ? {
            ...parsedTranslation,
            targetLanguage,
          }
        : null,
      targetLanguage,
      provider: result.provider,
    })
  } catch (error) {
    console.error("[events/[slug]/translate-description] error:", error)
    return NextResponse.json({ error: "Translation is not available right now." }, { status: 500 })
  }
}
