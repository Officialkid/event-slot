import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { consumeCredits } from "@/lib/chat-quota"
import { isMemoryEnabled, loadMemory, updateMemoryAfterSession } from "@/lib/assistant-memory"
import { isSwahiliText } from "@/lib/assistant-md4"
import { buildDocsContext } from "@/lib/docs-context"
import {
  runAssistantOrchestrator,
  type OrchestratorResult,
} from "@/lib/assistant/orchestrator"
import {
  executeEventCreationProposal,
  cancelEventCreationProposal,
} from "@/lib/assistant/confirmation-executor"
import { prepareEventCreationProposalFromDraft } from "@/lib/assistant/confirmation-engine"
import { PrismaPendingActionStore } from "@/lib/assistant/prisma-pending-action-store"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { rateLimit } from "@/lib/rate-limit"
import { Prisma } from "@prisma/client"

const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024
const MAX_IMAGES_PER_MESSAGE = 3
const FULL_REPORT_CTA =
  "For the full AI analysis and downloadable report, open the Export centre from your event dashboard and choose Prepare AI report export. Report downloads are currently free for authorised organisers while premium billing is paused."
const LATEST_UPDATES_REPLY =
  "For the latest EventSlot updates, check your notification bell in the dashboard or visit www.eventsslot.com. Is there something specific about the platform I can help you with?"

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

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please sign in to use the assistant." },
        { status: 401 }
      )
    }

    // Per-user chat rate limit (60/hr), independent of client-supplied x-forwarded-for headers.
    const chatRl = await rateLimit(session.user.id, "CHAT_MESSAGE", 60, 60)
    if (!chatRl.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded. Please try again later." }, { status: 429 })
    }

    const contentType = req.headers.get("content-type") ?? ""
    let sessionId = ""
    let message = ""
    let images: File[] = []
    let eventId: string | null = null
    let workspaceOrganizerId: string | null = null
    let actionType: string | null = null
    let proposalId: string | null = null
    let idempotencyKey: string | null = null

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData()
      sessionId = String(formData.get("sessionId") ?? "")
      message = String(formData.get("message") ?? "")
      const eventIdRaw = formData.get("eventId")
      eventId = typeof eventIdRaw === "string" && eventIdRaw.trim().length > 0 ? eventIdRaw.trim() : null
      const workspaceRaw = formData.get("asOrganizationId") ?? formData.get("workspaceOrganizerId")
      workspaceOrganizerId = typeof workspaceRaw === "string" && workspaceRaw.trim().length > 0 ? workspaceRaw.trim() : null
      actionType = typeof formData.get("actionType") === "string" ? String(formData.get("actionType")).trim() : null
      proposalId = typeof formData.get("proposalId") === "string" ? String(formData.get("proposalId")).trim() : null
      idempotencyKey = typeof formData.get("idempotencyKey") === "string" ? String(formData.get("idempotencyKey")).trim() : null
      images = formData
        .getAll("images")
        .filter((entry): entry is File => entry instanceof File)
    } else {
      const body = await req.json()
      sessionId = String(body?.sessionId ?? "")
      message = String(body?.message ?? "")
      eventId = typeof body?.eventId === "string" && body.eventId.trim().length > 0 ? body.eventId.trim() : null
      const workspaceRaw = body?.asOrganizationId ?? body?.workspaceOrganizerId
      workspaceOrganizerId = typeof workspaceRaw === "string" && workspaceRaw.trim().length > 0 ? workspaceRaw.trim() : null
      actionType = typeof body?.actionType === "string" ? body.actionType.trim() : null
      proposalId = typeof body?.proposalId === "string" ? body.proposalId.trim() : null
      idempotencyKey = typeof body?.idempotencyKey === "string" ? body.idempotencyKey.trim() : null
    }

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 })
    }

    if (!actionType && !message.trim() && images.length === 0) {
      return NextResponse.json({ error: "Message or image required" }, { status: 400 })
    }

    if (images.length > MAX_IMAGES_PER_MESSAGE) {
      return NextResponse.json({ error: `Maximum ${MAX_IMAGES_PER_MESSAGE} images per message` }, { status: 400 })
    }

    for (const image of images) {
      if (image.size > MAX_IMAGE_SIZE_BYTES) {
        return NextResponse.json({ error: "Image too large. Maximum size is 4MB per image." }, { status: 413 })
      }

      if (!image.type.startsWith("image/")) {
        return NextResponse.json({ error: "Only image files are supported." }, { status: 400 })
      }
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

    // Explicit Confirmation Actions Boundary
    if (actionType === "CONFIRM_ACTION" || actionType === "CONFIRM_EVENT_CREATION") {
      if (!proposalId || !idempotencyKey) {
        return NextResponse.json(
          { error: "proposalId and idempotencyKey are required for action confirmation" },
          { status: 400 }
        )
      }

      const executionOutcome = await executeEventCreationProposal({
        proposalId,
        idempotencyKey,
        actor: {
          userId: session.user.id,
          userEmail: session.user.email,
          userRole: session.user.role,
          isAdmin: (session.user as { isAdmin?: boolean | null }).isAdmin,
          workspaceOrganizerId,
        },
        sessionId,
        workspaceOrganizerId,
      })

      const replyContent = executionOutcome.message

      await prisma.$transaction([
        prisma.assistantMessage.create({
          data: {
            sessionId,
            role: "USER",
            content: `[Confirmed action: ${proposalId}]`,
          },
        }),
        prisma.assistantMessage.create({
          data: {
            sessionId,
            role: "ASSISTANT",
            content: replyContent,
          },
        }),
        prisma.assistantSession.update({
          where: { id: sessionId },
          data: {
            messageCount: { increment: 2 },
          },
        }),
      ])

      return NextResponse.json({
        ok: executionOutcome.ok,
        code: executionOutcome.code,
        reply: replyContent,
        kind: "CONFIRMATION_RESULT",
        createdEvent: executionOutcome.createdEvent ?? null,
        updatedEvent: (executionOutcome as any).updatedEvent ?? null,
        proposal: executionOutcome.proposal ?? null,
        sideEffectsDeliveryStatus: executionOutcome.sideEffectsDeliveryStatus ?? null,
        creditsRemaining: quota.creditsRemaining,
        resetAt: quota.resetAt,
      })
    }

    if (actionType === "CANCEL_ACTION") {
      if (!proposalId) {
        return NextResponse.json(
          { error: "proposalId is required for action cancellation" },
          { status: 400 }
        )
      }

      const cancelOutcome = await cancelEventCreationProposal({
        proposalId,
        actor: {
          userId: session.user.id,
          userEmail: session.user.email,
          userRole: session.user.role,
          isAdmin: (session.user as { isAdmin?: boolean | null }).isAdmin,
          workspaceOrganizerId,
        },
        sessionId,
      })

      const replyContent = cancelOutcome.message

      await prisma.$transaction([
        prisma.assistantMessage.create({
          data: {
            sessionId,
            role: "USER",
            content: `[Cancelled action: ${proposalId}]`,
          },
        }),
        prisma.assistantMessage.create({
          data: {
            sessionId,
            role: "ASSISTANT",
            content: replyContent,
          },
        }),
        prisma.assistantSession.update({
          where: { id: sessionId },
          data: {
            messageCount: { increment: 2 },
          },
        }),
      ])

      return NextResponse.json({
        ok: cancelOutcome.ok,
        code: cancelOutcome.code,
        reply: replyContent,
        kind: "ACTION_CANCELLED",
        proposal: cancelOutcome.proposal ?? null,
        creditsRemaining: quota.creditsRemaining,
        resetAt: quota.resetAt,
      })
    }

    // Layer 1: memory context (if enabled and logged in).
    let memoryContext: string | null = null
    const memEnabled = await isMemoryEnabled(session.user.id)
    if (memEnabled) {
      memoryContext = await loadMemory(session.user.id)
    }

    // Layer 3: docs context.
    const docsContext = buildDocsContext(message)

    const encodedImages = await Promise.all(
      images.map(async (image) => {
        const arrayBuffer = await image.arrayBuffer()
        const base64 = Buffer.from(arrayBuffer).toString("base64")
        const mediaType = normalizeImageMediaType(image.type)

        return {
          base64DataUrl: `data:${mediaType};base64,${base64}`,
          mediaType,
        }
      })
    )

    const userContent = images.length > 0 ? `[User sent ${images.length} image(s)]\n${message}` : message

    await prisma.assistantMessage.create({
      data: {
        sessionId,
        role: "USER",
        content: userContent,
        isVoice: false,
      },
    })

    const conversationHistory: Array<{ role: "user" | "assistant"; content: string }> =
      assistantSession.messages.map((msg) => ({
        role: msg.role === "USER" ? "user" : "assistant",
        content: msg.content,
      }))

    let reply: string
    let shouldFlag = false
    let orchestratorResult: OrchestratorResult | null = null
    const forceUpdatesReply = isUpdatesRequest(message)

    try {
      if (forceUpdatesReply && images.length === 0) {
        reply = LATEST_UPDATES_REPLY
      } else {
        orchestratorResult = await runAssistantOrchestrator({
          actor: {
            userId: session.user.id,
            userEmail: session.user.email,
            userRole: session.user.role,
            isAdmin: (session.user as { isAdmin?: boolean | null }).isAdmin,
            workspaceOrganizerId,
            organizerName: session.user.name ?? null,
          },
          sessionId,
          message,
          explicitEventIdOrSlug: eventId,
          conversationHistory,
          images: encodedImages,
          memoryContext,
          docsContext,
        })

        reply = orchestratorResult.reply
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
      console.error("[EventSlot Assistant] Orchestrator error:", error)
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

    if (orchestratorResult?.usedLiveEventData && !reply.includes(FULL_REPORT_CTA)) {
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

    let proposal: {
      proposalId: string
      idempotencyKey: string
      status: string
      preview?: any
    } | null = null

    if (
      orchestratorResult?.kind === "DRAFT_PREVIEW" &&
      orchestratorResult.draftPreview
    ) {
      try {
        const store = new PrismaPendingActionStore()
        const proposalResult = await prepareEventCreationProposalFromDraft({
          actor: {
            userId: session.user.id,
            userEmail: session.user.email,
            userRole: session.user.role,
            isAdmin: (session.user as { isAdmin?: boolean | null }).isAdmin,
            workspaceOrganizerId,
          },
          sessionId,
          draft: orchestratorResult.draftPreview,
          persistenceStore: store,
        })

        if (proposalResult.ok && proposalResult.proposal) {
          proposal = {
            proposalId: proposalResult.proposal.proposalId,
            idempotencyKey: proposalResult.proposal.idempotencyKey,
            status: proposalResult.proposal.status,
          }
        }
      } catch (proposalError) {
        console.error(
          "[EventSlot Assistant] Failed to prepare action proposal for draft preview:",
          proposalError
        )
      }
    } else if (
      orchestratorResult?.kind === "ACTION_PROPOSAL" &&
      orchestratorResult.proposal
    ) {
      proposal = {
        proposalId: orchestratorResult.proposal.proposalId,
        idempotencyKey: orchestratorResult.proposal.idempotencyKey,
        status: orchestratorResult.proposal.status,
        preview: (orchestratorResult.proposal as any).preview ?? null,
      }
    }

    return NextResponse.json({
      reply,
      kind: orchestratorResult?.kind ?? "ANSWER",
      draftPreview: orchestratorResult?.draftPreview ?? null,
      proposal,
      clarification: orchestratorResult?.clarification ?? null,
      capabilityError: orchestratorResult?.capabilityError ?? null,
      toolCallsExecuted: orchestratorResult?.toolCallsExecuted ?? [],
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
