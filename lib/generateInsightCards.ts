import { askAI } from "./ai"

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
    const raw = await askAI({
      system,
      prompt,
      taskType: 'insights',
      maxTokens: 400,
    })
    if (!raw) throw new Error('AI unavailable')
    const cleaned = raw.replace(/```json|```/g, "").trim()
    const parsed: InsightCard[] = JSON.parse(cleaned)
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Invalid response shape")
    return parsed.slice(0, 3)
  } catch {
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
}
