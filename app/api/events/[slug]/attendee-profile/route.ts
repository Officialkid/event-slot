import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { hasTeamEventAccess } from "@/lib/eventAccess"
import { hasOrganiserAccess } from "@/lib/adminMode"
import { hasDashboardOrVerifierToken } from "@/lib/eventVerifierAccess"
import { verifyQRPayload } from "@/lib/ticket-qr"

type EventQuestion = { id: string; type: string; label: string }

type ResolvedRecord = {
  ticketCode: string
  scannedAt: Date | null
  registration: {
    id: string
    status: string
    submittedAt: Date
    attendeeEmail: string | null
    confirmationCode: string | null
    answers: Array<{ questionId: string; value: string }>
  }
}

function extractCode(input: string): string {
  const raw = input.trim()
  if (!raw) return ""

  try {
    const parsed = new URL(raw)
    const parts = parsed.pathname.split("/").filter(Boolean)
    const verifyIdx = parts.findIndex((p) => p.toLowerCase() === "verify")
    if (verifyIdx >= 0 && parts[verifyIdx + 1]) {
      return decodeURIComponent(parts[verifyIdx + 1])
    }
  } catch {
    // Continue with raw input for non-URL values.
  }

  return raw
}

function getNameFromAnswers(answers: Array<{ questionId: string; value: string }>, questions: EventQuestion[]): string {
  const nameQuestionIds = questions
    .filter((q) => q.type === "text" && q.label.toLowerCase().includes("name"))
    .map((q) => q.id)

  if (nameQuestionIds.length === 0) return ""
  const hit = answers.find((a) => nameQuestionIds.includes(a.questionId) && a.value?.trim())
  return hit?.value?.trim() ?? ""
}

function mapAnswers(
  answers: Array<{ questionId: string; value: string }>,
  questions: EventQuestion[]
): Array<{ question: string; answer: string }> {
  const labelMap = new Map<string, string>()
  for (const q of questions) {
    labelMap.set(q.id, q.label)
  }

  return answers
    .filter((a) => a.value?.trim())
    .map((a) => ({
      question: labelMap.get(a.questionId) ?? "Custom question",
      answer: a.value,
    }))
}

async function resolveTicketOrRegistration(eventId: string, inputCode: string): Promise<ResolvedRecord | null> {
  const normalizedCode = extractCode(inputCode)
  if (!normalizedCode) return null

  const qrPayload = normalizedCode.includes(":") ? normalizedCode : ""
  if (qrPayload) {
    const verified = verifyQRPayload(qrPayload)
    if (verified.valid && verified.eventId === eventId && verified.ticketId) {
      const byTicketCode = await prisma.ticket.findUnique({
        where: { code: verified.ticketId.toUpperCase() },
        include: {
          registration: {
            select: {
              id: true,
              eventId: true,
              status: true,
              submittedAt: true,
              attendeeEmail: true,
              confirmationCode: true,
              answers: true,
            },
          },
        },
      })

      if (byTicketCode && byTicketCode.registration.eventId === eventId) {
        return {
          ticketCode: byTicketCode.code,
          scannedAt: byTicketCode.scannedAt,
          registration: {
            ...byTicketCode.registration,
            answers: byTicketCode.registration.answers as Array<{ questionId: string; value: string }>,
          },
        }
      }
    }
  }

  const byTicketCode = await prisma.ticket.findUnique({
    where: { code: normalizedCode.toUpperCase() },
    include: {
      registration: {
        select: {
          id: true,
          eventId: true,
          status: true,
          submittedAt: true,
          attendeeEmail: true,
          confirmationCode: true,
          answers: true,
        },
      },
    },
  })

  if (byTicketCode && byTicketCode.registration.eventId === eventId) {
    return {
      ticketCode: byTicketCode.code,
      scannedAt: byTicketCode.scannedAt,
      registration: {
        ...byTicketCode.registration,
        answers: byTicketCode.registration.answers as Array<{ questionId: string; value: string }>,
      },
    }
  }

  const byConfirmationCode = await prisma.registration.findFirst({
    where: {
      eventId,
      confirmationCode: normalizedCode,
    },
    include: {
      ticket: true,
    },
  })

  if (!byConfirmationCode) return null

  return {
    ticketCode: byConfirmationCode.ticket?.code ?? byConfirmationCode.confirmationCode ?? byConfirmationCode.id,
    scannedAt: byConfirmationCode.ticket?.scannedAt ?? byConfirmationCode.checkedInAt,
    registration: {
      id: byConfirmationCode.id,
      status: byConfirmationCode.status,
      submittedAt: byConfirmationCode.submittedAt,
      attendeeEmail: byConfirmationCode.attendeeEmail,
      confirmationCode: byConfirmationCode.confirmationCode,
      answers: byConfirmationCode.answers as Array<{ questionId: string; value: string }>,
    },
  }
}

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params

  try {
    const code = req.nextUrl.searchParams.get("code")?.trim() ?? ""
    const token = req.nextUrl.searchParams.get("token")?.trim() ?? ""

    if (!code) {
      return NextResponse.json({ error: "Code required" }, { status: 400 })
    }

    const event = await prisma.event.findFirst({
      where: { OR: [{ slug }, { id: slug }] },
      select: { id: true, organizerId: true, dashboardToken: true, verifierCode: true, verifierCodeEnabled: true, questions: true },
    })

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    const session = await getServerSession(authOptions)
    const isOwner = !!(session?.user?.id && event.organizerId === session.user.id)
    const hasValidToken = hasDashboardOrVerifierToken(token, event)
    const hasTeamAccess = !!(session?.user?.id && (await hasTeamEventAccess({
      userId: session.user.id,
      organizerId: event.organizerId,
      eventId: event.id,
    })))
    const adminAccess = !!(session && await hasOrganiserAccess(session, event.id))

    if (!isOwner && !hasValidToken && !hasTeamAccess && !adminAccess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const record = await resolveTicketOrRegistration(event.id, code)
    if (!record) {
      return NextResponse.json({ found: false }, { status: 200 })
    }

    const questions = (event.questions as EventQuestion[]) ?? []
    const attendeeName = getNameFromAnswers(record.registration.answers, questions) || "Attendee"

    const noteCandidates = [record.ticketCode, record.registration.confirmationCode, record.registration.id].filter(Boolean) as string[]

    const notes = await prisma.entryLog.findMany({
      where: {
        eventId: event.id,
        ticketId: { in: noteCandidates },
        failReason: { startsWith: "NOTE:" },
      },
      orderBy: { scannedAt: "desc" },
      take: 5,
      select: { failReason: true, scannedAt: true },
    })

    return NextResponse.json({
      found: true,
      ticketCode: record.ticketCode,
      alreadyScanned: Boolean(record.scannedAt),
      scannedAt: record.scannedAt,
      attendee: {
        name: attendeeName,
        email: record.registration.attendeeEmail,
        registrationDate: record.registration.submittedAt,
        status: record.registration.status,
        customAnswers: mapAnswers(record.registration.answers, questions),
        notes: notes.map((n) => ({
          content: (n.failReason ?? "").replace(/^NOTE:\s*/i, ""),
          createdAt: n.scannedAt,
        })),
      },
    })
  } catch (error) {
    console.error("[events/attendee-profile] GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
