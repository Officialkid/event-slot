import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { groq, ASSISTANT_MODEL } from "@/lib/groq"
import {
  EVENTSLOT_SYSTEM_PROMPT,
  SESSION_MAX_MESSAGES,
} from "@/lib/assistant-context"
import { rateLimit } from "@/lib/rate-limit"

export async function POST(req: NextRequest) {
  // ── Per-IP chat rate limit (60/hr) ────────────────────
  const ip = (req.headers.get("x-forwarded-for") ?? "127.0.0.1").split(",")[0].trim()
  const chatRl = await rateLimit(ip, "CHAT_MESSAGE", 60, 60)
  if (!chatRl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Please try again later." }, { status: 429 })
  }

  const { sessionId, message } = await req.json()

  if (!sessionId || !message?.trim()) {
    return NextResponse.json(
      { error: "sessionId and message are required" },
      { status: 400 }
    )
  }

  const session = await prisma.assistantSession.findUnique({
    where: { id: sessionId },
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: 20 },
    },
  })

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  if (session.status === "ENDED") {
    return NextResponse.json({
      reply: "This session has ended. Please start a new conversation.",
      sessionEnded: true,
    })
  }

  // Message limit
  if (session.messageCount >= SESSION_MAX_MESSAGES) {
    await prisma.assistantSession.update({
      where: { id: sessionId },
      data: { status: "ENDED", endedAt: new Date() },
    })
    return NextResponse.json({
      reply:
        "This conversation has reached its message limit. " +
        "Thank you for contacting EventSlot. This session has ended. " +
        "Have a wonderful day! 🌟",
      sessionEnded: true,
    })
  }

  // Save user message
  await prisma.assistantMessage.create({
    data: { sessionId, role: "USER", content: message },
  })

  // Build history for Groq
  const history = session.messages.map((m) => ({
    role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
    content: m.content,
  }))
  history.push({ role: "user", content: message })

  let reply: string
  let shouldFlag = false

  try {
    const completion = await groq.chat.completions.create({
      model: ASSISTANT_MODEL,
      messages: [
        { role: "system", content: EVENTSLOT_SYSTEM_PROMPT },
        ...history,
      ],
      max_tokens: 400,
      temperature: 0.4,
    })

    reply =
      completion.choices[0]?.message?.content ??
      "I'm having trouble responding right now. Please try again or " +
        "contact info@eventsslot.com."

    // Detect flag trigger
    if (
      reply.toLowerCase().includes("flagged this conversation") ||
      reply.toLowerCase().includes("wasn't able to fully resolve")
    ) {
      shouldFlag = true
    }
  } catch (error) {
    console.error("[EventSlot Assistant] Groq error:", error)
    reply =
      "I'm having trouble connecting right now. Please try again in " +
      "a moment or contact us at info@eventsslot.com."
    shouldFlag = true
  }

  // Detect session-ending phrases
  const sessionEnded = ["this session has ended", "have a wonderful day"].some(
    (p) => reply.toLowerCase().includes(p)
  )

  // Save reply + update session atomically
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
        flagReason:
          shouldFlag && !session.flagged
            ? message.substring(0, 200)
            : undefined,
      },
    }),
  ])

  return NextResponse.json({ reply, sessionEnded, flagged: shouldFlag })
}
