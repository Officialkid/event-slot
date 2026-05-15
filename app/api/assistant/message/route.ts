import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { groq, ASSISTANT_MODEL } from "@/lib/groq"
import { EVENTSLOT_SYSTEM_PROMPT } from "@/lib/assistant-context"
import { consumeCredits } from "@/lib/chat-quota"
import { createHash } from "crypto"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { rateLimit } from "@/lib/rate-limit"
import { Prisma } from "@prisma/client"

const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024
const MAX_IMAGES_PER_MESSAGE = 3

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

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    // ── Per-IP chat rate limit (60/hr) ────────────────────
    const ip = (req.headers.get("x-forwarded-for") ?? "127.0.0.1").split(",")[0].trim()
    const chatRl = await rateLimit(ip, "CHAT_MESSAGE", 60, 60)
    if (!chatRl.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded. Please try again later." }, { status: 429 })
    }

    const contentType = req.headers.get("content-type") ?? ""
    let sessionId = ""
    let message = ""
    let images: File[] = []

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData()
      sessionId = String(formData.get("sessionId") ?? "")
      message = String(formData.get("message") ?? "")
      images = formData
        .getAll("images")
        .filter((entry): entry is File => entry instanceof File)
    } else {
      const body = await req.json()
      sessionId = String(body?.sessionId ?? "")
      message = String(body?.message ?? "")
    }

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 })
    }

    if (!message.trim() && images.length === 0) {
      return NextResponse.json(
        { error: "Message or image required" },
        { status: 400 }
      )
    }

    if (images.length > MAX_IMAGES_PER_MESSAGE) {
      return NextResponse.json(
        { error: `Maximum ${MAX_IMAGES_PER_MESSAGE} images per message` },
        { status: 400 }
      )
    }

    const identifier = session?.user?.id ?? createHash("sha256").update(ip).digest("hex")
    const quota = await consumeCredits(identifier, session?.user?.email, images.length)

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

    if (!assistantSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    if (assistantSession.status === "ENDED") {
      return NextResponse.json({
        reply: "This session has ended. Please start a new conversation.",
        sessionEnded: true,
      })
    }

    const imageContents: { type: "image_url"; image_url: { url: string } }[] = []

    for (const image of images) {
      if (image.size > MAX_IMAGE_SIZE_BYTES) {
        return NextResponse.json(
          { error: "Image too large. Maximum size is 4MB per image." },
          { status: 413 }
        )
      }

      if (!image.type.startsWith("image/")) {
        return NextResponse.json({ error: "Only image files are supported." }, { status: 400 })
      }

      const arrayBuffer = await image.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString("base64")
      const dataUrl = `data:${image.type};base64,${base64}`

      imageContents.push({ type: "image_url", image_url: { url: dataUrl } })
    }

    const userContent =
      images.length > 0 ? `[User sent ${images.length} image(s)]\n${message}` : message

    await prisma.assistantMessage.create({
      data: {
        sessionId,
        role: "USER",
        content: userContent,
        isVoice: false,
      },
    })

    const history: AssistantChatMessage[] = assistantSession.messages.map((m) => ({
      role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    }))

    const currentMessageContent =
      images.length > 0
        ? [
            ...imageContents,
            {
              type: "text" as const,
              text:
                message ||
                "Please explain what you see in this screenshot and how to resolve any issues.",
            },
          ]
        : message

    history.push({ role: "user", content: currentMessageContent })

    let reply: string
    let shouldFlag = false

    try {
      const completion = await groq.chat.completions.create({
        model: images.length > 0 ? "llama-3.2-11b-vision-preview" : ASSISTANT_MODEL,
        messages: [
          { role: "system", content: EVENTSLOT_SYSTEM_PROMPT },
          ...history,
        ],
        max_tokens: 500,
        temperature: 0.4,
      })

      reply =
        completion.choices[0]?.message?.content ??
        "I had trouble processing that. Please try again or contact info@eventsslot.com."

      if (
        reply.toLowerCase().includes("flagged this conversation") ||
        reply.toLowerCase().includes("wasn't able to fully resolve")
      ) {
        shouldFlag = true
      }
    } catch (error: unknown) {
      console.error("[EventSlot Assistant] Groq error:", error)

      const errorMessage = error instanceof Error ? error.message : String(error)

      if (images.length > 0 && errorMessage.toLowerCase().includes("model")) {
        reply =
          "I received your screenshot but I'm having trouble analysing images right now. " +
          "Please describe what you see in the image and I'll do my best to help. " +
          "Alternatively, contact info@eventsslot.com with the screenshot attached."
      } else {
        reply =
          "I'm having trouble responding right now. Please try again in a moment or " +
          "contact info@eventsslot.com."
      }
      shouldFlag = true
    }

    const sessionEnded = ["this session has ended", "have a wonderful day"].some(
      (p) => reply.toLowerCase().includes(p)
    )

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
            flagReason:
              shouldFlag && !assistantSession.flagged
                ? userContent.substring(0, 200)
                : undefined,
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
              flagReason:
                shouldFlag && !assistantSession.flagged
                  ? userContent.substring(0, 200)
                  : undefined,
            },
          }),
        ])
      } else {
        throw error
      }
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
