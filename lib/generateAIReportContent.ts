import { askClaude } from './claude'
import { IEvent, IRegistration } from './generateEventReport'

export interface AIReportContent {
  executiveSummary: string
  audienceProfile: string
  registrationBehaviour: string
  recommendations: string
  waitlistAnalysis: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupByDay(regs: IRegistration[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const r of regs) {
    const day = r.submittedAt.slice(0, 10)
    counts[day] = (counts[day] ?? 0) + 1
  }
  return counts
}

function getPeakDay(regs: IRegistration[]): string {
  const byDay = groupByDay(regs)
  const entries = Object.entries(byDay)
  if (!entries.length) return 'N/A'
  return entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0]
}

function summariseAnswers(regs: IRegistration[], questions: IEvent['questions']): string {
  if (!questions.length || !regs.length) return 'No custom questions answered.'
  const lines: string[] = []
  for (const q of questions.slice(0, 5)) {
    const vals = regs
      .flatMap(r => r.answers.filter(a => a.questionId === q.id).map(a => a.value))
      .filter(Boolean)
    if (!vals.length) continue
    if (vals.length <= 6) {
      lines.push(`${q.label}: ${vals.join(', ')}`)
    } else {
      const freq: Record<string, number> = {}
      for (const v of vals) freq[v] = (freq[v] ?? 0) + 1
      const top3 = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([v, n]) => `"${v}" (${n})`)
        .join(', ')
      lines.push(`${q.label}: top answers — ${top3}`)
    }
  }
  return lines.join('\n') || 'No meaningful answers recorded.'
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function generateAIReportContent({
  event,
  confirmed,
  waitlist,
}: {
  event: IEvent
  confirmed: IRegistration[]
  waitlist: IRegistration[]
}): Promise<AIReportContent> {
  const sys = 'You are an expert event analyst. Write in clear, professional prose. Be concise — 2–4 sentences maximum per response. Do not use bullet points or markdown formatting.'

  const eventContext = `Event: "${event.title}"
Date: ${event.eventDate ?? 'TBD'}
Location: ${event.location ?? 'TBD'}
Capacity: ${event.capacity ?? 'Unlimited'}
Confirmed: ${event.confirmedCount}
Waitlist: ${event.waitlistCount}
Registrations opened: ${event.createdAt.slice(0, 10)}
Deadline: ${event.deadline ?? 'None'}`

  const allRegs = [...confirmed, ...waitlist]
  const peakDay = getPeakDay(allRegs)
  const byDay = groupByDay(allRegs)
  const dayEntries = Object.entries(byDay)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([d, n]) => `${d}: ${n}`)
    .join(', ')
  const answersSummary = summariseAnswers(confirmed, event.questions)

  const [executiveSummary, audienceProfile, registrationBehaviour, recommendations, waitlistAnalysis] =
    await Promise.all([
      askClaude({
        system: sys,
        prompt: `${eventContext}\n\nWrite a concise executive summary of this event's registration performance.`,
        maxTokens: 200,
      }),
      askClaude({
        system: sys,
        prompt: `${eventContext}\n\nCustom question responses from confirmed registrants:\n${answersSummary}\n\nDescribe the audience profile based on registration data and responses.`,
        maxTokens: 200,
      }),
      askClaude({
        system: sys,
        prompt: `${eventContext}\n\nRegistrations by day: ${dayEntries || 'N/A'}\nPeak registration day: ${peakDay}\n\nAnalyse the registration behaviour pattern and what it may indicate.`,
        maxTokens: 200,
      }),
      askClaude({
        system: sys,
        prompt: `${eventContext}\n\nBased on this event's registration data, provide 2–3 actionable recommendations for the organiser to improve future events.`,
        maxTokens: 200,
      }),
      askClaude({
        system: sys,
        prompt: `${eventContext}\n\nWaitlist size: ${event.waitlistCount}. ${event.waitlistCount > 0 ? `Waitlist registrations by day: ${Object.entries(groupByDay(waitlist)).map(([d, n]) => `${d}: ${n}`).join(', ') || 'N/A'}` : ''}\n\nAnalyse the waitlist situation and what it implies about demand for this event.`,
        maxTokens: 150,
      }),
    ])

  return { executiveSummary, audienceProfile, registrationBehaviour, recommendations, waitlistAnalysis }
}
