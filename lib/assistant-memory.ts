import { prisma } from "@/lib/prisma"
import { groq } from "@/lib/groq"

type SessionMessage = { role: string; content: string }

type MemoryKeyFacts = {
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
  return {
    summary: typeof data.summary === "string" ? data.summary : "No summary available.",
    keyFacts: {
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
    },
  }
}

// Check if memory is enabled for user.
export async function isMemoryEnabled(userId: string): Promise<boolean> {
  const pref = await prisma.userMemoryPreference.findUnique({
    where: { userId },
    select: { memoryEnabled: true },
  })
  return pref?.memoryEnabled ?? false
}

// Toggle memory on/off. Turning memory off also clears stored memory.
export async function setMemoryEnabled(userId: string, enabled: boolean): Promise<void> {
  await prisma.userMemoryPreference.upsert({
    where: { userId },
    create: { userId, memoryEnabled: enabled },
    update: { memoryEnabled: enabled },
  })

  if (!enabled) {
    await prisma.userMemory.deleteMany({ where: { userId } })
  }
}

// Load memory and return formatted context block for prompt injection.
export async function loadMemory(userId: string): Promise<string | null> {
  const memory = await prisma.userMemory.findUnique({
    where: { userId },
    select: { summary: true, keyFacts: true, sessionCount: true },
  })

  if (!memory) return null

  const factsRaw = memory.keyFacts as Record<string, unknown>
  const facts: MemoryKeyFacts = {
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
  }

  return `
═══════════════════════════════════════════════
MEMORY OF THIS USER (from ${memory.sessionCount} previous session${memory.sessionCount !== 1 ? "s" : ""})
═══════════════════════════════════════════════
${memory.summary}

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
  const enabled = await isMemoryEnabled(userId)
  if (!enabled) return

  const existing = await prisma.userMemory.findUnique({ where: { userId } })

  const conversationText = sessionMessages
    .map((m) => `${m.role === "USER" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n")
    .substring(0, 4000)

  const existingSummary = existing?.summary ?? "No previous history."
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
  await prisma.userMemory.deleteMany({ where: { userId } })
}
