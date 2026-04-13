import { askClaude } from "./claude"

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

export async function generateInsightCards(
  event: InsightEvent,
  analytics: InsightAnalytics
): Promise<InsightCard[]> {
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
    const raw = await askClaude({ system, prompt, maxTokens: 400 })
    const cleaned = raw.replace(/```json|```/g, "").trim()
    const parsed: InsightCard[] = JSON.parse(cleaned)
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Invalid response shape")
    return parsed.slice(0, 3)
  } catch {
    return [
      {
        type: "info",
        title: "Analytics overview ready",
        body: `Your event has ${analytics.totalRegistrations} registrations from ${analytics.totalViews} views (${analytics.conversionRate}% conversion).`,
      },
    ]
  }
}
