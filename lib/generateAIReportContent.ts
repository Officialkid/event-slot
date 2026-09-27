import { askAI } from './ai'
import { IEvent, IRegistration } from './generateEventReport'
import { format } from 'date-fns'

export interface AIActionItem {
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  action: string
  timeframe: string
  expectedOutcome: string
}

export interface AIReportContent {
  // --- EventSlot AI Event Intelligence Fields ---
  executiveBrief: string
  funnelAnalysis: string
  attributionAnalysis: string
  demandVelocityAnalysis: string
  attendanceAnalysis: string
  whatWorked: string[]
  whatNeedsAttention: string[]
  strategicInterpretation: string
  actionableRecommendations: AIActionItem[]

  // --- Backwards-compatibility string mappings ---
  eventOverview: string
  executiveSummary: string
  strengths: string
  weaknessesAndRisks: string
  audienceProfile: string
  registrationBehaviour: string
  competitivePositioning: string
  waitlistAnalysis: string
  recommendations: string
  overallScore: string
}

export interface GenerateAIReportParams {
  event: IEvent
  confirmed: IRegistration[]
  waitlist: IRegistration[]
  totalPageViews?: number
  viewsTracked?: boolean
  conversionRate?: number
  checkedInCount?: number
  checkInDataAvailable?: boolean
  turnoutRate?: number
  noShowCount?: number
  noShowRate?: number
  sourceBreakdown?: Array<{ source: string; count: number; percentage: number }>
  attributionTracked?: boolean
  paymentSummary?: {
    currency: string
    grossRevenue: number
    commissionTotal: number
    netRevenue: number
    successfulPayments: number
    pendingPayments: number
    failedPayments: number
    ticketsSold: number
    paymentMethodBreakdown?: Array<{ method: string; count: number; grossRevenue: number }>
  }
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
    return 'Capacity was not capped, so registrations were accepted without overflow waitlisting.'
  }
  const safeConfirmed = Math.max(0, Math.min(confirmedCount, capacity))
  const fillRate = Math.round((safeConfirmed / capacity) * 100)

  if (waitlistCount > 0) {
    return `Event exceeded 100% capacity with ${waitlistCount} attendee${waitlistCount === 1 ? '' : 's'} on the waitlist, proving unmet spillover demand.`
  }
  if (fillRate >= 100) {
    return `Event reached full capacity (${confirmedCount}/${capacity}). No waitlist formed prior to registration close.`
  }
  if (fillRate < 50) {
    return `Event concluded below capacity at ${fillRate}% (${confirmedCount}/${capacity} spots filled).`
  }
  return `Event reached ${fillRate}% capacity with ${capacity - safeConfirmed} unfilled spots.`
}

function countQuestionCoverage(regs: IRegistration[], questions: IEvent['questions']): number {
  if (!questions.length || !regs.length) return 0
  const answered = regs.reduce((sum, reg) => {
    const nonEmpty = reg.answers.filter((a) => a.value && a.value.trim().length > 0).length
    return sum + nonEmpty
  }, 0)
  const total = regs.length * questions.length
  if (total === 0) return 0
  return Math.round((answered / total) * 100)
}

function summariseAnswers(regs: IRegistration[], questions: IEvent['questions']): string {
  if (!questions.length || !regs.length) return 'No custom questionnaire configured.'
  const lines: string[] = []
  for (const q of questions.slice(0, 5)) {
    const vals = regs
      .flatMap((r) => r.answers.filter((a) => a.questionId === q.id).map((a) => a.value))
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
      lines.push(`${q.label}: top responses — ${top3}`)
    }
  }
  return lines.join('\n') || 'No responses recorded.'
}

// ─── Deterministic Intelligence Engine (Fallback & Ground Truth) ─────────────

export function buildFallbackReport(params: GenerateAIReportParams): AIReportContent {
  const { event, confirmed, waitlist } = params
  const allRegs = [...confirmed, ...waitlist]
  const totalRegs = allRegs.length
  const capacity = event.capacity ?? null
  const hasCapacity = capacity !== null && capacity > 0
  const fillRate = hasCapacity ? Math.round((confirmed.length / capacity) * 100) : null
  const peakDay = getPeakDayWithCount(allRegs)
  const peakPercent = totalRegs > 0 ? Math.round((peakDay.count / totalRegs) * 100) : 0
  const questionCoverage = countQuestionCoverage(confirmed, event.questions)
  const eventType = inferEventType(event)
  const waitlistInsight = buildWaitlistInsight(confirmed.length, waitlist.length, capacity)

  // 1. Executive Brief
  const capacityText = hasCapacity ? `${fillRate}% capacity utilization (${confirmed.length}/${capacity})` : `${confirmed.length} confirmed attendees (open capacity)`
  const executiveBrief = `${event.title} (${eventType}) generated ${totalRegs} total registrations with ${capacityText}.${waitlist.length > 0 ? ` Overflow demand created a waitlist of ${waitlist.length} attendees.` : ''} Peak registration momentum concentrated on ${peakDay.date !== 'N/A' ? `${peakDay.date} (${peakDay.count} sign-ups)` : 'the final registration window'}.`

  // 2. Funnel Analysis
  let funnelAnalysis: string
  if (params.viewsTracked && typeof params.totalPageViews === 'number' && params.totalPageViews > 0) {
    const convRate = typeof params.conversionRate === 'number' ? params.conversionRate : Math.round((totalRegs / params.totalPageViews) * 1000) / 10
    const dropOffRate = Math.max(0, Math.round((100 - convRate) * 10) / 10)
    funnelAnalysis = `${params.totalPageViews.toLocaleString()} unique visitors reached the event page, resulting in ${totalRegs} completed registrations (${convRate}% conversion rate). ${dropOffRate}% of page visitors exited without registering, indicating the primary conversion friction occurred on the event landing page.`
  } else {
    funnelAnalysis = 'Page view tracking was not active for this event; conversion from initial page visit to completed registration could not be calculated. Funnel metrics begin from completed registration submissions.'
  }

  // 3. Attribution Analysis
  let attributionAnalysis: string
  const validSources = (params.sourceBreakdown ?? []).filter((s) => s.count > 0)
  const hasNonDefaultSources = validSources.some((s) => !['form', 'direct', 'manual'].includes(s.source.toLowerCase()))

  if (params.attributionTracked && validSources.length > 0 && hasNonDefaultSources) {
    const topSource = validSources[0]
    const details = validSources.map((s) => `${s.source}: ${s.count} (${s.percentage}%)`).join(', ')
    attributionAnalysis = `Acquisition was led by ${topSource.source} accounting for ${topSource.count} registrations (${topSource.percentage}% share). Breakdown across tracked channels: ${details}.`
  } else {
    attributionAnalysis = 'Campaign attribution was not configured for this event. All registrations were recorded via direct event link submissions.'
  }

  // 4. Demand Velocity Analysis
  const demandVelocityAnalysis = peakDay.date !== 'N/A'
    ? `Registration intake peaked on ${peakDay.date} with ${peakDay.count} registrations (${peakPercent}% of total volume). ${waitlistInsight}`
    : `Demand accumulated evenly with no single disproportionate surge day. ${waitlistInsight}`

  // 5. Attendance Analysis
  let attendanceAnalysis: string
  if (params.checkInDataAvailable && typeof params.checkedInCount === 'number' && params.checkedInCount > 0) {
    const turnout = params.turnoutRate ?? Math.round((params.checkedInCount / Math.max(1, confirmed.length)) * 100)
    const noShow = params.noShowRate ?? Math.max(0, 100 - turnout)
    attendanceAnalysis = `${params.checkedInCount} of ${confirmed.length} confirmed attendees checked in at the gate (${turnout}% gate turnout rate). The no-show rate was ${noShow}%, reflecting strong in-person commitment.`
  } else {
    attendanceAnalysis = 'Attendance performance cannot be calculated because gate check-in data was not recorded for this event.'
  }

  // 6. What Worked
  const whatWorked: string[] = []
  if (hasCapacity && fillRate && fillRate >= 90) {
    whatWorked.push(`Reached ${fillRate}% of capacity (${confirmed.length}/${capacity} confirmed spots).`)
  } else if (confirmed.length > 0) {
    whatWorked.push(`Secured ${confirmed.length} confirmed attendees for the event.`)
  }
  if (params.viewsTracked && typeof params.conversionRate === 'number' && params.conversionRate >= 20) {
    whatWorked.push(`Achieved strong registration page conversion of ${params.conversionRate}%.`)
  }
  if (params.checkInDataAvailable && typeof params.turnoutRate === 'number' && params.turnoutRate >= 70) {
    whatWorked.push(`Gate turnout reached ${params.turnoutRate}% of confirmed passes.`)
  }
  if (hasNonDefaultSources && validSources.length > 0) {
    whatWorked.push(`${validSources[0].source} emerged as the top marketing channel with ${validSources[0].count} sign-ups.`)
  }
  if (questionCoverage >= 70) {
    whatWorked.push(`High attendee engagement with ${questionCoverage}% completion across custom questions.`)
  }
  if (params.paymentSummary && params.paymentSummary.grossRevenue > 0) {
    whatWorked.push(`Generated ${params.paymentSummary.currency} ${params.paymentSummary.grossRevenue.toLocaleString()} in ticket sales.`)
  }
  if (whatWorked.length === 0) {
    whatWorked.push(`Registration workflow completed smoothly with ${totalRegs} total submissions recorded.`)
    whatWorked.push(`Event established a verified attendee baseline for future editions.`)
  }

  // 7. What Needs Attention
  const whatNeedsAttention: string[] = []
  if (params.viewsTracked && typeof params.conversionRate === 'number' && params.conversionRate < 35) {
    whatNeedsAttention.push(`${Math.round(100 - params.conversionRate)}% of visitors to the event page did not complete registration.`)
  }
  if (!params.viewsTracked) {
    whatNeedsAttention.push('Page view tracking was inactive, preventing visitor-to-registration drop-off measurement.')
  }
  if (!params.attributionTracked || !hasNonDefaultSources) {
    whatNeedsAttention.push('Campaign attribution was untracked, making marketing channel ROI unmeasurable.')
  }
  if (!params.checkInDataAvailable || typeof params.checkedInCount !== 'number' || params.checkedInCount === 0) {
    whatNeedsAttention.push('Gate verification / QR check-in was not utilized, leaving actual attendance unrecorded.')
  } else if (typeof params.noShowRate === 'number' && params.noShowRate > 20) {
    whatNeedsAttention.push(`${params.noShowRate}% of confirmed attendees did not check in at the gate.`)
  }
  if (peakPercent >= 60 && totalRegs >= 4) {
    whatNeedsAttention.push(`${peakPercent}% of registrations concentrated on a single peak day (${peakDay.date}), leaving registration momentum vulnerable to timing.`)
  }
  if (hasCapacity && waitlist.length === 0 && fillRate && fillRate >= 95) {
    whatNeedsAttention.push('Capacity reached near 100% but no waitlist formed, indicating uncaptured spillover demand.')
  }

  // 8. Strategic Interpretation
  const strategicInterpretation = `The data demonstrates that ${event.title} converted ${confirmed.length} confirmed attendees${hasCapacity ? ` against a capacity target of ${capacity}` : ''}.${
    params.viewsTracked && typeof params.conversionRate === 'number'
      ? ` The primary leverage point lies in pre-registration conversion (${params.conversionRate}% conversion from visitor to registration), where page optimization can significantly increase confirmed volume.`
      : ' The main operational priority for the next edition is enabling visitor tracking and campaign attribution to measure channel ROI and drop-off points.'
  } Furthermore, ${
    params.checkInDataAvailable && typeof params.turnoutRate === 'number' && params.turnoutRate > 0
      ? `turnout performance (${params.turnoutRate}% verified at gate) indicates ${params.turnoutRate >= 75 ? 'strong commitment from registrants' : 'a need for proactive pre-event confirmation reminders'}.`
      : 'implementing active gate verification will provide the final link between sign-ups and actual seat occupancy.'
  }`

  // 9. Actionable Recommendations
  const actionableRecommendations: AIActionItem[] = [
    {
      priority: 'HIGH',
      action: 'Distribute tracked campaign links (WhatsApp, Instagram, LinkedIn) across all marketing channels.',
      timeframe: 'Next campaign launch (14 days before event)',
      expectedOutcome: 'Direct visibility into channel conversion efficiency and cost per attendee.',
    },
    {
      priority: 'HIGH',
      action: 'Send an automated reminder SMS/WhatsApp 24 hours and 2 hours before event start with directions and gate QR code.',
      timeframe: '24 hours prior to event gate opening',
      expectedOutcome: 'Reduce no-show rate by an estimated 12-18%.',
    },
    {
      priority: 'MEDIUM',
      action: 'Publish event key takeaways and open an early-access waitlist for the next edition.',
      timeframe: 'Within 48 hours post-event',
      expectedOutcome: 'Capture immediate momentum and seed initial registrations for the next cycle.',
    },
  ]

  // Legacy mappings for backwards-compatibility
  return {
    executiveBrief,
    funnelAnalysis,
    attributionAnalysis,
    demandVelocityAnalysis,
    attendanceAnalysis,
    whatWorked,
    whatNeedsAttention,
    strategicInterpretation,
    actionableRecommendations,

    eventOverview: executiveBrief,
    executiveSummary: strategicInterpretation,
    strengths: whatWorked.map((w, i) => `${i + 1}. ${w}`).join('\n'),
    weaknessesAndRisks: whatNeedsAttention.map((w, i) => `${i + 1}. ${w}`).join('\n'),
    audienceProfile: questionCoverage > 0
      ? `Attendee profile shows ${questionCoverage}% completion rate across custom questions. Registrants provided actionable data for audience segmentation.`
      : 'Standard registration data captured with no supplementary custom questionnaire.',
    registrationBehaviour: demandVelocityAnalysis,
    competitivePositioning: `${event.title} established proven attendee demand with ${totalRegs} registrations within its market segment.`,
    waitlistAnalysis: waitlistInsight,
    recommendations: actionableRecommendations.map((r, i) => `${i + 1}. [${r.priority}] ${r.timeframe}: ${r.action} Expected outcome: ${r.expectedOutcome}`).join('\n'),
    overallScore: 'Performance evaluated across registration funnel, demand velocity, gate turnout, and operational setup.',
  }
}

// ─── Main AI Generation ───────────────────────────────────────────────────────

export async function generateAIReportContent(params: GenerateAIReportParams): Promise<AIReportContent> {
  const fallback = buildFallbackReport(params)
  const { event, confirmed, waitlist } = params

  const sys = `You are EventSlot AI Event Intelligence, an analytical event performance engine.
Analyze event data and produce rigorous, evidence-based intelligence for the event organizer.

Core Principles:
1. NEVER hallucinate or assume missing data.
   - If page view data is unavailable (untracked), explicitly state: "Page view tracking was not active for this event; conversion from initial visit cannot be calculated."
   - If campaign attribution is generic or untracked, state: "Campaign attribution was not configured for this event."
   - If gate check-in data is unavailable, state: "Gate check-in data was not recorded; attendance turnout cannot be determined."
   - If the event is free, state: "Free event; revenue analysis not applicable."
2. NO vague fluff or generic essays. Do not write filler like "Your event demonstrates market relevance".
3. Ground every statement in actual numbers from the provided event data.
4. Identify real patterns, real drop-offs, and real friction points.
5. Provide high-impact, prioritized, actionable recommendations with explicit timeframes and expected measurable results.

Output format:
Return ONLY valid JSON matching this schema:
{
  "executiveBrief": "2-3 sentences summarizing performance, capacity fill, and the single biggest operational takeaway.",
  "funnelAnalysis": "Analysis of the transition from page views (if tracked) to registration, confirmed status, and gate attendance.",
  "attributionAnalysis": "Analysis of traffic sources and marketing channels driving registrations.",
  "demandVelocityAnalysis": "Analysis of registration velocity over time, peak intake day, and capacity pressure.",
  "attendanceAnalysis": "Analysis of confirmation vs actual gate attendance and no-show rate (or stating data is unavailable).",
  "whatWorked": [
    "Specific data-backed success point 1",
    "Specific data-backed success point 2",
    "Specific data-backed success point 3"
  ],
  "whatNeedsAttention": [
    "Specific data-backed friction or drop-off point 1",
    "Specific data-backed friction or drop-off point 2",
    "Specific data-backed friction or drop-off point 3"
  ],
  "strategicInterpretation": "Deep consultant-grade analysis explaining the underlying dynamics of this event and what drove the results.",
  "actionableRecommendations": [
    {
      "priority": "HIGH",
      "action": "Concrete operational action to take",
      "timeframe": "e.g. Within 48 hours post-event",
      "expectedOutcome": "Measurable expected outcome"
    },
    {
      "priority": "MEDIUM",
      "action": "Concrete operational action to take",
      "timeframe": "...",
      "expectedOutcome": "..."
    },
    {
      "priority": "LOW",
      "action": "Concrete operational action to take",
      "timeframe": "...",
      "expectedOutcome": "..."
    }
  ]
}`

  const eventContext = `Event data:
- Title: ${event.title}
- Event type: ${inferEventType(event)}
- Date: ${formatIsoDate(event.eventDate)}
- Location: ${event.location ?? 'Not specified'}
- Capacity: ${event.capacity ?? 'Unlimited'}
- Total registrations: ${confirmed.length + waitlist.length}
- Confirmed passes: ${confirmed.length}
- Waitlist count: ${waitlist.length}
- Total page views: ${params.viewsTracked ? params.totalPageViews : 'Untracked'}
- Visitor conversion rate: ${params.viewsTracked && typeof params.conversionRate === 'number' ? `${params.conversionRate}%` : 'Unavailable (untracked views)'}
- Gate check-ins: ${params.checkInDataAvailable && typeof params.checkedInCount === 'number' ? params.checkedInCount : 'Not recorded'}
- Gate turnout rate: ${params.checkInDataAvailable && typeof params.turnoutRate === 'number' ? `${params.turnoutRate}%` : 'Unavailable (no check-in data)'}
- No-show rate: ${params.checkInDataAvailable && typeof params.noShowRate === 'number' ? `${params.noShowRate}%` : 'Unavailable (no check-in data)'}
- Attribution channels: ${params.attributionTracked && params.sourceBreakdown?.length ? params.sourceBreakdown.map((s) => `${s.source}: ${s.count}`).join(', ') : 'Untracked (direct link only)'}
- Questionnaire responses: ${summariseAnswers(confirmed, event.questions)}
- Payment: ${params.paymentSummary ? `${params.paymentSummary.currency} ${params.paymentSummary.grossRevenue} gross (${params.paymentSummary.ticketsSold} tickets sold)` : 'Free registration (no payment required)'}`

  try {
    const raw = await Promise.race([
      askAI({
        system: sys,
        prompt: eventContext,
        taskType: 'report',
        maxTokens: 2500,
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000)),
    ])

    if (!raw) return fallback

    const cleaned = raw.replace(/```json|```/gi, '').trim()
    const parsed = JSON.parse(cleaned) as Partial<AIReportContent>

    if (
      !parsed.executiveBrief ||
      !Array.isArray(parsed.whatWorked) ||
      !Array.isArray(parsed.whatNeedsAttention) ||
      !Array.isArray(parsed.actionableRecommendations)
    ) {
      return fallback
    }

    return {
      executiveBrief: parsed.executiveBrief || fallback.executiveBrief,
      funnelAnalysis: parsed.funnelAnalysis || fallback.funnelAnalysis,
      attributionAnalysis: parsed.attributionAnalysis || fallback.attributionAnalysis,
      demandVelocityAnalysis: parsed.demandVelocityAnalysis || fallback.demandVelocityAnalysis,
      attendanceAnalysis: parsed.attendanceAnalysis || fallback.attendanceAnalysis,
      whatWorked: parsed.whatWorked.length > 0 ? parsed.whatWorked : fallback.whatWorked,
      whatNeedsAttention: parsed.whatNeedsAttention.length > 0 ? parsed.whatNeedsAttention : fallback.whatNeedsAttention,
      strategicInterpretation: parsed.strategicInterpretation || fallback.strategicInterpretation,
      actionableRecommendations: parsed.actionableRecommendations.length > 0 ? parsed.actionableRecommendations : fallback.actionableRecommendations,

      eventOverview: parsed.executiveBrief || fallback.executiveBrief,
      executiveSummary: parsed.strategicInterpretation || fallback.strategicInterpretation,
      strengths: (parsed.whatWorked ?? fallback.whatWorked).map((w, i) => `${i + 1}. ${w}`).join('\n'),
      weaknessesAndRisks: (parsed.whatNeedsAttention ?? fallback.whatNeedsAttention).map((w, i) => `${i + 1}. ${w}`).join('\n'),
      audienceProfile: fallback.audienceProfile,
      registrationBehaviour: parsed.demandVelocityAnalysis || fallback.demandVelocityAnalysis,
      competitivePositioning: fallback.competitivePositioning,
      waitlistAnalysis: fallback.waitlistAnalysis,
      recommendations: (parsed.actionableRecommendations ?? fallback.actionableRecommendations)
        .map((r, i) => `${i + 1}. [${r.priority}] ${r.timeframe}: ${r.action} (${r.expectedOutcome})`)
        .join('\n'),
      overallScore: fallback.overallScore,
    }
  } catch {
    return fallback
  }
}
