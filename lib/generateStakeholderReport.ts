import fs from "fs"
import path from "path"
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  SimpleField,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx"
import { format } from "date-fns"
import { askAI } from "./ai"

const LIME = "C8F55A"
const NAVY = "0D1B2A"
const WHITE = "FFFFFF"
const GREY = "777777"
const DARK = "1A1A1A"
const BORDER = { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" }
const NO_BD = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }
const FIRST_ACTIVITY_FALLBACK = new Date("2026-04-15T00:00:00.000Z")
type ReportChild = Paragraph | Table
type RecommendationItem = { title: string; body: string }

export const MONTHLY_SECTION_ORDER = [
  "Cover Page",
  "Executive Summary",
  "Platform Growth",
  "Plan Mix & Monetisation Pipeline",
  "Event Activity",
  "System Health",
  "AI Strategic Recommendations",
  "Next Period Targets",
  "Footer",
]

export const YEARLY_SECTION_ORDER = [
  "Cover Page",
  "Year in Review",
  "Executive Summary",
  "Platform Growth",
  "Top Events of the Year",
  "Plan Mix & Monetisation Pipeline",
  "System Health Summary",
  "AI Strategic Recommendations",
  "Year-Ahead Outlook",
  "Footer",
]

export interface StakeholderReportData {
  period: "weekly" | "monthly" | "yearly"
  periodLabel: string
  generatedAt: Date

  newUsers: number
  totalUsers: number
  newEvents: number
  totalEvents: number
  newRegistrations: number
  totalRegistrations: number
  activeEvents: number
  reportDownloadsPurchased: number
  revenueKsh: number

  prevNewUsers: number
  prevNewEvents: number
  prevNewRegistrations: number

  topEvents: Array<{
    title: string
    registrations: number
    capacity: number | null
    organizer: string
    status?: string
    archived?: boolean
    deadline?: Date | null
  }>

  errorCount: number
  topErrors: Array<{ route: string; count: number; message: string }>
  failedEmailCount: number
  emailsSent?: number | null
  uptimePercentage?: number | null

  freeUsers: number
  proUsers: number
  businessUsers: number

  firstPlatformActivityAt?: Date
  growthLabels?: string[]
  usersTrend?: number[]
  eventsTrend?: number[]
  registrationsTrend?: number[]
  monthlySnapshots?: Array<{
    month: string
    totalUsers: number
    registrations: number
  }>
  createdEventOrganizers?: number
  completedEventOrganizers?: number
  eligibleForProOrganizers?: number
}

function pctValue(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

function pct(current: number, previous: number): string {
  const value = pctValue(current, previous)
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`
}

function currency(value: number): string {
  return `KSh ${value.toLocaleString()}`
}

function reportTypeLabel(period: StakeholderReportData["period"]): string {
  if (period === "yearly") return "Annual Stakeholder Report"
  return "Monthly Stakeholder Report"
}

function displayPeriodLabel(data: StakeholderReportData): string {
  if (data.period === "yearly") {
    return `Year ${data.periodLabel}`
  }
  return data.periodLabel
}

function platformAgeDays(data: StakeholderReportData): number {
  const firstActivity = data.firstPlatformActivityAt ?? FIRST_ACTIVITY_FALLBACK
  const diffMs = data.generatedAt.getTime() - firstActivity.getTime()
  return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

function isLaunchPhase(data: StakeholderReportData): boolean {
  return platformAgeDays(data) <= 180
}

type ErrorClassification = {
  severity: string
  color: string
  rootCause: string
  fix: string
  coreFlowImpact: boolean
  configIssue: boolean
}

function extractKeyName(message: string): string {
  const configuredMatch = message.match(/([A-Z_]+) is not configured/)
  if (configuredMatch?.[1]) return configuredMatch[1]
  const keyMatch = message.match(/([A-Z_]*API[A-Z_]*)/)
  return keyMatch?.[1] ?? "required API key"
}

function classifyError(route: string, message: string, count: number): ErrorClassification {
  const lowerRoute = route.toLowerCase()
  const lowerMessage = message.toLowerCase()
  const criticalRoutes = ["/api/auth", "/api/events", "/api/registrations", "/api/webhooks"]

  if (criticalRoutes.some(r => lowerRoute.includes(r))) {
    return {
      severity: "CRITICAL",
      color: "EF4444",
      rootCause: "Core flow disruption",
      fix: "Immediate incident response and route-level fix required",
      coreFlowImpact: true,
      configIssue: false,
    }
  }

  if (lowerMessage.includes("is not configured") || lowerMessage.includes("api_key")) {
    const keyName = extractKeyName(message)
    return {
      severity: "LOW - Configuration",
      color: "F59E0B",
      rootCause: `Missing ${keyName} environment variable`,
      fix: `Add ${keyName} to Cloud Run secrets`,
      coreFlowImpact: false,
      configIssue: true,
    }
  }

  if (count > 50) {
    return {
      severity: "MEDIUM",
      color: "F59E0B",
      rootCause: "Recurring non-core route failure",
      fix: "Prioritise route-level remediation in upcoming sprint",
      coreFlowImpact: false,
      configIssue: false,
    }
  }

  return {
    severity: "LOW",
    color: "22C55E",
    rootCause: "Isolated runtime exception",
    fix: "Monitor and patch if recurrence grows",
    coreFlowImpact: false,
    configIssue: false,
  }
}

function assessSystemHealth(data: StakeholderReportData): {
  score: "GOOD" | "ATTENTION NEEDED" | "CRITICAL"
  scoreLabel: string
  coreReliabilityStatus: "STABLE" | "AT RISK"
} {
  const classifications = data.topErrors.map(error => classifyError(error.route, error.message, error.count))
  const hasCriticalFlowImpact = classifications.some(item => item.coreFlowImpact)
  const configIssues = classifications.filter(item => item.configIssue)
  const allConfigIssue = classifications.length > 0 && configIssues.length === classifications.length
  const uniqueConfigKeyCount = new Set(
    data.topErrors
      .map(error => extractKeyName(error.message))
      .filter(Boolean),
  ).size
  const singleConfigRootCause = allConfigIssue && uniqueConfigKeyCount <= 1

  if (hasCriticalFlowImpact) {
    return { score: "CRITICAL", scoreLabel: "CRITICAL", coreReliabilityStatus: "AT RISK" }
  }

  if (singleConfigRootCause) {
    return {
      score: "ATTENTION NEEDED",
      scoreLabel: "ATTENTION NEEDED - Non-critical",
      coreReliabilityStatus: "STABLE",
    }
  }

  if (data.errorCount < 10) {
    return { score: "GOOD", scoreLabel: "GOOD", coreReliabilityStatus: "STABLE" }
  }

  return { score: "ATTENTION NEEDED", scoreLabel: "ATTENTION NEEDED", coreReliabilityStatus: "STABLE" }
}

function buildSystemHealthSummaryParagraph(data: StakeholderReportData, assessment: ReturnType<typeof assessSystemHealth>): string {
  const classifications = data.topErrors.map(error => classifyError(error.route, error.message, error.count))
  const configIssues = classifications.filter(item => item.configIssue)
  const allConfigIssue = classifications.length > 0 && configIssues.length === classifications.length
  const keyName = data.topErrors[0] ? extractKeyName(data.topErrors[0].message) : "required API key"

  if (allConfigIssue && data.errorCount > 0) {
    return `All ${data.errorCount} logged errors during this period share a single root cause: the ${keyName} environment variable is not configured in the production environment. This affects only AI-enhancement features and has zero impact on core platform functionality - event creation, registration, and waitlist management all operated without interruption. Resolution is a single environment variable addition. Core platform reliability: ${assessment.coreReliabilityStatus}`
  }

  if (assessment.score === "CRITICAL") {
    return `Reliability signals indicate core workflow degradation requiring immediate remediation on authentication, registration, or event operations paths. The incident profile suggests user-impacting failures in primary platform journeys, and mitigation should be prioritised ahead of non-core feature work. Core platform reliability: ${assessment.coreReliabilityStatus}`
  }

  if (data.errorCount === 0) {
    return `Operational telemetry indicates stable platform behaviour across monitored endpoints for this period, with no dominant fault cluster requiring intervention. Reliability posture remains strong while feature development can proceed without urgent corrective dependency. Core platform reliability: ${assessment.coreReliabilityStatus}`
  }

  return `Error activity is concentrated in non-core areas and appears manageable with targeted fixes rather than broad architecture changes. Current reliability posture supports ongoing growth operations while remediation actions are queued for the next execution cycle. Core platform reliability: ${assessment.coreReliabilityStatus}`
}

function buildExecutiveNarrative(data: StakeholderReportData): string {
  const usersDelta = pctValue(data.newUsers, data.prevNewUsers)
  const eventsDelta = pctValue(data.newEvents, data.prevNewEvents)
  const registrationsDelta = pctValue(data.newRegistrations, data.prevNewRegistrations)
  const launch = isLaunchPhase(data)
  const age = platformAgeDays(data)

  const growthContext =
    launch && (usersDelta < 0 || eventsDelta < 0 || registrationsDelta < 0)
      ? `Some period-over-period percentages appear negative due to natural early-stage baseline effects while EventSlot is only ${age} days from first recorded activity.`
      : `Growth indicators remain directionally aligned with EventSlot's current adoption trajectory.`

  const revenueContext =
    data.revenueKsh === 0
      ? "Revenue remains at KSh 0 by design during the intentional free-beta phase focused on adoption, onboarding quality, and retention signal collection."
      : `Revenue reached ${currency(data.revenueKsh)}, indicating early monetisation conversion from report download activity.`

  return `EventSlot closed ${displayPeriodLabel(data)} with ${data.newUsers.toLocaleString()} new users, ${data.newEvents.toLocaleString()} new events, and ${data.newRegistrations.toLocaleString()} new registrations. ${growthContext} ${revenueContext}`
}

function buildYearInReviewNarrative(data: StakeholderReportData): string {
  const age = platformAgeDays(data)
  const launch = isLaunchPhase(data)
  const lifecycleSentence = launch
    ? `The year reflects EventSlot's launch window, beginning from first platform activity on 15 April 2026 and scaling core usage within ${age} days.`
    : `The year reflects EventSlot's transition from early launch to repeat usage and operational scaling.`

  const monetisationSentence =
    data.revenueKsh === 0
      ? "Commercial strategy remained intentionally in free-beta mode to prioritise market learning over near-term monetisation."
      : `Commercial activity generated ${currency(data.revenueKsh)} while platform adoption continued to expand.`

  return `${lifecycleSentence} During the period, EventSlot reached ${data.totalUsers.toLocaleString()} total users and ${data.totalRegistrations.toLocaleString()} total registrations across ${data.totalEvents.toLocaleString()} created events. ${monetisationSentence}`
}

function buildNextPeriodTargetsTable(data: StakeholderReportData): Table {
  const targetUsers = Math.ceil(data.totalUsers * 1.25)
  const targetEvents = data.totalEvents + 5
  const widths = [1800, 1500, 1860, 4200]

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      headerRow(["Metric", "Current", "Target (Next Period)", "How"], widths),
      kpiDataRow(
        [
          "Total Users",
          data.totalUsers.toLocaleString(),
          targetUsers.toLocaleString(),
          "Referral from active organisers + social presence",
        ],
        widths,
        false,
      ),
      kpiDataRow(
        [
          "Events Created",
          data.totalEvents.toLocaleString(),
          targetEvents.toLocaleString(),
          "Onboarding email sequence to registered non-active organisers",
        ],
        widths,
        true,
      ),
      kpiDataRow(
        [
          "Pro Conversions",
          data.proUsers.toLocaleString(),
          "1-3",
          "Targeted upgrade trigger for organisers with 30+ registrations",
        ],
        widths,
        false,
      ),
      kpiDataRow(
        [
          "API Error Count",
          data.errorCount.toLocaleString(),
          "< 10",
          "Add OPENROUTER_API_KEY to Cloud Run environment",
        ],
        widths,
        true,
      ),
    ],
  })
}

async function generateYearAheadOutlookParagraphs(data: StakeholderReportData): Promise<string[]> {
  const prompt = `Write a 2-paragraph year-ahead outlook for EventSlot.

Context metrics:
- Total users: ${data.totalUsers}
- Total events: ${data.totalEvents}
- Total registrations: ${data.totalRegistrations}
- Active events: ${data.activeEvents}
- Plan mix: Free ${data.freeUsers}, Pro ${data.proUsers}, Business ${data.businessUsers}
- New users this period: ${data.newUsers}
- New events this period: ${data.newEvents}
- New registrations this period: ${data.newRegistrations}

Paragraph 1 must explain what we are building toward, including first Pro conversions, M-Pesa integration, and East Africa expansion.
Paragraph 2 must define what success looks like by end of next year with specific, realistic numbers.

Tone: ambitious but grounded, investor-appropriate.
Do not use phrases like "we hope to" or "we plan to consider".
Use assertive phrasing like "we will" and "the target is".

Output exactly 2 paragraphs and no bullets.`

  const aiText = await askAI({
    system: "You write investor-grade strategic outlook narratives for early-stage African SaaS businesses.",
    prompt,
    taskType: "qa",
    maxTokens: 360,
  })

  if (!aiText || !aiText.trim()) {
    return [
      "Over the next year, EventSlot will convert its launch traction into structured commercial momentum. We will secure first Pro conversions, deliver M-Pesa-enabled billing integration for local payment convenience, and expand from Kenya into priority East Africa corridors where organizer workflows mirror our current demand profile.",
      `By year-end, the target is a measured but meaningful scale profile: at least ${Math.max(data.totalUsers + 120, Math.ceil(data.totalUsers * 1.8))} registered organisers, ${Math.max(data.totalEvents + 90, Math.ceil(data.totalEvents * 1.7))} total events, and ${Math.max(data.totalRegistrations + 2500, Math.ceil(data.totalRegistrations * 1.9))} cumulative registrations, supported by initial recurring Pro revenue and stable core reliability.`
    ]
  }

  const paragraphs = aiText
    .split(/\n\s*\n/)
    .map(p => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 2)

  if (paragraphs.length === 2) {
    return paragraphs
  }

  const collapsed = aiText
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .join(" ")

  const midpoint = Math.max(40, Math.floor(collapsed.length / 2))
  return [collapsed.slice(0, midpoint).trim(), collapsed.slice(midpoint).trim()]
}

function headerRow(labels: string[], widths: number[]) {
  return new TableRow({
    tableHeader: true,
    children: labels.map((label, i) =>
      new TableCell({
        width: { size: widths[i], type: WidthType.DXA },
        shading: { fill: NAVY, type: ShadingType.CLEAR },
        borders: { top: NO_BD, bottom: NO_BD, left: NO_BD, right: NO_BD },
        margins: { top: 100, bottom: 100, left: 120, right: 120 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: label, font: "Arial", size: 18, bold: true, color: WHITE })],
          }),
        ],
      }),
    ),
  })
}

function dataRow(values: string[], widths: number[], shade = false) {
  return new TableRow({
    children: values.map((value, i) =>
      new TableCell({
        width: { size: widths[i], type: WidthType.DXA },
        shading: { fill: shade ? "F9FAFB" : WHITE, type: ShadingType.CLEAR },
        borders: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [
          new Paragraph({
            alignment: i > 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
            children: [new TextRun({ text: value, font: "Arial", size: 19, color: "333333" })],
          }),
        ],
      }),
    ),
  })
}

type KpiCellValue = string | { text: string; color?: string; italic?: boolean }

function kpiDataRow(values: KpiCellValue[], widths: number[], shade = false) {
  return new TableRow({
    children: values.map((value, i) => {
      const cell = typeof value === "string" ? { text: value } : value
      return new TableCell({
        width: { size: widths[i], type: WidthType.DXA },
        shading: { fill: shade ? "F9FAFB" : WHITE, type: ShadingType.CLEAR },
        borders: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [
          new Paragraph({
            alignment: i > 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
            children: [
              new TextRun({
                text: cell.text,
                font: "Arial",
                size: 19,
                color: cell.color ?? "333333",
                italics: cell.italic ?? false,
              }),
            ],
          }),
        ],
      })
    }),
  })
}

function calculateChange(current: number, previous: number | string): { text: string; color: string } {
  if (previous === "—" || previous === 0) {
    return { text: "Baseline", color: "888888" }
  }
  if (typeof previous !== "number") {
    return { text: "—", color: "888888" }
  }
  const pctDelta = ((current - previous) / previous) * 100
  const text = `${pctDelta >= 0 ? "+" : ""}${pctDelta.toFixed(1)}%`
  if (pctDelta > 0) return { text, color: "22C55E" }
  if (pctDelta < 0) return { text, color: "EF4444" }
  return { text, color: "888888" }
}

function buildKpiTable(data: StakeholderReportData): Table {
  const isLaunchNormalisation = isLaunchPhase(data) && data.prevNewUsers > 0 && data.newUsers < data.prevNewUsers
  const rows: Array<{
    metric: string
    current: number
    previous: number | string
    note?: string
  }> = [
    {
      metric: "New Users",
      current: data.newUsers,
      previous: data.prevNewUsers,
      note: isLaunchNormalisation ? "Launch normalisation" : undefined,
    },
    {
      metric: "New Events",
      current: data.newEvents,
      previous: data.prevNewEvents,
      note: data.newEvents === 0 ? "Platform pipeline building" : undefined,
    },
    {
      metric: "New Registrations",
      current: data.newRegistrations,
      previous: data.prevNewRegistrations,
      note: undefined,
    },
    {
      metric: "Revenue (KSh)",
      current: data.revenueKsh,
      previous: "—",
      note: "Free-beta phase — monetisation next milestone",
    },
  ]

  const widths = [2400, 1640, 1640, 1640, 2040]

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      headerRow(["Metric", "This Period", "Previous Period", "Change", "Context"], widths),
      ...rows.map((row, index) => {
        const change = calculateChange(row.current, row.previous)
        return kpiDataRow(
          [
            row.metric,
            row.current.toLocaleString(),
            row.previous === "—" ? "—" : row.previous.toLocaleString(),
            { text: change.text, color: change.color },
            { text: row.note ?? "—", italic: true, color: "666666" },
          ],
          widths,
          index % 2 === 1,
        )
      }),
    ],
  })
}

function fallbackExecutiveSummaryParagraphs(data: StakeholderReportData): string[] {
  if (data.period === "yearly") {
    return [
      `EventSlot went live on 15 April 2026, and this inaugural year captures the platform's baseline establishment from a standing start in Kenya with pan-Africa expansion planned. The platform closed the year with ${data.totalUsers.toLocaleString()} total users, ${data.totalEvents.toLocaleString()} total events, and ${data.totalRegistrations.toLocaleString()} total registrations.`,
      `EventSlot added ${data.newUsers.toLocaleString()} users, ${data.newEvents.toLocaleString()} events, and ${data.newRegistrations.toLocaleString()} registrations in this reporting window, with ${data.activeEvents.toLocaleString()} events currently active. These metrics reflect early launch and organic growth dynamics for a freemium platform serving smart event registration and waitlist management use cases.`,
      data.revenueKsh === 0
        ? "Revenue remains at KSh 0 by design while EventSlot operates in free-beta mode; monetisation through Pro and Business upgrades is the next commercial milestone. The next period is focused on improving conversion from free organizers to paid tiers while scaling reliable event throughput."
        : `Revenue reached ${currency(data.revenueKsh)} while EventSlot remains focused on disciplined expansion and product-led conversion. The next period is focused on accelerating Pro and Business upgrade conversion while sustaining reliability at higher usage volumes.`,
    ]
  }

  const userLine =
    data.prevNewUsers > 0 && data.newUsers < data.prevNewUsers
      ? `${data.periodLabel} represents a normalisation from the previous launch spike: ${data.newUsers.toLocaleString()} new organisers joined this period, bringing total users to ${data.totalUsers.toLocaleString()}.`
      : `${data.newUsers.toLocaleString()} new users joined this period, bringing total users to ${data.totalUsers.toLocaleString()}.`

  return [
    `EventSlot is a smart event registration and waitlist management platform in early launch and organic growth mode, serving Kenya first with pan-Africa expansion planned. ${userLine}`,
    `${data.newEvents.toLocaleString()} new events were created and ${data.newRegistrations.toLocaleString()} new registrations were processed during this period, with ${data.activeEvents.toLocaleString()} events currently active. This performance indicates continued organic momentum across organizer onboarding and event participation.` ,
    data.revenueKsh === 0
      ? "Revenue remains intentionally at KSh 0 during the free-beta phase; monetisation through Pro and Business tier upgrades is the next commercial milestone. The next period is focused on strengthening activation quality and preparing the first structured conversion motions."
      : `Revenue reached ${currency(data.revenueKsh)} while the platform continued to scale usage. The next period is focused on deepening monetisation conversion while maintaining reliable delivery at growing transaction volumes.`,
  ]
}

async function generateExecutiveSummaryParagraphs(data: StakeholderReportData): Promise<string[]> {
  const reportScope = data.period === "yearly" ? "YEARLY" : "MONTHLY"
  const prompt = `Write a 3-paragraph executive summary for EventSlot's ${reportScope} stakeholder report.

Context you must use:
- EventSlot is a smart event registration and waitlist management platform
- It launched its first live activity on 15th April 2026
- Primary market: Kenya, with pan-Africa expansion planned
- Business model: Freemium (Free / Pro / Business tiers)
- Current stage: Early launch / organic growth phase

Data for this period:
- Total users: ${data.totalUsers}
- New users this period: ${data.newUsers}
- Previous period users: ${data.prevNewUsers}
- Total events: ${data.totalEvents}
- New events this period: ${data.newEvents}
- Total registrations: ${data.totalRegistrations}
- New registrations this period: ${data.newRegistrations}
- Active events: ${data.activeEvents}
- Revenue: KSh ${data.revenueKsh}

Rules for writing:
1. NEVER present a negative percentage without context.
2. NEVER say revenue is KSh 0 without explaining it is intentional.
3. If this is the yearly report and previous period was 0, do NOT say +100%; treat as baseline establishment.
4. Always open with this exact founding line if yearly: "EventSlot went live on 15 April 2026..."
5. Tone: confident, data-grounded, forward-looking. Not defensive.
6. Length: 3 paragraphs maximum. No bullet points.
7. End with a one-sentence forward statement: what the next period is focused on.

Output only the summary text.`

  const aiText = await askAI({
    system:
      "You are an investor communications specialist writing board-ready executive summaries for an early-stage SaaS startup. Obey all writing constraints exactly.",
    prompt,
    taskType: "qa",
    maxTokens: 420,
  })

  if (!aiText || !aiText.trim()) {
    return fallbackExecutiveSummaryParagraphs(data)
  }

  const paragraphs = aiText
    .split(/\n\s*\n/)
    .map(p => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 3)

  const normalized = paragraphs.length > 0 ? paragraphs : fallbackExecutiveSummaryParagraphs(data)

  if (data.period === "yearly" && !normalized[0].startsWith("EventSlot went live on 15 April 2026")) {
    normalized[0] = `EventSlot went live on 15 April 2026, and ${normalized[0].charAt(0).toLowerCase()}${normalized[0].slice(1)}`
  }

  return normalized
}

function renderExecutiveSummaryParagraphs(paragraphs: string[]): Paragraph[] {
  return paragraphs.map((text, index) =>
    new Paragraph({
      spacing: { before: index === 0 ? 70 : 40, after: 110 },
      children: [new TextRun({ text, font: "Arial", size: 22, color: "333333" })],
    }),
  )
}

async function generateMonetisationNarrative(data: StakeholderReportData): Promise<string> {
  const prompt = `Write one concise investor-facing paragraph for the section titled "Plan Distribution & Monetisation Pipeline".

Use these facts:
- EventSlot total users: ${data.totalUsers}
- Free users: ${data.freeUsers}
- Pro users: ${data.proUsers}
- Business users: ${data.businessUsers}
- Product context: freemium, free-beta phase, conversion focus
- Pro features include advanced analytics, extended data retention, and custom branding

Rules:
1. Never say "no revenue".
2. Frame current user base as top of monetisation funnel.
3. State that free-beta is intentional for organiser-base growth.
4. Mention Pro features are live and available for upgrade.
5. End by naming first Pro conversion as the next commercial milestone.
6. Tone: confident and forward-looking.

Output a single paragraph only.`

  const aiText = await askAI({
    system: "You are writing investor-ready monetisation narrative for an early-stage SaaS platform.",
    prompt,
    taskType: "qa",
    maxTokens: 180,
  })

  if (aiText && aiText.trim()) {
    return aiText.replace(/\s+/g, " ").trim()
  }

  return `EventSlot's ${data.totalUsers.toLocaleString()} registered organisers represent the top of the monetisation funnel. The platform is in free-beta phase, building the organiser base before activating conversion triggers. Pro tier features - advanced analytics, extended data retention, and custom branding - are live and available for upgrade. The next commercial milestone is first Pro conversion.`
}

async function renderChartBuffer(config: unknown, width = 1200, height = 560): Promise<Buffer | null> {
  try {
    const url = `https://quickchart.io/chart?width=${width}&height=${height}&backgroundColor=white&c=${encodeURIComponent(
      JSON.stringify(config),
    )}`

    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) return null
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch {
    return null
  }
}

function getMonthlySnapshots(data: StakeholderReportData): Array<{ month: string; totalUsers: number; registrations: number }> {
  if (data.monthlySnapshots && data.monthlySnapshots.length > 0) {
    return data.monthlySnapshots
  }
  return [
    {
      month: displayPeriodLabel(data),
      totalUsers: data.totalUsers,
      registrations: data.newRegistrations,
    },
  ]
}

async function buildUserGrowthChart(data: StakeholderReportData): Promise<Buffer | null> {
  const snapshots = getMonthlySnapshots(data)
  const labels = snapshots.map(s => s.month)
  const userPoints = snapshots.map(s => s.totalUsers)
  const isShortSeries = snapshots.length <= 2

  const config = {
    type: isShortSeries ? "bar" : "line",
    data: {
      labels,
      datasets: [
        {
          label: "Total Registered Users",
          data: userPoints,
          borderColor: "#C8F55A",
          backgroundColor: isShortSeries ? "#C8F55A" : "rgba(200, 245, 90, 0.20)",
          borderWidth: 2,
          pointBackgroundColor: "#C8F55A",
          pointRadius: 4,
          tension: 0.3,
          fill: !isShortSeries,
        },
      ],
    },
    options: {
      plugins: {
        legend: { position: "bottom", labels: { color: "#222" } },
        title: {
          display: true,
          text: "User Growth Since Launch",
          color: "#111",
          font: { size: 14, weight: "bold" },
        },
        subtitle: {
          display: true,
          text: "Platform Launch: 15 Apr 2026",
          color: "#666",
        },
        annotation: {
          annotations: {
            launchPoint: {
              type: "line",
              xMin: labels[0],
              xMax: labels[0],
              borderColor: "#0D1B2A",
              borderWidth: 1,
              label: {
                display: true,
                content: "Platform Launch",
                color: "#111",
                backgroundColor: "rgba(200,245,90,0.35)",
              },
            },
          },
        },
        datalabels: {
          anchor: "end",
          align: "top",
          color: "#1A1A1A",
          formatter: (value: number) => value,
          font: { weight: "bold" },
        },
      },
      scales: {
        x: { ticks: { color: "#555" }, grid: { color: "#eee" } },
        y: { ticks: { color: "#555" }, grid: { color: "#eee" }, beginAtZero: true },
      },
    },
  }

  return renderChartBuffer(config)
}

async function buildMonthlyRegistrationsChart(data: StakeholderReportData): Promise<Buffer | null> {
  const snapshots = getMonthlySnapshots(data)
  const config = {
    type: "bar",
    data: {
      labels: snapshots.map(s => s.month),
      datasets: [
        {
          label: "Monthly Registrations",
          data: snapshots.map(s => s.registrations),
          backgroundColor: "#C8F55A",
          borderColor: "#C8F55A",
          borderWidth: 1,
        },
      ],
    },
    options: {
      plugins: {
        legend: { position: "bottom", labels: { color: "#222" } },
        title: {
          display: true,
          text: "Monthly Registrations",
          color: "#111",
          font: { size: 14, weight: "bold" },
        },
        datalabels: {
          anchor: "end",
          align: "top",
          color: "#1A1A1A",
          formatter: (value: number) => value,
          font: { weight: "bold" },
        },
      },
      scales: {
        x: { ticks: { color: "#555" }, grid: { color: "#eee" } },
        y: { ticks: { color: "#555" }, grid: { color: "#eee" }, beginAtZero: true },
      },
    },
  }

  return renderChartBuffer(config)
}

async function buildPlanMixChart(data: StakeholderReportData): Promise<Buffer | null> {
  const totalUsers = data.freeUsers + data.proUsers + data.businessUsers
  const config = {
    type: "doughnut",
    data: {
      labels: ["Free", "Pro", "Business"],
      datasets: [
        {
          data: [data.freeUsers, data.proUsers, data.businessUsers],
          backgroundColor: ["#A3A3A3", "#C8F55A", "#FFFFFF"],
          borderColor: "#1A1A1A",
          borderWidth: 2,
        },
      ],
    },
    options: {
      cutout: "62%",
      plugins: {
        legend: { position: "bottom", labels: { color: "#222" } },
        title: {
          display: true,
          text: "User Plan Distribution",
          color: "#111",
          font: { size: 14, weight: "bold" },
        },
        doughnutlabel: {
          labels: [
            { text: String(totalUsers), font: { size: 26, weight: "bold" }, color: "#111" },
            { text: "Total Users", font: { size: 12 }, color: "#555" },
          ],
        },
      },
    },
  }

  return renderChartBuffer(config, 900, 520)
}

function buildChartCommentary(metric: string, current: number, previous: number, context: string): Paragraph {
  const text =
    previous > 0
      ? `${metric} ${current >= previous ? "increased" : "adjusted"} by ${Math.abs(((current - previous) / previous) * 100).toFixed(1)}% compared to the previous period. ${context}`
      : `${metric} established at ${current} in the platform's opening period. ${context}`

  return new Paragraph({
    children: [new TextRun({ text, size: 20, color: "555555", italics: true })],
    spacing: { before: 60, after: 160 },
    alignment: AlignmentType.CENTER,
  })
}

function buildNoteParagraph(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 20, after: 80 },
    children: [new TextRun({ text, font: "Arial", size: 19, color: "666666", italics: true })],
  })
}

function asPercent(numerator: number, denominator: number): string {
  if (denominator <= 0) return "0%"
  return `${((numerator / denominator) * 100).toFixed(1)}%`
}

function inferEventStatus(event: StakeholderReportData["topEvents"][number], now: Date): string {
  if (event.archived) return "Completed"
  if (event.status && ["completed", "closed"].includes(event.status.toLowerCase())) return "Completed"
  if (event.deadline && event.deadline < now) return "Closed"
  if (event.status) return event.status.charAt(0).toUpperCase() + event.status.slice(1)
  return "Active"
}

function eventFillRate(registrations: number, capacity: number | null): number | null {
  if (!capacity || capacity <= 0) return null
  return (registrations / capacity) * 100
}

function buildConversionPipelineTable(data: StakeholderReportData): Table {
  const totalRegistered = data.totalUsers
  const createdEventCount = data.createdEventOrganizers ?? 0
  const completedEventCount = data.completedEventOrganizers ?? 0
  const eligibleForProCount = data.eligibleForProOrganizers ?? 0
  const proSubscribers = data.proUsers
  const widths = [4360, 2500, 2500]

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      headerRow(["Stage", "Count", "Rate"], widths),
      dataRow(["Total Registered", totalRegistered.toLocaleString(), "100%"], widths),
      dataRow(["Created an Event", createdEventCount.toLocaleString(), asPercent(createdEventCount, totalRegistered)], widths, true),
      dataRow(["Ran Event to Completion", completedEventCount.toLocaleString(), asPercent(completedEventCount, totalRegistered)], widths),
      dataRow(["Eligible for Pro", eligibleForProCount.toLocaleString(), asPercent(eligibleForProCount, totalRegistered)], widths, true),
      dataRow(["Pro Subscribers", proSubscribers.toLocaleString(), asPercent(proSubscribers, totalRegistered)], widths),
    ],
  })
}

function buildEventActivityTable(data: StakeholderReportData): Table {
  const widths = [2800, 1560, 1260, 1260, 1240, 1240]
  const sorted = [...data.topEvents].sort((a, b) => b.registrations - a.registrations)
  const now = data.generatedAt

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      headerRow(["Event Name", "Organiser", "Registrations", "Capacity", "Fill Rate", "Status"], widths),
      ...sorted.map((event, index) => {
        const fillRate = eventFillRate(event.registrations, event.capacity)
        const highFill = fillRate !== null && fillRate > 80
        return new TableRow({
          children: [
            {
              text: event.title,
              align: AlignmentType.LEFT,
            },
            {
              text: event.organizer,
              align: AlignmentType.LEFT,
            },
            {
              text: event.registrations.toLocaleString(),
              align: AlignmentType.CENTER,
            },
            {
              text: event.capacity ? event.capacity.toLocaleString() : "Unlimited",
              align: AlignmentType.CENTER,
            },
            {
              text: fillRate === null ? "Unlimited" : `${fillRate.toFixed(1)}%`,
              align: AlignmentType.CENTER,
            },
            {
              text: inferEventStatus(event, now),
              align: AlignmentType.CENTER,
            },
          ].map((cell, i) =>
            new TableCell({
              width: { size: widths[i], type: WidthType.DXA },
              shading: { fill: index % 2 === 0 ? "F9FAFB" : WHITE, type: ShadingType.CLEAR },
              borders: {
                top: BORDER,
                bottom: BORDER,
                left: i === 0 && highFill ? { style: BorderStyle.SINGLE, size: 10, color: LIME } : BORDER,
                right: BORDER,
              },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [
                new Paragraph({
                  alignment: cell.align,
                  children: [new TextRun({ text: cell.text, font: "Arial", size: 19, color: "333333" })],
                }),
              ],
            }),
          ),
        })
      }),
    ],
  })
}

function buildSystemHealthTable(data: StakeholderReportData): Table {
  const widths = [1700, 1100, 2600, 2000, 1960]

  const rows =
    data.topErrors.length > 0
      ? data.topErrors.map((error, index) => {
          const classification = classifyError(error.route, error.message, error.count)
          return kpiDataRow(
            [
              error.route,
              error.count.toLocaleString(),
              classification.rootCause,
              { text: classification.severity, color: classification.color },
              classification.fix,
            ],
            widths,
            index % 2 === 1,
          )
        })
      : [
          kpiDataRow(
            [
              "No recurring route",
              "0",
              "No recurring root cause detected",
              { text: "LOW", color: "22C55E" },
              "No immediate fix required",
            ],
            widths,
            false,
          ),
        ]

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      headerRow(["Route", "Error Count", "Root Cause", "Severity", "Fix"], widths),
      ...rows,
    ],
  })
}

function buildEmailDeliveryLine(data: StakeholderReportData): string {
  const failed = data.failedEmailCount
  if (typeof data.emailsSent === "number" && data.emailsSent >= 0) {
    const successful = data.emailsSent
    const attempted = successful + failed
    const successRate = attempted > 0 ? ((successful / attempted) * 100).toFixed(1) : "100.0"
    return `Email delivery: ${successful.toLocaleString()} sent, ${failed.toLocaleString()} failed (${successRate}% success rate)`
  }
  return `Email delivery: telemetry unavailable for sent volume, ${failed.toLocaleString()} failed (success rate unavailable)`
}

function buildUptimeLine(data: StakeholderReportData): string | null {
  if (typeof data.uptimePercentage === "number") {
    return `Uptime: ${data.uptimePercentage.toFixed(2)}%`
  }
  return null
}

function chartBlock(title: string, chartBuffer: Buffer | null): Paragraph[] {
  if (!chartBuffer) {
    return [
      new Paragraph({
        spacing: { before: 40, after: 100 },
        children: [new TextRun({ text: `${title}: chart rendering unavailable for this run.`, font: "Arial", size: 20, color: GREY })],
      }),
    ]
  }

  return [
    new Paragraph({
      spacing: { before: 40, after: 90 },
      children: [new TextRun({ text: title, font: "Arial", size: 21, bold: true, color: NAVY })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 160 },
      children: [
        new ImageRun({
          type: "png",
          data: chartBuffer,
          transformation: { width: 590, height: 270 },
        }),
      ],
    }),
  ]
}

function parseStrategicRecommendations(text: string): RecommendationItem[] {
  const compact = text.replace(/\r/g, "").trim()
  const matches = [...compact.matchAll(/(?:^|\n)\s*(\d+)\.\s*\*\*(.+?)\*\*\s*\n([\s\S]*?)(?=(?:\n\s*\d+\.\s*\*\*)|$)/g)]

  if (matches.length === 4) {
    return matches.map(match => ({
      title: match[2].trim(),
      body: match[3].replace(/\n+/g, " ").replace(/\s+/g, " ").trim(),
    }))
  }

  const fallbackLines = compact
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 4)

  const fallback: RecommendationItem[] = fallbackLines.map((line, i) => {
    const noLead = line.replace(/^\d+\.\s*/, "")
    const parts = noLead.split(/[:.-]\s+/, 2)
    return {
      title: parts[0] || `Recommendation ${i + 1}`,
      body: parts[1] || noLead,
    }
  })

  while (fallback.length < 4) {
    fallback.push({
      title: `Recommendation ${fallback.length + 1}`,
      body: "Execute a targeted launch-stage action with a defined 30-day owner and milestone.",
    })
  }

  return fallback.slice(0, 4)
}

function renderStrategicRecommendations(items: RecommendationItem[]): Paragraph[] {
  return items.map((item, index) =>
    new Paragraph({
      spacing: { before: 25, after: 45 },
      children: [
        new TextRun({ text: `${index + 1}. `, font: "Arial", size: 21, color: "333333" }),
        new TextRun({ text: `${item.title} `, bold: true, font: "Arial", size: 21, color: "333333" }),
        new TextRun({ text: item.body, font: "Arial", size: 21, color: "333333" }),
      ],
    }),
  )
}

function heading(
  title: string,
  level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1,
): Paragraph {
  return new Paragraph({
    heading: level,
    children: [new TextRun({ text: title, font: "Arial", size: level === HeadingLevel.HEADING_1 ? 34 : 28, bold: true, color: NAVY })],
  })
}

function monthlySections(
  data: StakeholderReportData,
  userGrowthChart: Buffer | null,
  registrationsChart: Buffer | null,
  planChart: Buffer | null,
  recommendations: RecommendationItem[],
  executiveSummaryParagraphs: string[],
  monetisationNarrative: string,
): ReportChild[] {
  const rows = data.topEvents.slice(0, 10)
  const snapshots = getMonthlySnapshots(data)
  const currentUsers = snapshots[snapshots.length - 1]?.totalUsers ?? data.totalUsers
  const previousUsers = snapshots[snapshots.length - 2]?.totalUsers ?? 0
  const currentRegistrations = snapshots[snapshots.length - 1]?.registrations ?? data.newRegistrations
  const previousRegistrations = snapshots[snapshots.length - 2]?.registrations ?? 0
  const shortSeries = snapshots.length <= 2
  const freeOnlyPlanMix = data.proUsers === 0 && data.businessUsers === 0

  return [
    heading("Executive Summary"),
    ...renderExecutiveSummaryParagraphs(executiveSummaryParagraphs),
    buildKpiTable(data),
    new Paragraph({ spacing: { before: 200 }, children: [] }),

    heading("Platform Growth"),
    ...chartBlock("User Growth Since Launch", userGrowthChart),
    ...(shortSeries ? [buildNoteParagraph("Trend view available from month 3 onwards")] : []),
    buildChartCommentary(
      "Cumulative registered users",
      currentUsers,
      previousUsers,
      "This reflects organic launch-stage adoption as EventSlot expands from its Kenya base.",
    ),
    ...chartBlock("Monthly Registrations", registrationsChart),
    buildChartCommentary(
      "Monthly registrations",
      currentRegistrations,
      previousRegistrations,
      "This indicates evolving event participation patterns and organizer activation depth.",
    ),
    ...chartBlock("User Plan Distribution", planChart),
    ...(freeOnlyPlanMix
      ? [
          buildNoteParagraph(
            "All current users are on the Free plan. Pro and Business tier conversion is the primary commercial objective.",
          ),
        ]
      : []),
    buildChartCommentary(
      "Paid plan conversion",
      data.proUsers + data.businessUsers,
      Math.max(0, previousUsers > 0 ? Math.floor(previousUsers * 0.05) : 0),
      "Conversion progression remains a core monetisation milestone for the next operating cycle.",
    ),

    heading("Plan Mix & Monetisation Pipeline"),
    heading("Plan Distribution & Monetisation Pipeline", HeadingLevel.HEADING_2),
    ...chartBlock("Plan Distribution", planChart),
    new Paragraph({
      spacing: { before: 20, after: 100 },
      children: [
        new TextRun({
          text: monetisationNarrative,
          font: "Arial",
          size: 21,
          color: "333333",
        }),
      ],
    }),
    buildConversionPipelineTable(data),
    new Paragraph({ spacing: { before: 120, after: 180 }, children: [] }),

    heading("Event Activity"),
    ...(rows.length > 0
      ? [
          buildEventActivityTable(data),
        ]
      : [
          new Paragraph({
            spacing: { before: 80, after: 120 },
            children: [
              new TextRun({
                text:
                  "No new events were created during this period. " +
                  `The platform has ${data.totalEvents.toLocaleString()} events on record, ` +
                  `with ${data.activeEvents.toLocaleString()} currently active. ` +
                  "Pipeline activity is expected to increase as organisers complete onboarding.",
                font: "Arial",
                size: 22,
                color: "555555",
              }),
            ],
          }),
        ]),
    new Paragraph({ spacing: { before: 120, after: 160 }, children: [] }),

    heading("System Health"),
    heading("System Health & Reliability", HeadingLevel.HEADING_2),
    new Paragraph({
      spacing: { before: 20, after: 60 },
      children: [
        new TextRun({
          text: `Overall health score: ${assessSystemHealth(data).scoreLabel}`,
          font: "Arial",
          size: 22,
          bold: true,
          color: assessSystemHealth(data).score === "CRITICAL" ? "EF4444" : assessSystemHealth(data).score === "GOOD" ? "22C55E" : "F59E0B",
        }),
      ],
    }),
    ...(buildUptimeLine(data)
      ? [
          new Paragraph({
            spacing: { before: 0, after: 40 },
            children: [new TextRun({ text: buildUptimeLine(data) as string, font: "Arial", size: 21, color: "333333" })],
          }),
        ]
      : []),
    new Paragraph({
      spacing: { before: 0, after: 40 },
      children: [new TextRun({ text: buildEmailDeliveryLine(data), font: "Arial", size: 21, color: "333333" })],
    }),
    new Paragraph({
      spacing: { before: 0, after: 100 },
      children: [
        new TextRun({
          text: buildSystemHealthSummaryParagraph(data, assessSystemHealth(data)),
          font: "Arial",
          size: 21,
          color: "333333",
        }),
      ],
    }),
    buildSystemHealthTable(data),
    new Paragraph({ spacing: { before: 120, after: 160 }, children: [] }),

    heading("AI Strategic Recommendations"),
    ...renderStrategicRecommendations(recommendations),
    new Paragraph({ spacing: { before: 80, after: 120 }, children: [] }),

    heading("Next Period Targets"),
    buildNextPeriodTargetsTable(data),
  ]
}

function yearlySections(
  data: StakeholderReportData,
  userGrowthChart: Buffer | null,
  registrationsChart: Buffer | null,
  planChart: Buffer | null,
  recommendations: RecommendationItem[],
  executiveSummaryParagraphs: string[],
  monetisationNarrative: string,
  yearAheadOutlookParagraphs: string[],
): ReportChild[] {
  const rows = data.topEvents.slice(0, 10)
  const snapshots = getMonthlySnapshots(data)
  const currentUsers = snapshots[snapshots.length - 1]?.totalUsers ?? data.totalUsers
  const previousUsers = snapshots[snapshots.length - 2]?.totalUsers ?? 0
  const currentRegistrations = snapshots[snapshots.length - 1]?.registrations ?? data.newRegistrations
  const previousRegistrations = snapshots[snapshots.length - 2]?.registrations ?? 0
  const shortSeries = snapshots.length <= 2
  const freeOnlyPlanMix = data.proUsers === 0 && data.businessUsers === 0

  return [
    heading("Year in Review"),
    new Paragraph({
      spacing: { before: 80, after: 180 },
      children: [new TextRun({ text: buildYearInReviewNarrative(data), font: "Arial", size: 22, color: "333333" })],
    }),

    heading("Executive Summary"),
    ...renderExecutiveSummaryParagraphs(executiveSummaryParagraphs),
    buildKpiTable(data),
    new Paragraph({ spacing: { before: 200, after: 100 }, children: [] }),

    heading("Platform Growth"),
    ...chartBlock("User Growth Since Launch", userGrowthChart),
    ...(shortSeries ? [buildNoteParagraph("Trend view available from month 3 onwards")] : []),
    buildChartCommentary(
      "Cumulative registered users",
      currentUsers,
      previousUsers,
      "This chart reflects baseline establishment from launch and early market discovery.",
    ),
    ...chartBlock("Monthly Registrations", registrationsChart),
    buildChartCommentary(
      "Monthly registrations",
      currentRegistrations,
      previousRegistrations,
      "This shows demand progression as organizers and attendees repeat usage across months.",
    ),
    ...chartBlock("User Plan Distribution", planChart),
    ...(freeOnlyPlanMix
      ? [
          buildNoteParagraph(
            "All current users are on the Free plan. Pro and Business tier conversion is the primary commercial objective.",
          ),
        ]
      : []),
    buildChartCommentary(
      "Paid plan conversion",
      data.proUsers + data.businessUsers,
      Math.max(0, previousUsers > 0 ? Math.floor(previousUsers * 0.05) : 0),
      "Commercial scale-up depends on lifting conversion from free usage into Pro and Business tiers.",
    ),

    heading("Top Events of the Year"),
    ...(rows.length > 0
      ? [
          buildEventActivityTable(data),
        ]
      : [
          new Paragraph({
            spacing: { before: 80, after: 120 },
            children: [new TextRun({ text: "No events this period.", font: "Arial", size: 22, color: GREY, italics: true })],
          }),
        ]),
    new Paragraph({ spacing: { before: 120, after: 100 }, children: [] }),

    heading("Plan Mix & Monetisation Pipeline"),
    heading("Plan Distribution & Monetisation Pipeline", HeadingLevel.HEADING_2),
    ...chartBlock("Plan Distribution", planChart),
    new Paragraph({
      spacing: { before: 20, after: 100 },
      children: [
        new TextRun({
          text: monetisationNarrative,
          font: "Arial",
          size: 21,
          color: "333333",
        }),
      ],
    }),
    buildConversionPipelineTable(data),
    new Paragraph({ spacing: { before: 120, after: 140 }, children: [] }),

    heading("System Health Summary"),
    heading("System Health & Reliability", HeadingLevel.HEADING_2),
    new Paragraph({
      spacing: { before: 20, after: 60 },
      children: [
        new TextRun({
          text: `Overall health score: ${assessSystemHealth(data).scoreLabel}`,
          font: "Arial",
          size: 22,
          bold: true,
          color: assessSystemHealth(data).score === "CRITICAL" ? "EF4444" : assessSystemHealth(data).score === "GOOD" ? "22C55E" : "F59E0B",
        }),
      ],
    }),
    ...(buildUptimeLine(data)
      ? [
          new Paragraph({
            spacing: { before: 0, after: 40 },
            children: [new TextRun({ text: buildUptimeLine(data) as string, font: "Arial", size: 21, color: "333333" })],
          }),
        ]
      : []),
    new Paragraph({
      spacing: { before: 0, after: 40 },
      children: [new TextRun({ text: buildEmailDeliveryLine(data), font: "Arial", size: 21, color: "333333" })],
    }),
    new Paragraph({
      spacing: { before: 0, after: 100 },
      children: [
        new TextRun({
          text: buildSystemHealthSummaryParagraph(data, assessSystemHealth(data)),
          font: "Arial",
          size: 21,
          color: "333333",
        }),
      ],
    }),
    buildSystemHealthTable(data),
    new Paragraph({ spacing: { before: 120, after: 140 }, children: [] }),

    heading("AI Strategic Recommendations"),
    ...renderStrategicRecommendations(recommendations),
    new Paragraph({ spacing: { before: 80, after: 100 }, children: [] }),

    heading("Year-Ahead Outlook"),
    ...yearAheadOutlookParagraphs.map((paragraph, index) =>
      new Paragraph({
        spacing: { before: index === 0 ? 20 : 30, after: 40 },
        children: [new TextRun({ text: paragraph, font: "Arial", size: 21, color: "333333" })],
      }),
    ),
  ]
}

function buildCoverPage(data: StakeholderReportData): Paragraph[] {
  const reportType = reportTypeLabel(data.period)
  const period = displayPeriodLabel(data)

  let logoData: Buffer | null = null
  try {
    logoData = fs.readFileSync(path.join(process.cwd(), "public", "assets", "logo.png"))
  } catch { /* logo optional */ }

  return [
    ...(logoData
      ? [new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: 600, after: 160 },
          children: [new ImageRun({ type: "png", data: logoData, transformation: { width: 52, height: 52 } })],
        })]
      : [new Paragraph({ spacing: { before: 600, after: 160 }, children: [] })]
    ),
    new Paragraph({
      children: [
        new TextRun({ text: "Event", bold: true, size: 52, color: "000000" }),
        new TextRun({ text: "Slot", bold: true, size: 52, color: LIME }),
      ],
      spacing: { before: 0, after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: reportType.toUpperCase(), bold: true, size: 32, color: DARK })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: period.toUpperCase(), bold: true, size: 48, color: "000000" })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Generated ${format(data.generatedAt, "d MMMM yyyy")}`, size: 20, color: "666666", italics: true })],
      spacing: { after: 400 },
    }),
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: LIME } },
      spacing: { after: 200 },
      children: [new TextRun("")],
    }),
    new Paragraph({
      children: [new TextRun({ text: "Smarter Events. Better Experiences.", italics: true, size: 22, color: "888888" })],
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "This document is confidential and intended for authorised recipients only.",
          size: 18,
          color: "AAAAAA",
        }),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ]
}

export async function generateStakeholderReport(data: StakeholderReportData): Promise<Buffer> {
  const launch = isLaunchPhase(data)
  const executiveSummaryParagraphs = await generateExecutiveSummaryParagraphs(data)
  const monetisationNarrative = await generateMonetisationNarrative(data)
  const yearAheadOutlookParagraphs = await generateYearAheadOutlookParagraphs(data)
  const recommendationsText =
    (await askAI({
      system:
        "You are generating the strategic recommendations section of an EventSlot stakeholder report. EventSlot is a smart event registration and waitlist management platform, launched 15 April 2026 in Kenya. You must generate exactly 4 recommendations.",
      prompt: `EventSlot report context (${displayPeriodLabel(data)}):
Inject all report metrics:
- Total users: ${data.totalUsers}
- New users: ${data.newUsers}
- Previous period users: ${data.prevNewUsers}
- Total events: ${data.totalEvents}
- New events: ${data.newEvents}
- Total registrations: ${data.totalRegistrations}
- New registrations: ${data.newRegistrations}
- Active events: ${data.activeEvents}
- Revenue: ${currency(data.revenueKsh)}
- Errors: ${data.errorCount}
- Top errors: ${data.topErrors.map(error => `${error.route} (${error.count}) - ${error.message}`).join(" | ") || "none"}
- Plan mix: Free ${data.freeUsers}, Pro ${data.proUsers}, Business ${data.businessUsers}
- Conversion funnel: Created Event ${data.createdEventOrganizers ?? 0}, Completed Event ${data.completedEventOrganizers ?? 0}, Eligible for Pro ${data.eligibleForProOrganizers ?? 0}

Each recommendation must:
1. Reference at least one specific data point from this report.
2. Name a specific action.
3. Include a timeframe (for example, within 30 days, before end of Q3 2026).
4. Be relevant to EventSlot's early-launch stage, Kenya market, and freemium model.

You must NOT:
- Recommend increasing server capacity by fixed percentages.
- Suggest exploring undefined revenue streams.
- Use vague phrases like leverage this success or synergistic opportunities.
- Give advice that could apply to any SaaS product.

Tone: direct, specific, actionable for investors.
Format exactly as:
1. **Title**
2-3 sentences.

2. **Title**
2-3 sentences.

3. **Title**
2-3 sentences.

4. **Title**
2-3 sentences.`,
      taskType: "qa",
      maxTokens: 520,
    })) ??
    "1. **Activate Pro Conversion Trigger for High-Volume Organisers**\nWithin 30 days, target organisers who have crossed 30 registrations with a personalised Pro trial offer and product walkthrough. This directly addresses the current gap between Free usage and first Pro conversion while using existing activation data.\n\n2. **Resolve Configuration-Led Error Cluster**\nWithin 7 days, patch missing environment-key configuration in production and verify AI endpoints through a smoke-check run. This eliminates configuration-driven error concentration and restores recommendation-quality features tied to upgrade value.\n\n3. **Increase Event Completion Through Guided Ops**\nBefore the end of the next reporting period, launch an organiser operations checklist that pushes active events to completion milestones. This improves the completed-event funnel stage used for Pro eligibility and commercial qualification.\n\n4. **Deploy Kenya-Centric Conversion Campaign**\nWithin 30 days, run a Kenya-focused upgrade campaign highlighting Pro features for organisers with repeat events. This is the fastest path to first predictable paid conversion under the current freemium model."

  const strategicRecommendations = parseStrategicRecommendations(recommendationsText)

  const [userGrowthChart, registrationsChart, planChart] = await Promise.all([
    buildUserGrowthChart(data),
    buildMonthlyRegistrationsChart(data),
    buildPlanMixChart(data),
  ])

  const bodySections: ReportChild[] = data.period === "yearly"
    ? yearlySections(
        data,
        userGrowthChart,
        registrationsChart,
        planChart,
        strategicRecommendations,
        executiveSummaryParagraphs,
        monetisationNarrative,
        yearAheadOutlookParagraphs,
      )
    : monthlySections(data, userGrowthChart, registrationsChart, planChart, strategicRecommendations, executiveSummaryParagraphs, monetisationNarrative)

  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 22 } } },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 34, bold: true, font: "Arial", color: NAVY },
          paragraph: { spacing: { before: 360, after: 180 }, outlineLevel: 0 },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 28, bold: true, font: "Arial", color: NAVY },
          paragraph: { spacing: { before: 260, after: 120 }, outlineLevel: 1 },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
          },
        },
        headers: {
          default: (() => {
            let logoHdr: Buffer | null = null
            try { logoHdr = fs.readFileSync(path.join(process.cwd(), "public", "assets", "logo.png")) } catch { /* optional */ }
            return new Header({
              children: [
                new Paragraph({
                  border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LIME, space: 4 } },
                  spacing: { before: 0, after: 80 },
                  alignment: AlignmentType.LEFT,
                  children: [
                    ...(logoHdr ? [new ImageRun({ type: "png", data: logoHdr, transformation: { width: 28, height: 28 } })] : []),
                    new TextRun({ text: logoHdr ? "  " : "", font: "Arial", size: 18 }),
                    new TextRun({ text: "Event", bold: true, size: 22, color: "000000", font: "Arial" }),
                    new TextRun({ text: "Slot", bold: true, size: 22, color: LIME, font: "Arial" }),
                  ],
                }),
              ],
            })
          })(),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                border: { top: { style: BorderStyle.SINGLE, size: 4, color: LIME, space: 4 } },
                spacing: { before: 120, after: 0 },
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "EventSlot · ", font: "Arial", size: 16, color: "888888" }),
                  new TextRun({ text: "www.eventsslot.com", font: "Arial", size: 16, color: "888888" }),
                  new TextRun({ text: " · Confidential · Page ", font: "Arial", size: 16, color: "888888" }),
                  new TextRun({ children: [PageNumber.CURRENT] }),
                  new TextRun({ text: " of ", font: "Arial", size: 16, color: "888888" }),
                  new SimpleField("NUMPAGES"),
                ],
              }),
            ],
          }),
        },
        children: [...buildCoverPage(data), ...bodySections],
      },
    ],
  })

  return Packer.toBuffer(doc)
}