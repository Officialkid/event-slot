import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { v4 as uuidv4 } from "uuid"
import { generateVerifierCode } from "@/lib/verifierCode"
import { canCreateEvent } from "@/lib/planEnforcement"
import { processFirstEventReferral } from "@/lib/referral"
import { APP_URL } from "@/lib/config"
import {
  processAsaConversation,
  type AsaEventDraft,
  type AsaMessage,
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
      return NextResponse.json({ success: false, error: "Unauthorized. Please sign in to create events with ASA." }, { status: 401 })
    }

    const userId = session.user.id
    const userEmail = session.user.email ?? ""
    const userName = session.user.name ?? "Organizer"

    // Plan check
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

    let body: {
      messages?: AsaMessage[]
      draft?: AsaEventDraft
      action?: "confirm_create" | "reset"
    }

    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 })
    }

    const { messages = [], draft = { status: "collecting" }, action } = body

    // 1. Direct explicit create action from UI button
    if (action === "confirm_create" || draft.status === "confirmed") {
      return await executeEventCreation(draft, userId, userEmail, userName)
    }

    // 2. Process conversation turn
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

  return NextResponse.json({
    success: true,
    created: true,
    reply: `🎉 Congratulations! I've created your event **${newEvent.title}**!

Here is your live registration link:
${publicUrl}

You can manage attendees, customize tickets, and review your event from your Event Dashboard.`,
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
  })
}
