import { askAIWithMeta, AIProviderStatus } from "./ai"

export interface InsightCard {
  type: "success" | "warning" | "tip" | "info"
  title: string
  body: string
}

interface InsightAnalytics {
  totalViews: number
  totalRegistrations: number
  conversionRate: number
  confirmedCount: number
  waitlistCount: number
  waitlistConversionRate: number
  peakDay: string | null
  peakHour: number | null
}

interface InsightEvent {
  title: string
  capacity: number | null
  eventDate: string | null
  location: string | null
  daysUntilEvent: number | null
}

export interface InsightGenerationResult {
  cards: InsightCard[]
  source: "ai" | "fallback"
  provider: string | null
  message?: string
  providerStatus: AIProviderStatus[]
  retryRecommended: boolean
}

function buildFallbackCards(analytics: InsightAnalytics): InsightCard[] {
  const waitlistPressure = analytics.waitlistCount > 0 && analytics.confirmedCount > 0
  const lowConversion = analytics.totalViews >= 20 && analytics.conversionRate < 10

  return [
    {
      type: analytics.conversionRate >= 20 ? "success" : "info",
      title: analytics.conversionRate >= 20 ? "Strong conversion trend" : "Conversion baseline",
      body: `You have ${analytics.totalRegistrations} registrations from ${analytics.totalViews} views (${analytics.conversionRate}% conversion).`,
    },
    {
      type: waitlistPressure ? "warning" : "tip",
      title: waitlistPressure ? "Waitlist pressure detected" : "Capacity headroom available",
      body: waitlistPressure
        ? `${analytics.waitlistCount} attendees are on the waitlist. Consider increasing capacity or adding a second session.`
        : `Waitlist is currently low (${analytics.waitlistCount}). Keep promoting while the event is still open.`,
    },
    {
      type: "tip",
      title: lowConversion ? "Improve page conversion" : "Maintain momentum",
      body: lowConversion
        ? "Your view-to-registration conversion is low. Clarify value in the first screen and reduce optional form friction."
        : "Keep traffic active around your peak registration windows to sustain current signup pace.",
    },
  ]
}

function parseInsightCards(raw: string): InsightCard[] {
  const cleaned = raw.replace(/```json|```/g, "").trim()
  const parsed = JSON.parse(cleaned)
  if (!Array.isArray(parsed)) {
    throw new Error("Invalid response shape")
  }

  const validTypes: Array<InsightCard["type"]> = ["success", "warning", "tip", "info"]
  const normalized = parsed
    .map((item): InsightCard | null => {
      if (!item || typeof item !== "object") return null
      const title = String((item as { title?: unknown }).title ?? "").trim()
      const body = String((item as { body?: unknown }).body ?? "").trim()
      const typeRaw = String((item as { type?: unknown }).type ?? "info").toLowerCase()
      const type = validTypes.includes(typeRaw as InsightCard["type"])
        ? (typeRaw as InsightCard["type"])
        : "info"
      if (!title || !body) return null
      return { type, title, body }
    })
    .filter((item): item is InsightCard => Boolean(item))

  if (normalized.length === 0) {
    throw new Error("No valid insight cards returned")
  }

  return normalized.slice(0, 3)
}

export async function generateInsightCards(
  event: InsightEvent,
  analytics: InsightAnalytics
): Promise<InsightGenerationResult> {
  const system = `You are an expert event analytics advisor. Generate exactly 3 insight cards based on the event data provided.
Return ONLY a valid JSON array of 3 objects with this shape:
[{"type":"success"|"warning"|"tip"|"info","title":"...","body":"..."}]
- "success": a positive result or milestone
- "warning": something worth monitoring or addressing
- "tip": an actionable recommendation
- "info": a neutral contextual observation
Keep each title under 8 words. Keep each body 1-2 sentences, practical and specific.
Do not include any markdown, code fences, or explanation outside the JSON array.`

  const prompt = `Event: "${event.title}"
Capacity: ${event.capacity ?? "unlimited"}
Event date: ${event.eventDate ?? "TBD"}
Days until event: ${event.daysUntilEvent !== null ? event.daysUntilEvent : "unknown"}
Location: ${event.location ?? "unspecified"}

Analytics:
- Total views: ${analytics.totalViews}
- Total registrations: ${analytics.totalRegistrations}
- Conversion rate (views → registrations): ${analytics.conversionRate}%
- Confirmed registrations: ${analytics.confirmedCount}
- On waitlist: ${analytics.waitlistCount}
- Waitlist conversion rate: ${analytics.waitlistConversionRate}%
- Peak registration day: ${analytics.peakDay ?? "unknown"}
- Peak registration hour: ${analytics.peakHour !== null ? `${analytics.peakHour}:00` : "unknown"}

Generate 3 insight cards.`

  try {
    const aiResult = await askAIWithMeta({
      system,
      prompt,
      taskType: 'insights',
      maxTokens: 400,
    })
    if (!aiResult.content) {
      return {
        cards: buildFallbackCards(analytics),
        source: "fallback",
        provider: null,
        message: "AI provider is temporarily unavailable. Showing data-backed fallback insights.",
        providerStatus: aiResult.providerStatus,
        retryRecommended: aiResult.retryRecommended,
      }
    }

    const cards = parseInsightCards(aiResult.content)
    return {
      cards,
      source: "ai",
      provider: aiResult.provider,
      providerStatus: aiResult.providerStatus,
      retryRecommended: false,
    }
  } catch (error) {
    return {
      cards: buildFallbackCards(analytics),
      source: "fallback",
      provider: null,
      message: `AI parsing failed. Showing fallback insights instead. ${error instanceof Error ? error.message : ""}`.trim(),
      providerStatus: [],
      retryRecommended: true,
    }
  }
}
