import { askAI } from './ai'
import { IEvent, IRegistration } from './generateEventReport'

export interface AIReportContent {
  eventOverview: string
  executiveSummary: string
  strengths: string
  weaknessesAndRisks: string
  audienceProfile: string
  registrationBehaviour: string
  competitivePositioning: string
  recommendations: string
  waitlistAnalysis: string
  overallScore: string
}

type ParsedAIReport = {
  eventOverview: string
  executiveSummary: string
  strengths: string
  weaknessesAndRisks: string
  audienceProfile: string
  registrationBehaviour: string
  competitivePositioning: string
  recommendations: string
  waitlistAnalysis: string
  overallScore: string
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

function safeRate(numerator: number, denominator: number): string {
  if (denominator <= 0) return 'N/A'
  return `${((numerator / denominator) * 100).toFixed(1)}%`
}

function countQuestionCoverage(regs: IRegistration[], questions: IEvent['questions']): number {
  if (!questions.length || !regs.length) return 0
  const answered = regs.reduce((sum, reg) => {
    const nonEmpty = reg.answers.filter(a => a.value && a.value.trim().length > 0).length
    return sum + nonEmpty
  }, 0)
  const total = regs.length * questions.length
  if (total === 0) return 0
  return Math.round((answered / total) * 100)
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

function buildFallbackReport({
  event,
  confirmed,
  waitlist,
}: {
  event: IEvent
  confirmed: IRegistration[]
  waitlist: IRegistration[]
}): AIReportContent {
  const totalRegs = confirmed.length + waitlist.length
  const capacity = event.capacity ?? null
  const capacityUtilization = capacity && capacity > 0 ? safeRate(confirmed.length, capacity) : 'N/A'
  const waitlistRate = totalRegs > 0 ? safeRate(waitlist.length, totalRegs) : '0.0%'
  const peakDay = getPeakDay([...confirmed, ...waitlist])
  const questionCoverage = countQuestionCoverage(confirmed, event.questions)

  return {
    eventOverview: `"${event.title}" is structured as a ${event.location ? `${event.location}-based` : 'location-flexible'} event with ${capacity ?? 'flexible'} available capacity and a registration deadline of ${event.deadline ?? 'not explicitly set'}. The current dataset indicates ${confirmed.length} confirmed attendees and ${waitlist.length} waitlisted attendees, which implies active demand around the offer positioning. The primary objective appears to be lead capture and conversion into confirmed attendance within a fixed registration window.`,
    executiveSummary: `The event shows early traction with ${totalRegs} total registrations and a capacity utilization of ${capacityUtilization}. Demand pressure is ${waitlist.length > 0 ? `visible through a waitlist rate of ${waitlistRate}` : 'currently manageable with low waitlist pressure'}, suggesting reasonable fit between proposition and audience intent. To improve performance before event day, focus should shift to conversion optimization on the registration journey, stronger value communication above the fold, and clearer urgency framing around the closing window.`,
    strengths: `The event has a clear intent signal: people are registering, and ${waitlist.length > 0 ? 'some are willing to queue' : 'drop-off appears controlled'}. Operationally, the registration structure supports data capture and attendee tracking, which improves follow-up and post-event analysis. The setup already includes core mechanics needed for growth testing: deadline-based urgency, capacity control, and organizer-level distribution via shareable link.`,
    weaknessesAndRisks: `Primary risk is conversion leakage between page views and completed registrations, especially if event value is not communicated within the first scroll. Secondary risk is fulfillment mismatch: ${waitlist.length > 0 ? 'a growing waitlist could reduce attendee trust if promotions are delayed' : 'a low-pressure waitlist may indicate under-leveraged demand rather than true scarcity'}. There is also messaging risk if event differentiation versus alternatives is not explicit in headline and description copy.`,
    audienceProfile: `Audience signal quality is ${questionCoverage}% based on answer completeness across custom fields. Current registrant behavior suggests practical intent rather than passive curiosity, with users moving through required fields and committing to submission. The audience appears likely to respond to clear outcomes, operational use cases, and proof of execution quality, so messaging should prioritize concrete attendee benefits over generic platform claims.`,
    registrationBehaviour: `Registration momentum peaks around ${peakDay !== 'N/A' ? peakDay : 'the latest observed registration window'}, indicating clustered decision timing. This pattern typically suggests that reminder timing and social proof can materially affect final conversion in the last 24-72 hours before deadline. Operationally, this is a favorable pattern for targeted nudges: organizer reminders, scarcity updates, and concise value-led follow-up should raise confirmed attendance without major acquisition spend.`,
    competitivePositioning: `In a crowded events landscape, this event is strongest when positioned as execution-focused rather than informationally generic. Relative advantage is operational clarity: structured registration, controlled capacity, and measurable attendee pipeline. To outperform comparable events, messaging should explicitly communicate outcomes attendees will achieve and why this specific session is a better use of time than alternative webinars, meetups, or self-study options.`,
    recommendations: `First, rewrite the top section to state one sharp promise, one concrete outcome, and one urgency trigger in the opening view. Second, run a short conversion sprint: simplify optional inputs, tighten section hierarchy, and add social proof or expected value statements near the CTA. Third, if waitlist grows, create a rapid promotion protocol (within hours, not days) and communicate expected response windows. Fourth, add a post-registration nurture sequence with calendar reminder + one high-value pre-read to reduce no-show risk and increase perceived professionalism.`,
    waitlistAnalysis: `Waitlist pressure currently sits at ${waitlistRate}. ${waitlist.length > 0 ? 'This is a positive demand indicator, but only if promotion handling is fast and transparent.' : 'Even without a large waitlist, monitoring this metric remains useful for dynamic capacity decisions and demand forecasting.'} If conversion from waitlist to confirmed is delayed, demand intent can decay quickly, so the organizer should define an explicit waitlist promotion cadence and communication SLA.`,
    overallScore: `7.5/10 — The event has solid structural foundations and meaningful demand indicators, but conversion storytelling and pre-event optimization still offer clear upside.`,
  }
}

function parseJsonReport(raw: string): ParsedAIReport | null {
  const cleaned = raw.replace(/```json|```/gi, '').trim()
  try {
    const parsed = JSON.parse(cleaned) as Partial<ParsedAIReport>
    const required: Array<keyof ParsedAIReport> = [
      'eventOverview',
      'executiveSummary',
      'strengths',
      'weaknessesAndRisks',
      'audienceProfile',
      'registrationBehaviour',
      'competitivePositioning',
      'recommendations',
      'waitlistAnalysis',
      'overallScore',
    ]
    const hasAll = required.every(key => typeof parsed[key] === 'string' && String(parsed[key]).trim().length > 0)
    if (!hasAll) return null
    return parsed as ParsedAIReport
  } catch {
    return null
  }
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
  const sys = `You are Claude acting as a senior event strategy consultant.
Produce a detailed, honest, commercially-minded report that reads like advisory work prepared for a paying client.
Avoid generic filler. Use the provided evidence only and acknowledge uncertainty when data is missing.
Target total output length: 600-1000 words across sections.
Return ONLY valid JSON with the exact keys requested.`

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
  const capacityUtilization = event.capacity && event.capacity > 0 ? safeRate(event.confirmedCount, event.capacity) : 'N/A'
  const waitlistRate = allRegs.length > 0 ? safeRate(waitlist.length, allRegs.length) : '0.0%'
  const questionCoverage = countQuestionCoverage(confirmed, event.questions)

  const prompt = `${eventContext}

Derived metrics:
- Total registrations: ${allRegs.length}
- Capacity utilization: ${capacityUtilization}
- Waitlist rate: ${waitlistRate}
- Peak registration day: ${peakDay}
- Registration timeline: ${dayEntries || 'N/A'}
- Custom-question response coverage: ${questionCoverage}%

Registrant answer intelligence:
${answersSummary}

Return JSON exactly in this shape:
{
  "eventOverview": "...",
  "executiveSummary": "...",
  "strengths": "...",
  "weaknessesAndRisks": "...",
  "audienceProfile": "...",
  "registrationBehaviour": "...",
  "competitivePositioning": "...",
  "recommendations": "...",
  "waitlistAnalysis": "...",
  "overallScore": "X/10 — justification"
}

Section guidance:
- eventOverview: define event intent, audience, and setup quality.
- executiveSummary: high-level performance diagnosis.
- strengths: what is working and why.
- weaknessesAndRisks: critical risks, warning signals, failure points.
- audienceProfile: who registered and behavior signals from available data.
- registrationBehaviour: funnel/timing patterns and likely causes.
- competitivePositioning: differentiation versus similar events.
- recommendations: specific operator actions to increase attendance/revenue.
- waitlistAnalysis: demand quality and what to do next.
- overallScore: numeric score with rationale.

Write with consultant tone. No markdown. No bullet lists. Keep it precise and evidence-linked.`

  try {
    const raw = await askAI({
      system: sys,
      prompt,
      taskType: 'report',
      maxTokens: 2200,
    })

    if (!raw) {
      return buildFallbackReport({ event, confirmed, waitlist })
    }

    const parsed = parseJsonReport(raw)
    if (!parsed) {
      return buildFallbackReport({ event, confirmed, waitlist })
    }

    return parsed
  } catch {
    return buildFallbackReport({ event, confirmed, waitlist })
  }
}
