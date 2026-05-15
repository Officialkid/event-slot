import { promises as fs } from 'fs'
import path from 'path'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

type DocChunk = {
  source: string
  text: string
  terms: Set<string>
}

type EventInsightItem = {
  title: string
  slug: string
  capacity: number | null
  confirmedCount: number
  waitlistCount: number
  fillRateText: string
  deadlineText: string
  peakPattern: string
  proactiveTip: string
}

const SWAHILI_HINTS = new Set([
  'habari',
  'asante',
  'tafadhali',
  'naomba',
  'msaada',
  'karibu',
  'nina',
  'niko',
  'sawa',
  'ndio',
  'hapana',
  'tukio',
  'usajili',
  'orodha',
  'kusubiri',
  'nimeshindwa',
  'inawezekana',
  'samahani',
])

const DOC_SOURCES = ['docs/AI_CONTEXT.md', 'docs/FEATURES.md', 'docs/API.md'] as const

let docsCache: { loadedAt: number; chunks: DocChunk[] } | null = null

function normalizeTerms(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3)
}

function toObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function truncate(text: string, length: number): string {
  if (text.length <= length) return text
  return `${text.slice(0, Math.max(0, length - 3)).trimEnd()}...`
}

function buildProactiveTip(fillRate: number | null, waitlistCount: number, deadline: Date | null): string {
  const now = Date.now()
  const hoursToDeadline = deadline ? Math.floor((deadline.getTime() - now) / (1000 * 60 * 60)) : null

  if (fillRate !== null && fillRate >= 95) {
    return 'You are nearly full. Consider increasing slots or keeping waitlist enabled so demand is not lost.'
  }

  if (waitlistCount > 0) {
    return 'Waitlist demand is active. Share your link now and monitor promotions so queued attendees convert quickly.'
  }

  if (hoursToDeadline !== null && hoursToDeadline <= 72) {
    return 'Deadline is close. Share one final reminder now to capture late registrations.'
  }

  if (fillRate !== null && fillRate < 40) {
    return 'Fill rate is still low. Share during your strongest signup window and repost in two short bursts this week.'
  }

  return 'Keep sharing in short, timed bursts around your highest activity periods to improve conversion.'
}

function detectPeakPattern(registrations: Array<{ submittedAt: Date }>): string {
  if (registrations.length === 0) {
    return 'No registration timing pattern yet.'
  }

  const byHour: Record<number, number> = {}
  const byWeekday: Record<number, number> = {}

  for (const reg of registrations) {
    const d = new Date(reg.submittedAt)
    const hour = d.getHours()
    const day = d.getDay()
    byHour[hour] = (byHour[hour] ?? 0) + 1
    byWeekday[day] = (byWeekday[day] ?? 0) + 1
  }

  const bestHour = Object.entries(byHour).sort((a, b) => b[1] - a[1])[0]
  const bestDay = Object.entries(byWeekday).sort((a, b) => b[1] - a[1])[0]
  const weekdayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][Number(bestDay?.[0] ?? 0)]

  if (!bestHour || !bestDay) {
    return 'No registration timing pattern yet.'
  }

  return `Most activity happens on ${weekdayName} around ${String(bestHour[0]).padStart(2, '0')}:00.`
}

async function loadDocsChunks(): Promise<DocChunk[]> {
  if (docsCache && Date.now() - docsCache.loadedAt < 5 * 60 * 1000) {
    return docsCache.chunks
  }

  const root = process.cwd()
  const chunks: DocChunk[] = []

  for (const source of DOC_SOURCES) {
    const filePath = path.join(root, source)
    try {
      const content = await fs.readFile(filePath, 'utf8')
      const sections = content
        .split(/\n\s*\n/g)
        .map((s) => s.trim())
        .filter((s) => s.length >= 80)

      for (const section of sections) {
        const terms = new Set(normalizeTerms(section))
        chunks.push({ source, text: section, terms })
      }
    } catch {
      // Skip docs that are not available in this environment.
    }
  }

  docsCache = { loadedAt: Date.now(), chunks }
  return chunks
}

export function isSwahiliText(text: string): boolean {
  const terms = normalizeTerms(text)
  if (terms.length === 0) return false

  let hits = 0
  for (const term of terms) {
    if (SWAHILI_HINTS.has(term)) {
      hits += 1
      if (hits >= 2) return true
    }
  }

  return /\b(je|kwa|hii|hilo|vipi)\b/i.test(text) && hits >= 1
}

export async function getDocsRagContext(query: string): Promise<string> {
  const queryTerms = normalizeTerms(query)
  if (queryTerms.length === 0) return ''

  const chunks = await loadDocsChunks()
  if (chunks.length === 0) return ''

  const scored = chunks
    .map((chunk) => {
      const overlap = queryTerms.reduce((acc, term) => acc + (chunk.terms.has(term) ? 1 : 0), 0)
      return { chunk, score: overlap }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  if (scored.length === 0) return ''

  const lines = scored.map((entry, idx) => {
    const snippet = truncate(entry.chunk.text.replace(/\s+/g, ' '), 240)
    return `${idx + 1}. [${entry.chunk.source}] ${snippet}`
  })

  return `Relevant docs context (cite softly in plain language, do not invent details):\n${lines.join('\n')}`
}

export async function getLiveEventInsightsContext(userId: string, userEmail: string | null | undefined): Promise<string> {
  try {
    const events = await prisma.event.findMany({
      where: {
        OR: [
          { organizerId: userId },
          ...(userEmail ? [{ organizerEmail: userEmail }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        title: true,
        slug: true,
        capacity: true,
        confirmedCount: true,
        waitlistCount: true,
        deadline: true,
        registrations: {
          select: { submittedAt: true },
          orderBy: { submittedAt: 'desc' },
          take: 300,
        },
      },
    })

    if (events.length === 0) {
      return ''
    }

    const insightItems: EventInsightItem[] = events.map((event) => {
      const fillRate = event.capacity && event.capacity > 0
        ? Math.round((Math.max(0, Math.min(event.confirmedCount, event.capacity)) / event.capacity) * 100)
        : null

      return {
        title: event.title,
        slug: event.slug,
        capacity: event.capacity,
        confirmedCount: event.confirmedCount,
        waitlistCount: event.waitlistCount,
        fillRateText: fillRate === null ? 'N/A (no capacity set)' : `${fillRate}%`,
        deadlineText: event.deadline ? event.deadline.toISOString() : 'No deadline set',
        peakPattern: detectPeakPattern(event.registrations),
        proactiveTip: buildProactiveTip(fillRate, event.waitlistCount, event.deadline),
      }
    })

    const lines = insightItems.map((item, idx) => {
      return [
        `${idx + 1}. Event ${item.title} (${item.slug})`,
        `   - Confirmed: ${item.confirmedCount}`,
        `   - Waitlist: ${item.waitlistCount}`,
        `   - Capacity: ${item.capacity ?? 'Not set'}`,
        `   - Fill rate: ${item.fillRateText}`,
        `   - Deadline: ${item.deadlineText}`,
        `   - Pattern: ${item.peakPattern}`,
        `   - Tip: ${item.proactiveTip}`,
      ].join('\n')
    })

    return [
      'Owned event insights (only discuss these events; never claim platform-wide or other-organiser data):',
      ...lines,
    ].join('\n')
  } catch {
    return ''
  }
}

export async function resolveMemoryPreference(
  userId: string,
  inputEnabled?: boolean,
): Promise<boolean> {
  try {
    if (typeof inputEnabled === 'boolean') {
      const pref = await prisma.userMemoryPreference.upsert({
        where: { userId },
        update: { memoryEnabled: inputEnabled },
        create: { userId, memoryEnabled: inputEnabled },
      })
      return pref.memoryEnabled
    }

    const pref = await prisma.userMemoryPreference.findUnique({ where: { userId } })
    return Boolean(pref?.memoryEnabled)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2022') {
      return false
    }
    throw error
  }
}

export async function getMemoryContext(userId: string, memoryEnabled: boolean): Promise<string> {
  if (!memoryEnabled) return ''

  try {
    const memory = await prisma.userMemory.findUnique({ where: { userId } })
    if (!memory?.summary) return ''

    return `User memory summary (only use if relevant, never mention hidden storage): ${truncate(memory.summary, 900)}`
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2022') {
      return ''
    }
    throw error
  }
}

export async function updateUserMemory(params: {
  userId: string
  sessionId: string
  userMessage: string
  assistantReply: string
  preferredLanguage: 'sw' | 'en'
}): Promise<void> {
  const { userId, sessionId, userMessage, assistantReply, preferredLanguage } = params

  try {
    const existing = await prisma.userMemory.findUnique({ where: { userId } })
    const existingFacts = toObject(existing?.keyFacts)
    const previousSessionId = typeof existingFacts.lastSessionId === 'string' ? existingFacts.lastSessionId : null

    const previousIssues = Array.isArray(existingFacts.recentIssues)
      ? existingFacts.recentIssues.filter((item): item is string => typeof item === 'string')
      : []

    const issueHint = /error|failed|can't|cannot|problem|issue/i.test(userMessage)
      ? truncate(userMessage.replace(/\s+/g, ' '), 140)
      : null

    const recentIssues = issueHint
      ? [issueHint, ...previousIssues].slice(0, 5)
      : previousIssues.slice(0, 5)

    const updateStamp = `User asked: ${truncate(userMessage.replace(/\s+/g, ' '), 220)}\nAssistant replied: ${truncate(assistantReply.replace(/\s+/g, ' '), 260)}`

    const mergedSummary = existing?.summary
      ? truncate(`${existing.summary}\n${updateStamp}`, 1800)
      : updateStamp

    const nextSessionCount = existing
      ? existing.sessionCount + (previousSessionId === sessionId ? 0 : 1)
      : 1

    const keyFacts = {
      ...existingFacts,
      preferredLanguage,
      lastSessionId: sessionId,
      recentIssues,
      updatedAtIso: new Date().toISOString(),
    }

    await prisma.userMemory.upsert({
      where: { userId },
      update: {
        summary: mergedSummary,
        keyFacts,
        sessionCount: nextSessionCount,
      },
      create: {
        userId,
        summary: mergedSummary,
        keyFacts,
        sessionCount: 1,
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2022') {
      return
    }
    throw error
  }
}
