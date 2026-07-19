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
        archived: true,
        status: true,
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
    const result = await askAIWithMeta({
      taskType: "qa",
      maxTokens: 1200,
      system: [
        "You translate public event descriptions for EventSlot attendees.",
        "Preserve the meaning, line breaks, spacing, emojis, dates, names, phone numbers, prices, and URLs.",
        "Do not add commentary, headings, markdown wrappers, or extra information.",
        "Return only the translated event description.",
      ].join(" "),
      prompt: [
        `Event title: ${event.title}`,
        `Target language: ${languageLabel}`,
        "Translate this event description exactly:",
        description,
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

    return NextResponse.json({
      translation: result.content.trim(),
      targetLanguage,
      provider: result.provider,
    })
  } catch (error) {
    console.error("[events/[slug]/translate-description] error:", error)
    return NextResponse.json({ error: "Translation is not available right now." }, { status: 500 })
  }
}
