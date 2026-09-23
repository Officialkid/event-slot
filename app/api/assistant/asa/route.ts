import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { v4 as uuidv4 } from "uuid"
import { generateVerifierCode } from "@/lib/verifierCode"
import { canCreateEvent } from "@/lib/planEnforcement"
import { processFirstEventReferral } from "@/lib/referral"
import { APP_URL } from "@/lib/config"
import { hasOrganiserAccess } from "@/lib/adminMode"
import {
  processAsaConversation,
  processAsaFormConversation,
  generateRegistrationQuestionsForEvent,
  formatQuestionsForReview,
  type AsaEventDraft,
  type AsaMessage,
  type AsaFormProposal,
  type AsaFormQuestion,
} from "@/lib/asa/asa-engine"

function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
  const suffix = Math.random().toString(36).substring(2, 6)
  return `${base || "event"}-${suffix}`
}

function parseDraftDateAndTimes(draft: AsaEventDraft): {
  eventDate: Date | null
  eventEndAt: Date | null
  hasSpecificTime: boolean
} {
  try {
    let baseDate: Date | null = null

    if (draft.eventDate) {
      const parsed = new Date(draft.eventDate)
      if (!Number.isNaN(parsed.getTime())) baseDate = parsed
    }

    if (!baseDate && draft.displayDate) {
      const parsed = new Date(draft.displayDate)
      if (!Number.isNaN(parsed.getTime())) baseDate = parsed
    }

    if (!baseDate) {
      // If no valid date was given, schedule 14 days out at 10:00 AM as a safe default
      baseDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      baseDate.setHours(10, 0, 0, 0)
    }

    // Try parsing start time
    let hasSpecificTime = false
    const timeMatch = (draft.startTime || draft.displayTime || "").match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10)
      const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0
      const ampm = timeMatch[3]?.toLowerCase()

      if (ampm === "pm" && hours < 12) hours += 12
      if (ampm === "am" && hours === 12) hours = 0

      baseDate.setHours(hours, minutes, 0, 0)
      hasSpecificTime = true
    }

    // End date calculation (default to 2 hours later)
    let eventEndAt: Date | null = null
    if (hasSpecificTime) {
      eventEndAt = new Date(baseDate.getTime() + 2 * 60 * 60 * 1000)
    }

    return {
      eventDate: baseDate,
      eventEndAt,
      hasSpecificTime: draft.hasSpecificTime ?? hasSpecificTime,
    }
  } catch {
    return { eventDate: null, eventEndAt: null, hasSpecificTime: false }
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized. Please sign in to use ASA." }, { status: 401 })
    }

    const userId = session.user.id
    const userEmail = session.user.email ?? ""
    const userName = session.user.name ?? "Organizer"

    let body: {
      messages?: AsaMessage[]
      draft?: AsaEventDraft
      proposal?: AsaFormProposal
      eventId?: string
      eventSlug?: string
      customPrompt?: string
      questions?: AsaFormQuestion[]
      action?: "confirm_create" | "propose_questions" | "modify_questions" | "apply_questions" | "reset"
    }

    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 })
    }

    const {
      messages = [],
      draft = { status: "collecting" },
      proposal,
      eventId,
      eventSlug,
      customPrompt,
      questions,
      action,
    } = body

    // =========================================================================
    // 1. REGISTRATION FORM ACTIONS
    // =========================================================================

    // ACTION: Propose registration questions for an event
    if (action === "propose_questions") {
      const targetEvent = await findAndAuthorizeEvent(userId, session, eventId, eventSlug)
      if (!targetEvent.authorized || !targetEvent.event) {
        return NextResponse.json({ success: false, error: targetEvent.error }, { status: targetEvent.status })
      }

      const generated = generateRegistrationQuestionsForEvent({
        title: targetEvent.event.title,
        description: targetEvent.event.description || undefined,
        category: targetEvent.event.category || undefined,
        venue: targetEvent.event.location || undefined,
        capacity: targetEvent.event.capacity,
        eventType: targetEvent.event.eventType,
        customPrompt,
      })

      const newProposal: AsaFormProposal = {
        eventId: targetEvent.event.id,
        eventSlug: targetEvent.event.slug,
        eventTitle: targetEvent.event.title,
        status: "proposed",
        questions: generated,
      }

      const reply = formatQuestionsForReview(generated, targetEvent.event.title)

      return NextResponse.json({
        success: true,
        proposal: newProposal,
        reply,
      })
    }

    // ACTION: Apply/Save questions permanently to the event in Prisma
    if (action === "apply_questions") {
      const targetId = eventId || proposal?.eventId
      const targetSlug = eventSlug || proposal?.eventSlug
      const targetEvent = await findAndAuthorizeEvent(userId, session, targetId, targetSlug)
      if (!targetEvent.authorized || !targetEvent.event) {
        return NextResponse.json({ success: false, error: targetEvent.error }, { status: targetEvent.status })
      }

      const questionsToApply = questions || proposal?.questions || []
      if (!Array.isArray(questionsToApply) || questionsToApply.length === 0) {
        return NextResponse.json({ success: false, error: "At least one registration question is required." }, { status: 400 })
      }

      // Validate select / checkbox have options
      for (const q of questionsToApply) {
        if ((q.type === "select" || q.type === "checkbox") && (!Array.isArray(q.options) || q.options.length === 0)) {
          return NextResponse.json(
            { success: false, error: `Question "${q.label || "Untitled"}" needs at least one option.` },
            { status: 400 }
          )
        }
      }

      const finalizedQuestions = questionsToApply.map((q, idx) => ({
        id: q.id || `q_${idx}_${Date.now()}`,
        label: q.label.trim(),
        type: q.type,
        required: Boolean(q.required),
        ...(q.type === "select" || q.type === "checkbox" ? { options: q.options || [] } : {}),
        ...(q.type === "checkbox" ? { allowMultiple: Boolean(q.allowMultiple) } : {}),
        ...(q.condition?.questionId && q.condition?.value ? { condition: q.condition } : {}),
      }))

      await prisma.event.update({
        where: { id: targetEvent.event.id },
        data: { questions: finalizedQuestions },
      })

      const publicUrl = `${APP_URL}/${targetEvent.event.slug}`
      const dashboardUrl = `/dashboard/events/${targetEvent.event.slug}`

      return NextResponse.json({
        success: true,
        applied: true,
        reply: `🎉 Your registration form for **${targetEvent.event.title}** has been updated with ${finalizedQuestions.length} questions! Attendees will now see these questions when registering.`,
        event: {
          id: targetEvent.event.id,
          slug: targetEvent.event.slug,
          title: targetEvent.event.title,
          publicUrl,
          dashboardUrl,
        },
        proposal: {
          eventId: targetEvent.event.id,
          eventSlug: targetEvent.event.slug,
          eventTitle: targetEvent.event.title,
          status: "applied",
          questions: finalizedQuestions,
        },
      })
    }

    // ACTION: Modify proposed questions conversationally
    if (action === "modify_questions" && proposal) {
      if (proposal.eventId) {
        const targetEvent = await findAndAuthorizeEvent(userId, session, proposal.eventId, proposal.eventSlug)
        if (!targetEvent.authorized || !targetEvent.event) {
          return NextResponse.json({ success: false, error: targetEvent.error }, { status: targetEvent.status })
        }
      }

      const formResult = await processAsaFormConversation({
        messages,
        proposal,
      })

      return NextResponse.json({
        success: true,
        proposal: formResult.proposal,
        reply: formResult.reply,
        isReadyToApply: formResult.isReadyToApply,
        isApplied: formResult.isApplied,
      })
    }

    // Conversational check: if an active form proposal is present in context, route to form conversation
    if (proposal && proposal.status === "proposed" && messages.length > 0) {
      const formResult = await processAsaFormConversation({
        messages,
        proposal,
      })

      return NextResponse.json({
        success: true,
        proposal: formResult.proposal,
        reply: formResult.reply,
        isReadyToApply: formResult.isReadyToApply,
        isApplied: formResult.isApplied,
      })
    }

    // Conversational check: if organizer asks "Set up registration for [event]" or "Create registration questions..."
    const latestMessage = messages[messages.length - 1]?.content?.trim() || ""
    const isRegistrationIntent =
      /^(?:set up|create|generate|recommend|suggest)\s+registration(?:\s+questions|\s+form)?/i.test(latestMessage) ||
      /registration questions/i.test(latestMessage)

    if (isRegistrationIntent && (eventId || eventSlug)) {
      const targetEvent = await findAndAuthorizeEvent(userId, session, eventId, eventSlug)
      if (targetEvent.authorized && targetEvent.event) {
        const generated = generateRegistrationQuestionsForEvent({
          title: targetEvent.event.title,
          description: targetEvent.event.description || undefined,
          category: targetEvent.event.category || undefined,
          venue: targetEvent.event.location || undefined,
          capacity: targetEvent.event.capacity,
          eventType: targetEvent.event.eventType,
          customPrompt: latestMessage,
        })

        const newProposal: AsaFormProposal = {
          eventId: targetEvent.event.id,
          eventSlug: targetEvent.event.slug,
          eventTitle: targetEvent.event.title,
          status: "proposed",
          questions: generated,
        }

        return NextResponse.json({
          success: true,
          proposal: newProposal,
          reply: formatQuestionsForReview(generated, targetEvent.event.title),
        })
      }
    }

    // =========================================================================
    // 2. EVENT CREATION ACTIONS
    // =========================================================================

    // Plan check for event creation
    const enforcement = await canCreateEvent(userId, userEmail)
    if (!enforcement.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: enforcement.reason,
          upgradeRequired: enforcement.upgradeRequired,
          code: "PLAN_LIMIT_EVENTS",
        },
        { status: 403 }
      )
    }

    // Explicit create action from UI button
    if (action === "confirm_create" || draft.status === "confirmed") {
      return await executeEventCreation(draft, userId, userEmail, userName)
    }

    // Process event creation conversation turn
    const result = await processAsaConversation({
      messages,
      currentDraft: draft,
      organizerName: userName,
    })

    // If the conversation resulted in confirmation, execute creation immediately
    if (result.isConfirmedState) {
      return await executeEventCreation(result.draft, userId, userEmail, userName)
    }

    return NextResponse.json({
      success: true,
      created: false,
      reply: result.reply,
      draft: result.draft,
      isReviewState: result.isReviewState,
      isConfirmedState: result.isConfirmedState,
      missingFields: result.missingFields,
    })
  } catch (error) {
    console.error("[ASA Route Error]", error)
    return NextResponse.json(
      {
        success: false,
        error: "Something went wrong processing your request with ASA. Please try again.",
      },
      { status: 500 }
    )
  }
}

async function findAndAuthorizeEvent(
  userId: string,
  session: any,
  eventId?: string,
  eventSlug?: string
): Promise<{
  authorized: boolean
  event?: any
  status: number
  error?: string
}> {
  if (!eventId && !eventSlug) {
    return { authorized: false, status: 400, error: "Event ID or slug is required." }
  }

  const event = await prisma.event.findFirst({
    where: {
      OR: [
        ...(eventId ? [{ id: eventId }] : []),
        ...(eventSlug ? [{ slug: eventSlug }] : []),
      ],
    },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      category: true,
      location: true,
      capacity: true,
      eventType: true,
      organizerId: true,
      questions: true,
    },
  })

  if (!event) {
    return { authorized: false, status: 404, error: "Event not found." }
  }

  const isOwner = event.organizerId === userId
  const hasAccess = isOwner || (await hasOrganiserAccess(session, event.id))

  if (!hasAccess) {
    return {
      authorized: false,
      status: 403,
      error: "Forbidden: You are not authorized to configure this event's registration form.",
    }
  }

  return { authorized: true, event, status: 200 }
}

async function executeEventCreation(
  draft: AsaEventDraft,
  userId: string,
  userEmail: string,
  userName: string
) {
  if (!draft.title?.trim()) {
    return NextResponse.json(
      {
        success: false,
        created: false,
        reply: "Before I can create your event, what would you like to call it?",
        draft: { ...draft, status: "collecting" },
        isReviewState: false,
        isConfirmedState: false,
        missingFields: ["event name"],
      },
      { status: 400 }
    )
  }

  const { eventDate, eventEndAt, hasSpecificTime } = parseDraftDateAndTimes(draft)
  const slug = generateSlug(draft.title)
  const dashboardToken = uuidv4()
  const verifierCode = generateVerifierCode()

  // Initial default question
  const defaultQuestion = [
    {
      id: "question-0",
      label: "Full Name",
      type: "text",
      required: true,
      options: [],
      optionLimits: {},
    },
  ]

  const newEvent = await prisma.event.create({
    data: {
      title: draft.title.trim(),
      slug,
      description: draft.description?.trim() || null,
      category: draft.category || "General",
      visibility: "PUBLIC",
      accessType: "REGISTRATION",
      eventType: draft.eventType || "PHYSICAL",
      virtualLink: draft.virtualLink?.trim() || null,
      location: draft.location?.trim() || "TBD",
      capacity: typeof draft.capacity === "number" && draft.capacity > 0 ? draft.capacity : null,
      eventDate,
      eventEndAt,
      hasSpecificTime,
      showRemainingSpots: true,
      organizerId: userId,
      organizerName: userName,
      organizerEmail: userEmail,
      dashboardToken,
      verifierCode,
      questions: defaultQuestion,
    },
  })

  // Track event creation referral/stats non-blockingly
  processFirstEventReferral(userId).catch(() => {})

  const publicUrl = `${APP_URL}/${newEvent.slug}`
  const dashboardUrl = `/dashboard/events/${newEvent.slug}`

  // Intelligently propose contextual registration questions for the newly created event
  const proposedQuestions = generateRegistrationQuestionsForEvent({
    title: newEvent.title,
    description: newEvent.description || undefined,
    category: newEvent.category || undefined,
    venue: newEvent.location || undefined,
    capacity: newEvent.capacity,
    eventType: newEvent.eventType,
  })

  const formProposal: AsaFormProposal = {
    eventId: newEvent.id,
    eventSlug: newEvent.slug,
    eventTitle: newEvent.title,
    status: "proposed",
    questions: proposedQuestions,
  }

  return NextResponse.json({
    success: true,
    created: true,
    reply: `🎉 Congratulations! I've created your event **${newEvent.title}**!

Here is your live registration link:
${publicUrl}

Your event has been created. Now let's set up registration. I can suggest the questions your attendees should answer.`,
    event: {
      id: newEvent.id,
      title: newEvent.title,
      slug: newEvent.slug,
      publicUrl,
      dashboardUrl,
      eventDate: newEvent.eventDate,
      location: newEvent.location,
      capacity: newEvent.capacity,
    },
    draft: {
      ...draft,
      status: "confirmed",
    },
    formProposal,
  })
}
