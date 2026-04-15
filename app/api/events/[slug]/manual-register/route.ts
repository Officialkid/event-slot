import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

type EventQuestion = { id: string; type: string; label: string; required?: boolean }

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const body = await req.json()
    const { answers, status, token } = body as {
      answers: Array<{ questionId: string; value: string }>
      status?: string
      token?: string
    }

    if (!Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json({ error: 'Invalid answers' }, { status: 400 })
    }

    const event = await prisma.event.findUnique({
      where: { slug: params.slug },
      select: {
        id: true,
        questions: true,
        organizerId: true,
        dashboardToken: true,
      },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Auth: session ownership OR valid dashboardToken
    const session = await getServerSession(authOptions)
    const isOwner = !!(session?.user?.id && event.organizerId === session.user.id)
    const hasValidToken = !!(token && event.dashboardToken === token)

    if (!isOwner && !hasValidToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Server-side required field validation
    const questions = (event.questions as EventQuestion[]) ?? []
    for (const q of questions) {
      if (q.required) {
        const answer = answers.find(a => a.questionId === q.id)
        if (!answer?.value?.trim()) {
          return NextResponse.json({ error: `"${q.label}" is required` }, { status: 400 })
        }
      }
    }

    // Organizer chooses status; capacity check bypassed for manual registrations
    const forcedStatus = status === 'waitlist' ? 'waitlist' : 'confirmed'

    // Extract email answer if present
    const emailAnswer = answers.find(a => {
      const q = questions.find(q => q.id === a.questionId)
      return q?.type === 'email'
    })
    const attendeeEmail = emailAnswer?.value ?? null

    const registration = await prisma.$transaction(async (tx) => {
      const existingCount = await tx.registration.count({ where: { eventId: event.id } })
      const registrationNumber = existingCount + 1

      let waitlistPosition: number | undefined

      if (forcedStatus === 'waitlist') {
        const updated = await tx.event.update({
          where: { id: event.id },
          data: { waitlistCount: { increment: 1 } },
        })
        waitlistPosition = updated.waitlistCount
      }

      const created = await tx.registration.create({
        data: {
          eventId: event.id,
          answers,
          status: forcedStatus,
          registrationNumber,
          waitlistPosition,
          submittedAt: new Date(),
          notified: false,
          attendeeEmail,
          isDuplicate: false,
          source: 'manual',
          ...(forcedStatus === 'confirmed' ? { qrCode: uuidv4() } : {}),
        },
      })

      if (forcedStatus === 'confirmed') {
        await tx.event.update({
          where: { id: event.id },
          data: { confirmedCount: { increment: 1 } },
        })
      }

      return created
    })

    return NextResponse.json({
      success: true,
      status: registration.status,
      registrationId: registration.id,
      registrationNumber: registration.registrationNumber,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

