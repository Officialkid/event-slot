import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { groq, ASSISTANT_MODEL, VISION_MODEL, VISION_MODEL_FALLBACK } from "@/lib/groq"
import { EVENTSLOT_SYSTEM_PROMPT } from "@/lib/assistant-context"
import { consumeCredits } from "@/lib/chat-quota"
import { isMemoryEnabled, loadMemory, updateMemoryAfterSession } from "@/lib/assistant-memory"
import { isSwahiliText } from "@/lib/assistant-md4"
import { getEventInsights, getOrganizerEventSummaries } from "@/lib/event-insights"
import { buildDocsContext } from "@/lib/docs-context"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { rateLimit } from "@/lib/rate-limit"
import { Prisma } from "@prisma/client"

const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024
const MAX_IMAGES_PER_MESSAGE = 3
const FULL_REPORT_CTA =
  "For the full AI analysis and downloadable report, use Generate Report from your event dashboard (costs 20 tokens)."
const LATEST_UPDATES_REPLY =
  "For the latest EventSlot updates, check your notification bell in the dashboard or visit www.eventsslot.com. Is there something specific about the platform I can help you with?"

const VISION_SYSTEM_PROMPT = `
You are the EventSlot Customer Assistant.
Your job is to look at the screenshot the user has shared and help them.

If it shows an error:
1. Identify the error in plain English
2. Explain what caused it
3. Give specific steps to fix it within EventSlot

If it shows a UI section:
1. Explain what that section does
2. Guide them through the relevant action

If the image is not related to EventSlot:
"This doesn't appear to be an EventSlot screenshot. Feel free to
share a screenshot from EventSlot and I'll help explain it."

Always respond in English. Keep responses clear and under 150 words.
`.trim()

type AssistantContentPart =
  | { type: "image_url"; image_url: { url: string } }
  | { type: "text"; text: string }

type AssistantChatMessage =
  | {
      role: "user"
      content: string | AssistantContentPart[]
    }
  | {
      role: "assistant"
      content: string
    }

function normalizeImageMediaType(rawType: string | null | undefined): string {
  const value = (rawType ?? "").toLowerCase().trim()
  if (value === "image/jpg") return "image/jpeg"
  if (value === "image/jpeg" || value === "image/png" || value === "image/webp" || value === "image/gif") {
    return value
  }
  return "image/jpeg"
}

function isUpdatesRequest(message: string): boolean {
  const normalized = message.toLowerCase().trim()
  if (!normalized) return false

  return [
    /\bany\s+new\s+updates\b/i,
    /\bnew\s+updates\b/i,
    /\blatest\s+updates\b/i,
    /\bwhat'?s\s+new\b/i,
    /\bnew\s+features\b/i,
    /\bhabari\s+mpya\b/i,
    /\bmambo\s+mapya\b/i,
    /\bupdate\s+mpya\b/i,
  ].some((pattern) => pattern.test(normalized))
}

function enforceEnglishOnlyReply(reply: string, userMessage: string): string {
  if (!isSwahiliText(userMessage)) return reply
  if (!isSwahiliText(reply)) return reply

  return "I understand your message and I am here to help with EventSlot. I respond in English to keep things clear for everyone. Please share your EventSlot issue and I will guide you step by step."
}

function detectsEventDataRequest(message: string): boolean {
  const keywords = [
    "how many", "registered", "registrations", "waitlist", "fill rate",
    "capacity", "peak", "best time", "when should", "share my link",
    "my event", "insights", "registration timeline", "people registered",
    "how is my event", "how are registrations",
    "wangapi", "walisajiliwa", "orodha ya kusubiri", "lini", "wakati gani",
    "tukio langu", "usajili",
  ]

  const lower = message.toLowerCase()
  return keywords.some((keyword) => lower.includes(keyword))
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function callGroqWithRetry(
  model: string,
  messages: NonNullable<Parameters<typeof groq.chat.completions.create>[0]["messages"]>,
  hasImages: boolean,
  maxRetries = 2
): Promise<string> {
  let currentModel = model

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const completion = await groq.chat.completions.create({
        model: currentModel,
        messages,
        max_tokens: 500,
        temperature: 0.4,
      })

      const content = completion.choices[0]?.message?.content
      if (Array.isArray(content)) {
        return content
          .map((part) => (typeof part === "string" ? part : ""))
          .join(" ")
          .trim()
      }
      return content ?? ""
    } catch (error: unknown) {
      const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) : undefined

      if (status === 429 && attempt < maxRetries) {
        await sleep(2000 * (attempt + 1))
        continue
      }

      if (hasImages && currentModel !== VISION_MODEL_FALLBACK && attempt < maxRetries) {
        currentModel = VISION_MODEL_FALLBACK
        continue
      }

      throw error
    }
  }

  return ""
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please sign in to use the assistant." },
        { status: 401 }
      )
    }

    // Per-IP chat rate limit (60/hr).
    const ip = (req.headers.get("x-forwarded-for") ?? "127.0.0.1").split(",")[0].trim()
    const chatRl = await rateLimit(ip, "CHAT_MESSAGE", 60, 60)
    if (!chatRl.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded. Please try again later." }, { status: 429 })
    }

    const contentType = req.headers.get("content-type") ?? ""
    let sessionId = ""
    let message = ""
    let images: File[] = []
    let eventId: string | null = null

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData()
      sessionId = String(formData.get("sessionId") ?? "")
      message = String(formData.get("message") ?? "")
      const eventIdRaw = formData.get("eventId")
      eventId = typeof eventIdRaw === "string" && eventIdRaw.trim().length > 0 ? eventIdRaw.trim() : null
      images = formData
        .getAll("images")
        .filter((entry): entry is File => entry instanceof File)
    } else {
      const body = await req.json()
      sessionId = String(body?.sessionId ?? "")
      message = String(body?.message ?? "")
      eventId = typeof body?.eventId === "string" && body.eventId.trim().length > 0 ? body.eventId.trim() : null
    }

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 })
    }

    if (!message.trim() && images.length === 0) {
      return NextResponse.json({ error: "Message or image required" }, { status: 400 })
    }

    if (images.length > MAX_IMAGES_PER_MESSAGE) {
      return NextResponse.json({ error: `Maximum ${MAX_IMAGES_PER_MESSAGE} images per message` }, { status: 400 })
    }

    const identifier = session.user.id
    const quota = await consumeCredits(identifier, session.user.email, images.length)

    if (!quota.allowed) {
      const resetTime = quota.resetAt.toLocaleTimeString("en-KE", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Africa/Nairobi",
      })
      const showFeedback = await shouldShowFeedback(identifier)

      return NextResponse.json(
        {
          error: "QUOTA_EXCEEDED",
          reply:
            `You've reached your message limit for this window. Your access resets in ${quota.waitMinutes} minutes at ${resetTime} EAT. ` +
            "In the meantime, you can browse the EventSlot help docs at www.eventsslot.com or email us at info@eventsslot.com.",
          resetAt: quota.resetAt,
          waitMinutes: quota.waitMinutes,
          showFeedback,
          creditsRemaining: 0,
        },
        { status: 429 }
      )
    }

    const assistantSession = await prisma.assistantSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: { orderBy: { createdAt: "asc" }, take: 20 },
      },
    })

    if (!assistantSession || assistantSession.userId !== session.user.id) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    if (assistantSession.status === "ENDED") {
      return NextResponse.json({
        reply: "This session has ended. Please start a new conversation.",
        sessionEnded: true,
      })
    }

    let systemPrompt = EVENTSLOT_SYSTEM_PROMPT

    // Layer 1: memory context (if enabled and logged in).
    const memEnabled = await isMemoryEnabled(session.user.id)
    if (memEnabled) {
      const memory = await loadMemory(session.user.id)
      if (memory) {
        systemPrompt += `\n${memory}`
      }
    }

    let usedLiveEventData = false

    // Layer 2: live event data (if event-related question or explicit eventId).
    if (eventId || detectsEventDataRequest(message)) {
      try {
        let insights = null

        if (eventId) {
          insights = await getEventInsights(eventId, session.user.id)
        } else {
          const summaries = await getOrganizerEventSummaries(session.user.id)
          const active = summaries.find((event) => {
            const status = event.status.toLowerCase()
            return status === "active" || status === "published"
          })

          if (active) {
            insights = await getEventInsights(active.id, session.user.id)
          }
        }

        if (insights) {
          usedLiveEventData = true
          systemPrompt += `
═══════════════════════════════════════════════
LIVE EVENT DATA (organiser's own event — you may share this freely)
═══════════════════════════════════════════════
Event: ${insights.eventTitle}
Status: ${insights.status}
Registrations: ${insights.totalRegistrations} of ${insights.capacity} (${insights.fillRate}% full)
Waitlist: ${insights.waitlistCount} people
Peak registration day: ${insights.peakDay ?? "N/A"} (${insights.peakCount} registrations)
Best time to share link: ${insights.bestHourToShare ?? "Not enough data yet"}
Registration velocity: ${insights.registrationVelocity}
Daily breakdown: ${JSON.stringify(insights.dailyRegistrations)}

Suggestions you can offer conversationally (not as a formal report):
${insights.suggestions.map((suggestion, index) => `${index + 1}. ${suggestion}`).join("\n")}

IMPORTANT: Share this data conversationally and helpfully.
Do NOT format it as a formal report or use document-style headings.
The full AI report (Word document) requires tokens and is a separate paid feature.
═══════════════════════════════════════════════
`
        }
      } catch (error) {
        // Event context failure should not break chat.
        console.error("[EventSlot] Event context fetch failed:", error)
      }
    }

    // Layer 3: docs context.
    const docsContext = buildDocsContext(message)
    if (docsContext) {
      systemPrompt += docsContext
    }

    const imageContents: { type: "image_url"; image_url: { url: string; detail?: "auto" } }[] = []
    for (const image of images) {
      if (image.size > MAX_IMAGE_SIZE_BYTES) {
        return NextResponse.json({ error: "Image too large. Maximum size is 4MB per image." }, { status: 413 })
      }

      if (!image.type.startsWith("image/")) {
        return NextResponse.json({ error: "Only image files are supported." }, { status: 400 })
      }

    }

    const encodedImages = await Promise.all(
      images.map(async (image) => {
        const arrayBuffer = await image.arrayBuffer()
        const base64 = Buffer.from(arrayBuffer).toString("base64")
        const mediaType = normalizeImageMediaType(image.type)

        return {
          type: "image_url" as const,
          image_url: {
            url: `data:${mediaType};base64,${base64}`,
          },
        }
      })
    )

    imageContents.push(...encodedImages)

    const userContent = images.length > 0 ? `[User sent ${images.length} image(s)]\n${message}` : message

    await prisma.assistantMessage.create({
      data: {
        sessionId,
        role: "USER",
        content: userContent,
        isVoice: false,
      },
    })

    const history: AssistantChatMessage[] = assistantSession.messages.map((msg) => ({
      role: msg.role === "USER" ? "user" : "assistant",
      content: msg.content,
    }))

    const currentMessageContent =
      images.length > 0
        ? [
            ...imageContents,
            {
              type: "text" as const,
              text: message || "Please explain what you see in this screenshot.",
            },
          ]
        : message

    history.push({ role: "user", content: currentMessageContent })

    let reply: string
    let shouldFlag = false
    const forceUpdatesReply = isUpdatesRequest(message)

    try {
      if (forceUpdatesReply) {
        reply = LATEST_UPDATES_REPLY
      } else {
        const modelToUse = images.length > 0 ? VISION_MODEL : ASSISTANT_MODEL
        const promptToUse = images.length > 0 ? VISION_SYSTEM_PROMPT : systemPrompt

        reply = await callGroqWithRetry(
          modelToUse,
          [{ role: "system", content: promptToUse }, ...history],
          images.length > 0
        )
      }

      if (!reply) {
        reply = "I had trouble processing that. Please try again or contact info@eventsslot.com."
      }

      reply = enforceEnglishOnlyReply(reply, message)

      if (
        reply.toLowerCase().includes("flagged this conversation") ||
        reply.toLowerCase().includes("wasn't able to fully resolve")
      ) {
        shouldFlag = true
      }
    } catch (error: unknown) {
      console.error("[EventSlot Assistant] Groq error:", error)
      if (images.length > 0) {
        reply =
          "I can see you've shared a screenshot. I'm having a moment of trouble " +
          "reading images right now. Could you describe what you see - for example, " +
          "the error message text or which part of EventSlot you're looking at? " +
          "I'll help you resolve it. You can also email the screenshot to " +
          "info@eventsslot.com for direct support."
      } else {
        reply =
          "I'm having trouble responding right now. Please try again in a moment or contact info@eventsslot.com."
      }
      shouldFlag = true
    }

    const sessionEnded = ["this session has ended", "have a wonderful day"].some(
      (phrase) => reply.toLowerCase().includes(phrase)
    )

    if (usedLiveEventData && !reply.includes(FULL_REPORT_CTA)) {
      reply = `${reply.trim()}\n\n${FULL_REPORT_CTA}`
    }

    try {
      await prisma.$transaction([
        prisma.assistantMessage.create({
          data: { sessionId, role: "ASSISTANT", content: reply },
        }),
        prisma.assistantSession.update({
          where: { id: sessionId },
          data: {
            messageCount: { increment: 2 },
            imageCount: { increment: images.length },
            status: sessionEnded ? "ENDED" : shouldFlag ? "FLAGGED" : "ACTIVE",
            flagged: shouldFlag || undefined,
            endedAt: sessionEnded ? new Date() : undefined,
            flagReason: shouldFlag && !assistantSession.flagged ? userContent.substring(0, 200) : undefined,
          },
        }),
      ])
    } catch (error) {
      // Backward-compatible fallback for databases missing AssistantSession.imageCount.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022") {
        await prisma.$transaction([
          prisma.assistantMessage.create({
            data: { sessionId, role: "ASSISTANT", content: reply },
          }),
          prisma.assistantSession.update({
            where: { id: sessionId },
            data: {
              messageCount: { increment: 2 },
              status: sessionEnded ? "ENDED" : shouldFlag ? "FLAGGED" : "ACTIVE",
              flagged: shouldFlag || undefined,
              endedAt: sessionEnded ? new Date() : undefined,
              flagReason: shouldFlag && !assistantSession.flagged ? userContent.substring(0, 200) : undefined,
            },
          }),
        ])
      } else {
        throw error
      }
    }

    if (sessionEnded) {
      const allMessages = [
        ...assistantSession.messages,
        { role: "USER", content: userContent },
        { role: "ASSISTANT", content: reply },
      ]

      setImmediate(() => {
        updateMemoryAfterSession(session.user.id, allMessages).catch(console.error)
      })
    }

    return NextResponse.json({
      reply,
      sessionEnded,
      flagged: shouldFlag,
      creditsRemaining: quota.creditsRemaining,
      resetAt: quota.resetAt,
    })
  } catch (error) {
    console.error("[assistant/message] unhandled error", error)
    return NextResponse.json(
      {
        error: "MESSAGE_SEND_FAILED",
        reply: "I'm having trouble responding right now. Please try again shortly.",
      },
      { status: 500 }
    )
  }
}

async function shouldShowFeedback(identifier: string): Promise<boolean> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const alreadyRatedToday = await prisma.assistantFeedback.findFirst({
    where: {
      identifier,
      createdAt: { gte: today },
    },
  })

  return !alreadyRatedToday
}
