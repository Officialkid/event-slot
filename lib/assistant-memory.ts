import { prisma } from "@/lib/prisma"
import { groq } from "@/lib/groq"
import { Prisma } from "@prisma/client"

export type SessionMessage = { role: string; content: string }

export type MemoryKeyFacts = {
  name: string | null
  role: "organiser" | "attendee" | "both" | "unknown"
  recentEvents: string[]
  preferredLanguage: "english" | "swahili" | "unknown"
  commonIssues: string[]
  preferences: string | null
}

type MemoryUpdatePayload = {
  summary: string
  keyFacts: MemoryKeyFacts
}

const SECRET_PATTERNS: RegExp[] = [
  /\b(?:sk|gsk|pk|rk)_[a-zA-Z0-9_-]{12,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/gi,
  /\b(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|private[_-]?key)\s*[:=]\s*\S+/gi,
]

const PAYMENT_CARD_PATTERN = /\b(?:\d[ -]*?){13,19}\b/g
const PIN_CVV_PATTERN = /\b(?:cvv|cvc|mpesa\s*pin|payment\s*pin|pin)\s*[:=]?\s*\d{3,6}\b/gi
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const PHONE_PATTERN = /(?:\+?254|0)(?:7|1)\d{8}\b/g

/**
 * Redacts obvious secrets, credentials, payment card/PIN patterns, and raw
 * email/phone PII before storing or injecting assistant memory.
 * Note: Heuristic sanitization reduces accidental retention of sensitive data
 * and attendee PII, though it does not replace upstream access controls.
 */
export function sanitizeMemoryText(text: string): string {
  if (!text || typeof text !== "string") return ""
  let sanitized = text

  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[REDACTED_SECRET]")
  }

  sanitized = sanitized.replace(PIN_CVV_PATTERN, "[REDACTED_PIN]")
  sanitized = sanitized.replace(PAYMENT_CARD_PATTERN, "[REDACTED_CARD]")
  sanitized = sanitized.replace(EMAIL_PATTERN, "[REDACTED_EMAIL]")
  sanitized = sanitized.replace(PHONE_PATTERN, "[REDACTED_PHONE]")

  return sanitized.trim()
}

export function sanitizeMemoryKeyFacts(facts: MemoryKeyFacts): MemoryKeyFacts {
  return {
    name: facts.name ? sanitizeMemoryText(facts.name) : null,
    role: facts.role,
    recentEvents: facts.recentEvents.map((item) => sanitizeMemoryText(item)).filter(Boolean),
    preferredLanguage: facts.preferredLanguage,
    commonIssues: facts.commonIssues.map((item) => sanitizeMemoryText(item)).filter(Boolean),
    preferences: facts.preferences ? sanitizeMemoryText(facts.preferences) : null,
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

function parseMemoryUpdate(raw: string): MemoryUpdatePayload {
  const json = raw.replace(/```json|```/g, "").trim()
  const data = JSON.parse(json) as {
    summary?: unknown
    keyFacts?: Record<string, unknown>
  }

  const keyFacts = data.keyFacts ?? {}
  const rawSummary = typeof data.summary === "string" ? data.summary : "No summary available."
  const rawFacts: MemoryKeyFacts = {
    name: typeof keyFacts.name === "string" ? keyFacts.name : null,
    role:
      keyFacts.role === "organiser" ||
      keyFacts.role === "attendee" ||
      keyFacts.role === "both" ||
      keyFacts.role === "unknown"
        ? keyFacts.role
        : "unknown",
    recentEvents: asStringArray(keyFacts.recentEvents),
    preferredLanguage:
      keyFacts.preferredLanguage === "english" ||
      keyFacts.preferredLanguage === "swahili" ||
      keyFacts.preferredLanguage === "unknown"
        ? keyFacts.preferredLanguage
        : "unknown",
    commonIssues: asStringArray(keyFacts.commonIssues),
    preferences: typeof keyFacts.preferences === "string" ? keyFacts.preferences : null,
  }

  return {
    summary: sanitizeMemoryText(rawSummary) || "No summary available.",
    keyFacts: sanitizeMemoryKeyFacts(rawFacts),
  }
}

function isMissingColumnError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2022"
  )
}

// Check if memory is enabled for user.
export async function isMemoryEnabled(userId: string): Promise<boolean> {
  if (!userId || typeof userId !== "string") return false

  try {
    const pref = await prisma.userMemoryPreference.findUnique({
      where: { userId },
      select: { memoryEnabled: true },
    })
    return pref?.memoryEnabled === true
  } catch (error) {
    if (isMissingColumnError(error)) return false
    throw error
  }
}

// Toggle memory on/off. Turning memory off transactionally clears stored memory for that user.
export async function setMemoryEnabled(userId: string, enabled: boolean): Promise<boolean> {
  if (!userId || typeof userId !== "string") {
    throw new Error("Valid userId is required to update memory preference")
  }

  const normalizedEnabled = Boolean(enabled)

  try {
    if (!normalizedEnabled) {
      if (typeof prisma.$transaction === "function") {
        await prisma.$transaction([
          prisma.userMemoryPreference.upsert({
            where: { userId },
            create: { userId, memoryEnabled: false },
            update: { memoryEnabled: false },
          }),
          prisma.userMemory.deleteMany({ where: { userId } }),
        ])
      } else {
        await prisma.userMemoryPreference.upsert({
          where: { userId },
          create: { userId, memoryEnabled: false },
          update: { memoryEnabled: false },
        })
        await prisma.userMemory.deleteMany({ where: { userId } })
      }
      return false
    }

    const pref = await prisma.userMemoryPreference.upsert({
      where: { userId },
      create: { userId, memoryEnabled: true },
      update: { memoryEnabled: true },
    })
    return pref?.memoryEnabled ?? true
  } catch (error) {
    if (isMissingColumnError(error)) return false
    throw error
  }
}

/**
 * Shared preference resolver/updater used by both `/api/assistant/memory` and `/api/user/memory`.
 */
export async function resolveAndUpdateMemoryPreference(
  userId: string,
  inputEnabled?: boolean
): Promise<boolean> {
  if (typeof inputEnabled === "boolean") {
    return setMemoryEnabled(userId, inputEnabled)
  }
  return isMemoryEnabled(userId)
}

// Load memory and return formatted context block for prompt injection.
export async function loadMemory(userId: string): Promise<string | null> {
  if (!userId || typeof userId !== "string") return null

  // Enforce opt-out guard: disabled memory is never loaded into assistant prompts.
  const enabled = await isMemoryEnabled(userId)
  if (!enabled) return null

  const memory = await prisma.userMemory.findUnique({
    where: { userId },
    select: { summary: true, keyFacts: true, sessionCount: true },
  })

  if (!memory) return null

  const factsRaw = (memory.keyFacts as Record<string, unknown> | null) ?? {}
  const facts = sanitizeMemoryKeyFacts({
    name: typeof factsRaw.name === "string" ? factsRaw.name : null,
    role:
      factsRaw.role === "organiser" ||
      factsRaw.role === "attendee" ||
      factsRaw.role === "both" ||
      factsRaw.role === "unknown"
        ? factsRaw.role
        : "unknown",
    recentEvents: asStringArray(factsRaw.recentEvents),
    preferredLanguage:
      factsRaw.preferredLanguage === "english" ||
      factsRaw.preferredLanguage === "swahili" ||
      factsRaw.preferredLanguage === "unknown"
        ? factsRaw.preferredLanguage
        : "unknown",
    commonIssues: asStringArray(factsRaw.commonIssues),
    preferences: typeof factsRaw.preferences === "string" ? factsRaw.preferences : null,
  })

  const sanitizedSummary = sanitizeMemoryText(memory.summary)

  return `
═══════════════════════════════════════════════
MEMORY OF THIS USER (from ${memory.sessionCount} previous session${memory.sessionCount !== 1 ? "s" : ""})
═══════════════════════════════════════════════
${sanitizedSummary}

Key facts:
${facts.name ? `- Name: ${facts.name}` : ""}
${facts.role ? `- Role on EventSlot: ${facts.role}` : ""}
${facts.recentEvents.length ? `- Their recent events: ${facts.recentEvents.join(", ")}` : ""}
${facts.preferredLanguage ? `- Preferred language: ${facts.preferredLanguage}` : ""}
${facts.commonIssues.length ? `- Issues they've had before: ${facts.commonIssues.join(", ")}` : ""}
${facts.preferences ? `- Known preferences: ${facts.preferences}` : ""}

Use this context to give more personalised responses.
Do not explicitly say "I remember that..." unless directly relevant.
Weave the context naturally into responses.
═══════════════════════════════════════════════
`
}

// Update memory after a session ends.
export async function updateMemoryAfterSession(
  userId: string,
  sessionMessages: SessionMessage[]
): Promise<void> {
  if (!userId || typeof userId !== "string") return

  const enabled = await isMemoryEnabled(userId)
  if (!enabled) return

  const existing = await prisma.userMemory.findUnique({ where: { userId } })

  const conversationText = sanitizeMemoryText(
    sessionMessages
      .map((m) => `${m.role === "USER" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n")
      .substring(0, 4000)
  )

  const existingSummary = existing?.summary ? sanitizeMemoryText(existing.summary) : "No previous history."
  const existingFacts = (existing?.keyFacts as Record<string, unknown> | null) ?? {}

  const updatePrompt = `
You are updating a memory profile for an EventSlot user.

EXISTING MEMORY:
${existingSummary}

EXISTING KEY FACTS:
${JSON.stringify(existingFacts, null, 2)}

NEW CONVERSATION:
${conversationText}

Update the memory profile. Extract and preserve:
1. The user's name if mentioned
2. Their role (organiser, attendee, or both)
3. Events they mentioned or manage (event names/titles)
4. Their preferred language (English or Swahili)
5. Issues they encountered and whether resolved
6. Their preferences or patterns

Do NOT include passwords, API keys, payment card numbers, PINs, phone numbers, or email addresses.

Return ONLY valid JSON in this exact format, nothing else:
{
  "summary": "2-3 sentence summary of who this user is and their history with EventSlot",
  "keyFacts": {
    "name": "string or null",
    "role": "organiser | attendee | both | unknown",
    "recentEvents": ["event name 1", "event name 2"],
    "preferredLanguage": "english | swahili | unknown",
    "commonIssues": ["issue 1", "issue 2"],
    "preferences": "string describing known preferences or null"
  }
}
`

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: updatePrompt }],
      max_tokens: 400,
      temperature: 0.2,
    })

    const raw = completion.choices[0]?.message?.content ?? ""
    const data = parseMemoryUpdate(raw)

    // Re-check preference before persisting in case the user disabled memory mid-flight.
    const stillEnabled = await isMemoryEnabled(userId)
    if (!stillEnabled) return

    await prisma.userMemory.upsert({
      where: { userId },
      create: {
        userId,
        summary: data.summary,
        keyFacts: data.keyFacts,
        sessionCount: 1,
      },
      update: {
        summary: data.summary,
        keyFacts: data.keyFacts,
        sessionCount: { increment: 1 },
      },
    })
  } catch (error) {
    console.error("[EventSlot Memory] Failed to update memory:", error)
    // Memory update failure is non-critical — session continues normally.
  }
}

// Clear memory on explicit user request.
export async function clearMemory(userId: string): Promise<void> {
  if (!userId || typeof userId !== "string") return
  await prisma.userMemory.deleteMany({ where: { userId } })
}
