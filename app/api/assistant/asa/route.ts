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
  formatEventMetricsSummary,
  detectManagementActionIntent,
  isActionConfirmation,
  isActionCancellation,
  isOrganizerEventsOverviewQuery,
  formatOrganizerEventsOverview,
  analyzeFlyerWithVision,
  type AsaEventDraft,
  type AsaMessage,
  type AsaFormProposal,
  type AsaFormQuestion,
  type AsaEventMetrics,
  type AsaManagementAction,
  type AsaEventListItem,
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

function safeLogAsaInteraction(actorId: string, metadata: Record<string, unknown>) {
  try {
    if (prisma && "auditLog" in prisma && typeof (prisma as any).auditLog?.create === "function") {
      (prisma as any).auditLog
        .create({
          data: {
            actorId,
            action: "ASA_INTERACTION",
            metadata,
          },
        })
        .catch(() => {})
    }
  } catch {}
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
      pendingAction?: AsaManagementAction | null
      eventId?: string
      eventSlug?: string
      customPrompt?: string
      questions?: AsaFormQuestion[]
      action?:
        | "confirm_create"
        | "propose_questions"
        | "modify_questions"
        | "apply_questions"
        | "list_organizer_events"
        | "get_event_insights"
        | "execute_management_action"
        | "cancel_management_action"
        | "analyze_flyer"
        | "reset"
      imageBase64?: string
      mimeType?: string
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
      pendingAction,
      eventId,
      eventSlug,
      customPrompt,
      questions,
      action,
      imageBase64,
      mimeType,
    } = body

    const latestMessage = messages[messages.length - 1]?.content?.trim() || ""

    // =========================================================================
    // 0. FLYER PHOTO MULTIMODAL EXTRACTION
    // =========================================================================
    if (action === "analyze_flyer" && imageBase64) {
      const visionResult = await analyzeFlyerWithVision({
        imageBase64,
        mimeType: mimeType || "image/jpeg",
        userNote: latestMessage || customPrompt,
      })

      // Asynchronously log interaction for fine-tuning dataset collection
      safeLogAsaInteraction(userId, {
        intent: "flyer_vision_analysis",
        success: visionResult.success,
        extractedDraft: visionResult.draft,
        userNote: latestMessage || customPrompt || null,
      })

      return NextResponse.json({
        success: visionResult.success,
        reply: visionResult.reply,
        draft: visionResult.draft,
        isReviewState: visionResult.draft.status === "ready_for_review",
        isConfirmedState: false,
      })
    }

    // =========================================================================
    // 1. DIRECT ACTION HANDLERS (EVENT MANAGEMENT & INTELLIGENCE)
    // =========================================================================

    // ACTION: List organizer's active events for selector/disambiguation
    if (action === "list_organizer_events") {
      const userEvents = await prisma.event.findMany({
        where: { organizerId: userId, archived: false },
        select: {
          id: true,
          slug: true,
          title: true,
          confirmedCount: true,
          capacity: true,
          eventDate: true,
          status: true,
          location: true,
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      })

      const events: AsaEventListItem[] = userEvents.map((e) => ({
        id: e.id,
        slug: e.slug,
        title: e.title,
        confirmedCount: e.confirmedCount,
        capacity: e.capacity,
        eventDate: e.eventDate,
        status: e.status,
      }))

      return NextResponse.json({ success: true, events })
    }

    // ACTION: Get live event insights / metrics
    if (action === "get_event_insights") {
      const resolved = await resolveTargetEvent(userId, session, eventId, eventSlug, customPrompt)
      if (resolved.error) {
        return NextResponse.json({ success: false, error: resolved.error }, { status: resolved.status || 400 })
      }
      if (resolved.needsDisambiguation) {
        return NextResponse.json({
          success: true,
          reply: "Which event would you like me to check? You have multiple events. Please choose one below:",
          needsDisambiguation: true,
          eventsList: resolved.eventsList,
        })
      }
      if (!resolved.targetEvent) {
        return NextResponse.json({
          success: true,
          reply: "You don't have any active events on EventSlot yet. Would you like me to help you create one?",
        })
      }

      const metrics = await computeEventMetrics(resolved.targetEvent)
      return NextResponse.json({
        success: true,
        metrics,
        reply: formatEventMetricsSummary(metrics, customPrompt || ""),
        event: {
          id: resolved.targetEvent.id,
          slug: resolved.targetEvent.slug,
          title: resolved.targetEvent.title,
        },
      })
    }

    // ACTION: Explicit Execute Management Action (from 1-tap Confirm button)
    if (action === "execute_management_action" && pendingAction) {
      return await executeManagementAction(pendingAction, userId, session)
    }

    // ACTION: Explicit Cancel Management Action (from 1-tap Cancel button)
    if (action === "cancel_management_action" && pendingAction) {
      return NextResponse.json({
        success: true,
        actionCancelled: true,
        reply: `Understood, I've cancelled that update. Your ${pendingAction.fieldName} remains **${pendingAction.currentValue ?? "unchanged"}**.`,
        pendingAction: null,
      })
    }

    // =========================================================================
    // 2. CONVERSATIONAL CONFIRMATION / CANCELLATION FOR PENDING ACTIONS
    // =========================================================================

    if (pendingAction && pendingAction.status === "proposed" && latestMessage) {
      if (isActionConfirmation(latestMessage)) {
        return await executeManagementAction(pendingAction, userId, session)
      }
      if (isActionCancellation(latestMessage)) {
        return NextResponse.json({
          success: true,
          actionCancelled: true,
          reply: `Understood, I've cancelled that update. Your ${pendingAction.fieldName} remains **${pendingAction.currentValue ?? "unchanged"}**.`,
          pendingAction: null,
        })
      }
    }

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
    // 3.5. ORGANIZER EVENT OVERVIEW & GENERAL ASA INQUIRIES
    // =========================================================================

    // Check if organizer is asking "How many events do I currently have?", "How many events have we done?", "List my events", etc.
    if (isOrganizerEventsOverviewQuery(latestMessage) && draft.status !== "ready_for_review") {
      const userEvents = await prisma.event.findMany({
        where: { organizerId: userId, archived: false },
        select: {
          id: true,
          slug: true,
          title: true,
          confirmedCount: true,
          capacity: true,
          eventDate: true,
          status: true,
          location: true,
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      })

      const events: AsaEventListItem[] = userEvents.map((e) => ({
        id: e.id,
        slug: e.slug,
        title: e.title,
        confirmedCount: e.confirmedCount,
        capacity: e.capacity,
        eventDate: e.eventDate,
        status: e.status,
      }))

      const reply = formatOrganizerEventsOverview(events)

      safeLogAsaInteraction(userId, {
        intent: "organizer_events_overview",
        userQuery: latestMessage,
        eventCount: events.length,
      })

      return NextResponse.json({
        success: true,
        reply,
        eventsList: events,
        isOverview: true,
      })
    }

    // Check if organizer is asking general inquiries about ASA
    const isGeneralAsaInquiry =
      /^(?:who are you|what is asa|what can you do|how can you help|help|what do you do)\??$/i.test(latestMessage.trim()) ||
      latestMessage.toLowerCase() === "asa"
    if (isGeneralAsaInquiry && draft.status !== "ready_for_review") {
      return NextResponse.json({
        success: true,
        reply: "Hi! I'm ASA, your intelligent event partner on EventSlot. Here is what I can do for you:\n\n1. **Event Creation**: Type details naturally or upload a photo of your event flyer with the `+` button.\n2. **Custom Registration Forms**: I can suggest and configure questions for conferences, dinners, webinars, and more.\n3. **Live Intelligence & Metrics**: Ask me *\"How is my event doing?\"*, *\"How many registered today?\"*, or *\"How many events do I currently have?\"*.\n4. **Event Management**: Simply say *\"Increase capacity to 800\"* or *\"Update venue to Sarit Expo\"*.\n\nHow can I help you today?",
      })
    }

    // =========================================================================
    // 4. CONVERSATIONAL EVENT INTELLIGENCE & EVENT MANAGEMENT
    // =========================================================================

    const isIntelligence = isEventIntelligenceQuery(latestMessage)
    const isManagement = isManagementActionQuery(latestMessage)

    // Route to intelligence / management if query matches and not actively reviewing an event creation draft
    if ((isIntelligence || isManagement) && draft.status !== "ready_for_review") {
      const resolved = await resolveTargetEvent(userId, session, eventId, eventSlug, latestMessage)
      if (resolved.error) {
        return NextResponse.json({ success: false, error: resolved.error }, { status: resolved.status || 400 })
      }

      if (resolved.needsDisambiguation) {
        return NextResponse.json({
          success: true,
          reply: "Which event would you like me to check? You have multiple events. Please choose one below:",
          needsDisambiguation: true,
          eventsList: resolved.eventsList,
        })
      }

      if (!resolved.targetEvent) {
        return NextResponse.json({
          success: true,
          reply: "You don't have any active events on EventSlot yet. Would you like me to help you create one?",
        })
      }

      const metrics = await computeEventMetrics(resolved.targetEvent)

      // Check if organizer wants to perform a management action on this event
      if (isManagement) {
        const actionDetected = detectManagementActionIntent(latestMessage, metrics)
        if (actionDetected) {
          return NextResponse.json({
            success: true,
            reply: actionDetected.confirmationMessage,
            pendingAction: actionDetected,
            metrics,
            event: {
              id: resolved.targetEvent.id,
              slug: resolved.targetEvent.slug,
              title: resolved.targetEvent.title,
            },
          })
        }
      }

      // If intelligence question, answer with metrics summary
      return NextResponse.json({
        success: true,
        reply: formatEventMetricsSummary(metrics, latestMessage),
        metrics,
        event: {
          id: resolved.targetEvent.id,
          slug: resolved.targetEvent.slug,
          title: resolved.targetEvent.title,
        },
      })
    }

    // =========================================================================
    // 5. EVENT CREATION ACTIONS
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

async function computeEventMetrics(event: any): Promise<AsaEventMetrics> {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000)

  const [registeredToday, registeredYesterday, checkedInCount] = await Promise.all([
    prisma.registration.count({
      where: {
        eventId: event.id,
        submittedAt: { gte: startOfToday },
        status: { in: ["CONFIRMED", "confirmed"] },
        isDuplicate: false,
      },
    }),
    prisma.registration.count({
      where: {
        eventId: event.id,
        submittedAt: { gte: startOfYesterday, lt: startOfToday },
        status: { in: ["CONFIRMED", "confirmed"] },
        isDuplicate: false,
      },
    }),
    prisma.registration.count({
      where: {
        eventId: event.id,
        checkedIn: true,
      },
    }),
  ])

  const totalConfirmed = event.confirmedCount ?? 0
  const totalWaitlist = event.waitlistCount ?? 0
  const capacity = event.capacity ?? null
  const remainingSlots = capacity !== null ? Math.max(0, capacity - totalConfirmed) : null
  const utilizationPct =
    capacity && capacity > 0 ? Math.min(100, Math.round((totalConfirmed / capacity) * 100)) : null
  const isFull = capacity !== null && totalConfirmed >= capacity
  const remainingExpectedAttendees = Math.max(0, totalConfirmed - checkedInCount)

  let eventDateFormatted: string | null = null
  let timeUntilEvent: string | null = null
  if (event.eventDate) {
    const d = new Date(event.eventDate)
    eventDateFormatted = d.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    })
    const diffMs = d.getTime() - now.getTime()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays > 0) {
      timeUntilEvent = `in ${diffDays} day${diffDays === 1 ? "" : "s"}`
    } else if (diffDays === 0) {
      timeUntilEvent = "today"
    } else {
      timeUntilEvent = `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"} ago`
    }
  }

  return {
    eventId: event.id,
    eventSlug: event.slug,
    eventTitle: event.title,
    totalConfirmed,
    totalWaitlist,
    registeredToday,
    registeredYesterday,
    capacity,
    remainingSlots,
    utilizationPct,
    checkedInCount,
    remainingExpectedAttendees,
    isFull,
    eventDate: eventDateFormatted,
    eventEndAt: event.eventEndAt ? new Date(event.eventEndAt).toISOString() : null,
    timeUntilEvent,
    status: event.status || "active",
    location: event.location || null,
    accessType: event.accessType || "REGISTRATION",
    visibility: event.visibility || "PUBLIC",
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
      confirmedCount: true,
      waitlistCount: true,
      status: true,
      accessType: true,
      visibility: true,
      eventDate: true,
      eventEndAt: true,
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
      error: "Forbidden: You are not authorized to view or manage this event.",
    }
  }

  return { authorized: true, event, status: 200 }
}

async function resolveTargetEvent(
  userId: string,
  session: any,
  passedEventId?: string,
  passedEventSlug?: string,
  userMessage?: string
): Promise<{
  targetEvent: any | null
  needsDisambiguation: boolean
  eventsList: AsaEventListItem[]
  error?: string
  status?: number
}> {
  if (passedEventId || passedEventSlug) {
    const authResult = await findAndAuthorizeEvent(userId, session, passedEventId, passedEventSlug)
    if (!authResult.authorized || !authResult.event) {
      return {
        targetEvent: null,
        needsDisambiguation: false,
        eventsList: [],
        error: authResult.error,
        status: authResult.status,
      }
    }
    return {
      targetEvent: authResult.event,
      needsDisambiguation: false,
      eventsList: [],
    }
  }

  const userEvents = await prisma.event.findMany({
    where: { organizerId: userId, archived: false },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      category: true,
      location: true,
      capacity: true,
      confirmedCount: true,
      waitlistCount: true,
      status: true,
      accessType: true,
      visibility: true,
      eventDate: true,
      eventEndAt: true,
      eventType: true,
      organizerId: true,
      questions: true,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  })

  if (userEvents.length === 0) {
    return {
      targetEvent: null,
      needsDisambiguation: false,
      eventsList: [],
    }
  }

  if (userEvents.length === 1) {
    return {
      targetEvent: userEvents[0],
      needsDisambiguation: false,
      eventsList: [],
    }
  }

  if (userMessage) {
    const msgLower = userMessage.toLowerCase()
    const matched = userEvents.find((e) => msgLower.includes(e.title.toLowerCase()))
    if (matched) {
      return {
        targetEvent: matched,
        needsDisambiguation: false,
        eventsList: [],
      }
    }
  }

  const eventsList: AsaEventListItem[] = userEvents.map((e) => ({
    id: e.id,
    slug: e.slug,
    title: e.title,
    confirmedCount: e.confirmedCount,
    capacity: e.capacity,
    eventDate: e.eventDate,
    status: e.status,
  }))

  return {
    targetEvent: null,
    needsDisambiguation: true,
    eventsList,
  }
}

async function executeManagementAction(
  action: AsaManagementAction,
  userId: string,
  session: any
) {
  const targetEvent = await findAndAuthorizeEvent(userId, session, action.eventId, action.eventSlug)
  if (!targetEvent.authorized || !targetEvent.event) {
    return NextResponse.json({ success: false, error: targetEvent.error }, { status: targetEvent.status })
  }

  let updateData: any = {}
  let fieldDescription = action.fieldName

  switch (action.type) {
    case "UPDATE_CAPACITY": {
      const cap = Number(action.proposedValue)
      updateData = { capacity: Number.isFinite(cap) && cap > 0 ? cap : null }
      fieldDescription = "capacity"
      break
    }
    case "UPDATE_VENUE": {
      updateData = { location: String(action.proposedValue).trim() }
      fieldDescription = "venue"
      break
    }
    case "CLOSE_REGISTRATION": {
      updateData = { status: "closed" }
      fieldDescription = "registration status"
      break
    }
    case "REOPEN_REGISTRATION": {
      updateData = { status: "active" }
      fieldDescription = "registration status"
      break
    }
    default:
      return NextResponse.json({ success: false, error: "Unsupported management action" }, { status: 400 })
  }

  const updatedEvent = await prisma.event.update({
    where: { id: action.eventId },
    data: updateData,
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      category: true,
      location: true,
      capacity: true,
      confirmedCount: true,
      waitlistCount: true,
      status: true,
      accessType: true,
      visibility: true,
      eventDate: true,
      eventEndAt: true,
      eventType: true,
      organizerId: true,
      questions: true,
    },
  })

  const updatedMetrics = await computeEventMetrics(updatedEvent)

  return NextResponse.json({
    success: true,
    actionExecuted: true,
    reply: `✅ Done! I've updated the ${fieldDescription} for **${updatedEvent.title}** to **${action.proposedValue}**.`,
    metrics: updatedMetrics,
    pendingAction: null,
    event: {
      id: updatedEvent.id,
      slug: updatedEvent.slug,
      title: updatedEvent.title,
    },
  })
}

function isEventIntelligenceQuery(text: string): boolean {
  const t = text.toLowerCase()
  return (
    (t.includes("how is") && (t.includes("doing") || t.includes("performing") || t.includes("event") || t.includes("going"))) ||
    (t.includes("how's") && (t.includes("doing") || t.includes("performing") || t.includes("event") || t.includes("going"))) ||
    t.includes("how is my event") ||
    t.includes("how's my event") ||
    t.includes("how is the event") ||
    t.includes("how is my") ||
    t.includes("registered today") ||
    t.includes("register today") ||
    t.includes("slots are remaining") ||
    t.includes("slots remaining") ||
    t.includes("slots left") ||
    t.includes("remaining slots") ||
    t.includes("how many slots") ||
    t.includes("is my event full") ||
    t.includes("is the event full") ||
    t.includes("event full") ||
    t.includes("on the waitlist") ||
    t.includes("waitlist count") ||
    t.includes("waitlist") ||
    t.includes("checked in") ||
    t.includes("check-in") ||
    t.includes("checkin") ||
    t.includes("attendance") ||
    t.includes("event stats") ||
    t.includes("event metrics") ||
    t.includes("how many registered") ||
    t.includes("registration count") ||
    t.includes("how many people")
  )
}

function isManagementActionQuery(text: string): boolean {
  const t = text.toLowerCase()
  return (
    /(?:increase|change|update|set|make)\s+(?:the\s+)?(?:capacity|slots)/i.test(t) ||
    /(?:change|update|move)\s+(?:the\s+)?(?:venue|location)/i.test(t) ||
    /(?:close|stop|pause|shut\s+down)\s+registration/i.test(t) ||
    /(?:reopen|open|resume)\s+registration/i.test(t) ||
    /(?:increase|change|make)\s+(?:them|it|slots)\s+to\s+\d+/i.test(t)
  )
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

  safeLogAsaInteraction(userId, {
    intent: "event_creation",
    createdEventId: newEvent.id,
    title: newEvent.title,
    capacity: newEvent.capacity,
    location: newEvent.location,
  })

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
