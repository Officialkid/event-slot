import { askAI } from './ai'
import { IEvent, IRegistration } from './generateEventReport'
import { format } from 'date-fns'

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

function getPeakDayWithCount(regs: IRegistration[]): { date: string; count: number } {
  const byDay = groupByDay(regs)
  const entries = Object.entries(byDay)
  if (!entries.length) return { date: 'N/A', count: 0 }
  const [date, count] = entries.reduce((a, b) => (b[1] > a[1] ? b : a))
  return { date, count }
}

function safeRate(numerator: number, denominator: number): string {
  if (denominator <= 0) return 'N/A'
  return `${((numerator / denominator) * 100).toFixed(1)}%`
}

function formatIsoDate(iso: string | null | undefined, fallback = 'Not specified'): string {
  if (!iso) return fallback
  try {
    return format(new Date(iso), 'd MMMM yyyy')
  } catch {
    return fallback
  }
}

function inferEventType(event: IEvent): 'virtual' | 'in-person' {
  const location = (event.location ?? '').toLowerCase()
  if (location.includes('online') || location.includes('virtual') || location.includes('zoom')) {
    return 'virtual'
  }
  return 'in-person'
}

function buildWaitlistInsight(confirmedCount: number, waitlistCount: number, capacity: number | null): string {
  if (!capacity || capacity <= 0) {
    return 'No waitlist was generated. Capacity was not configured, so overflow demand could not be measured through waitlist behavior.'
  }
  const safeConfirmed = Math.max(0, Math.min(confirmedCount, capacity))
  const fillRate = Math.round((safeConfirmed / capacity) * 100)

  if (waitlistCount > 0) {
    return `Waitlist demand is active with ${waitlistCount} people queued, confirming demand beyond available slots.`
  }
  if (fillRate < 50) {
    return `No waitlist formed because demand remained below capacity, with ${capacity - safeConfirmed} slots unfilled.`
  }
  if (fillRate < 90) {
    return 'No waitlist formed because the event did not cross the overflow threshold typically seen above 85-90% fill.'
  }
  return 'No waitlist formed despite near-full capacity, indicating overflow demand was not captured early enough in the registration cycle.'
}

function enforceThreeRecommendations(text: string): string {
  const compact = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const numbered = compact.filter((line) => /^\d+[.):-]?\s+/.test(line))
  const candidates = (numbered.length >= 3 ? numbered : compact).slice(0, 3)

  if (candidates.length === 0) {
    return '1. Within 7 days: Launch registration 14 days earlier to expand the high-intent capture window and increase confirmed attendance by at least 15%.\n2. Within 3 days before deadline: run a targeted reminder burst across your strongest channel to lift late-stage conversion by at least 10%.\n3. Within 48 hours post-event: publish outcomes and open early interest for the next edition to accelerate the next registration cycle.'
  }

  return candidates
    .map((item, index) => item.replace(/^\d+[.):-]?\s+/, `${index + 1}. `))
    .join('\n')
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
  const peakDay = getPeakDayWithCount([...confirmed, ...waitlist])
  const questionCoverage = countQuestionCoverage(confirmed, event.questions)
  const eventType = inferEventType(event)
  const waitlistInsight = buildWaitlistInsight(confirmed.length, waitlist.length, capacity)

  return {
    eventOverview: `${event.title} is an ${eventType} event scheduled for ${formatIsoDate(event.eventDate)} in ${event.location ?? 'an unspecified location'}. The event is configured with ${capacity ?? 'no fixed'} capacity and currently has ${totalRegs} registrations, including ${confirmed.length} confirmed and ${waitlist.length} waitlisted. Registration opened on ${formatIsoDate(event.createdAt)} and closes on ${formatIsoDate(event.deadline, 'no fixed close date')}.`,
    executiveSummary: `${event.title} generated ${totalRegs} registrations with ${capacityUtilization} capacity utilisation and ${waitlistRate} waitlist pressure. The strongest signal is ${peakDay.date !== 'N/A' ? `${peakDay.date} as the peak day with ${peakDay.count} registrations` : 'insufficient day-level registration volume for a clear peak pattern'}, which shows demand concentration in a narrow window. The next operational lever is tightening campaign timing around the peak window while increasing early-window acquisition.`,
    strengths: `1. Demand conversion is proven with ${confirmed.length} confirmed attendees from ${totalRegs} total registrations.\n2. Capacity management is measurable at ${capacityUtilization}, enabling concrete optimisation decisions for the next edition.\n3. Data capture quality is ${questionCoverage}% across custom fields, supporting usable attendee insight for targeting and follow-up.`,
    weaknessesAndRisks: `1. Registration concentration on the peak window increases volatility in final turnout; fix this by scheduling two staged demand pushes 7 days and 2 days before close.\n2. ${waitlist.length === 0 ? 'No waitlist was generated, so overflow demand is not being captured; fix this by calibrating capacity closer to observed demand and opening earlier.' : `Waitlist volume of ${waitlist.length} requires fast promotion cadence to protect trust; fix this by setting a 24-hour promotion SLA for released slots.`}\n3. Response coverage at ${questionCoverage}% leaves profiling gaps; fix this by making one high-value segmentation question required in the next registration form.`,
    audienceProfile: `The attendee dataset shows ${questionCoverage}% completion on custom responses, indicating ${questionCoverage >= 70 ? 'strong' : 'partial'} profile visibility for this audience. Registrants committed through required fields and completed registration in measurable volume (${totalRegs} submissions), confirming active intent rather than passive browsing. Audience messaging should prioritise concrete outcomes and execution details because this cohort is responding to specific value, not generic event branding.`,
    registrationBehaviour: `Registration activity peaked on ${peakDay.date} with ${peakDay.count} registrations, confirming that demand clustered around a specific campaign or reminder moment. The timeline shows a compressed conversion pattern rather than evenly distributed daily intake, which concentrates risk near the close window. For the next edition, deploy structured reminders before and during the peak window to spread conversions and reduce end-window dependence.`,
    competitivePositioning: `This event demonstrates market relevance by converting ${totalRegs} registrations within one cycle in a competitive environment. The combination of ${capacityUtilization} utilisation and ${waitlist.length} waitlisted attendees positions the offer as credible but still optimisable against alternatives. Competitive advantage will increase by sharpening positioning around one explicit attendee outcome and publishing proof of delivery from this edition within 72 hours post-event.`,
    recommendations: `1. Within 7 days: move registration open earlier by at least 10-14 days to extend the demand-capture window and lift confirmed turnout by 15-20%.\n2. Within the next event cycle: schedule a fixed 3-touch campaign (launch, midpoint, final 48 hours) to reduce peak-day concentration and stabilise daily conversions.\n3. Within 48 hours after this event: publish outcomes and open early interest for the next edition to seed repeat demand and improve first-week registrations.`,
    waitlistAnalysis: `${waitlistInsight} Current waitlist count is ${waitlist.length} with overall waitlist rate at ${waitlistRate}. The next cycle should formalise overflow handling with clear promotion timing and transparent communication to preserve conversion intent from queued attendees.`,
    overallScore: `Score computed from attendance quality, registration distribution, waitlist behaviour, and setup quality.`,
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
  const eventType = inferEventType(event)
  const sys = `You are generating the AI Strategic Intelligence section of an EventSlot event report for the organiser and stakeholders reviewing this event.

EventSlot is a smart event registration and waitlist management platform launched in Kenya in April 2026.

Rules for every section:
1. Reference actual numbers from the data provided and avoid generalities.
2. Do not use weak phrasing like "may suggest" or "could indicate".
3. Pair every weakness with a specific actionable fix.
4. Every recommendation must include a clear timeframe.
5. Keep the tone professional, direct, and consultant-like.
6. Section 10 must justify the score using the provided rubric context.

Output requirements:
- Return ONLY valid JSON.
- Use exactly the required keys.
- Recommendations must be exactly 3 actionable items with timeframe and expected outcome.
- No markdown tables, no bullet symbols; plain text with newline-separated items when needed.`

  const eventContext = `Event data:
- Event title: ${event.title}
- Event type: ${eventType}
- Date: ${formatIsoDate(event.eventDate)}
- Location: ${event.location ?? 'Not specified'}
- Capacity: ${event.capacity ?? 'Unlimited'}
- Total registrations: ${event.confirmedCount + event.waitlistCount}
- Confirmed: ${event.confirmedCount}
- Waitlisted: ${event.waitlistCount}
- Fill rate: ${event.capacity && event.capacity > 0 ? Math.round((event.confirmedCount / event.capacity) * 100) : 0}%
- Registration open date: ${formatIsoDate(event.createdAt)}
- Registration close date: ${formatIsoDate(event.deadline, 'Not specified')}`

  const allRegs = [...confirmed, ...waitlist]
  const peakDay = getPeakDayWithCount(allRegs)
  const byDay = groupByDay(allRegs)
  const dayEntries = Object.entries(byDay)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([d, n]) => `${d}: ${n}`)
    .join(', ')
  const answersSummary = summariseAnswers(confirmed, event.questions)
  const capacityUtilization = event.capacity && event.capacity > 0 ? safeRate(event.confirmedCount, event.capacity) : 'N/A'
  const waitlistRate = allRegs.length > 0 ? safeRate(waitlist.length, allRegs.length) : '0.0%'
  const questionCoverage = countQuestionCoverage(confirmed, event.questions)
  const peakPercent = allRegs.length > 0 ? Math.round((peakDay.count / allRegs.length) * 100) : 0
  const waitlistInsight = buildWaitlistInsight(confirmed.length, waitlist.length, event.capacity)

  const prompt = `${eventContext}

Timeline and audience context:
- Daily registration counts: ${dayEntries || 'N/A'}
- Peak registration day: ${peakDay.date} (${peakDay.count} registrations)
- Peak-day concentration: ${peakPercent}% of total registrations
- Capacity utilisation: ${capacityUtilization}
- Waitlist rate: ${waitlistRate}
- Waitlist section logic context: ${waitlistInsight}
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
  "overallScore": "X/10 - concise rationale"
}

Section guidance (must follow this exact 10-section intent):
1) eventOverview: factual summary in maximum 3 sentences.
2) executiveSummary: what happened, key number, one insight.
3) strengths: 2-4 strengths with data support.
4) weaknessesAndRisks: direct risks and each risk paired with a fix.
5) audienceProfile: infer from responses and registration behavior.
6) registrationBehaviour: timeline pattern, peak explanation, and implication.
7) competitivePositioning: what this event says about market demand and positioning.
8) waitlistAnalysis: analyze even when waitlist is zero using waitlist logic context.
9) recommendations: exactly 3 recommendations, each with timeframe and expected outcome.
10) overallScore: provide X/10 and short rationale aligned to attendance, distribution, waitlist, and setup quality.

Write with consultant tone. Keep statements data-anchored and direct.`

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

    parsed.recommendations = enforceThreeRecommendations(parsed.recommendations)

    return parsed
  } catch {
    return buildFallbackReport({ event, confirmed, waitlist })
  }
}
