import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { generateConfirmationCode } from '@/lib/confirmationCode'

type EventQuestion = { id: string; type: string; label: string; required?: boolean }

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const body = await req.json()

    if (!Array.isArray(body.answers) || body.answers.length === 0) {
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
    const hasValidToken = !!(body.token && event.dashboardToken === body.token)

    if (!isOwner && !hasValidToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { answers, status, forceDuplicate } = body as {
      answers: Array<{ questionId: string; value: string }>
      status?: string
      token?: string
      forceDuplicate?: boolean
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

    // Duplicate detection (same name answer as an existing registration)
    if (!forceDuplicate) {
      const nameQ = questions.find(q => q.label.toLowerCase().includes('name') && q.type === 'text')
      if (nameQ) {
        const nameValue = answers.find(a => a.questionId === nameQ.id)?.value?.trim()?.toLowerCase()
        if (nameValue) {
          const allRegs = await prisma.registration.findMany({
            where: { eventId: event.id, status: { in: ['confirmed', 'waitlist'] } },
            select: { registrationNumber: true, answers: true },
          })
          const existing = allRegs.find(r => {
            const ans = r.answers as Array<{ questionId: string; value: string }>
            return ans.some(a => a.questionId === nameQ.id && a.value?.trim().toLowerCase() === nameValue)
          })
          if (existing) {
            return NextResponse.json(
              { duplicate: true, existing: { registrationNumber: existing.registrationNumber } },
              { status: 409 }
            )
          }
        }
      }
    }

    // Capacity enforcement: if event is at or over capacity, force waitlist
    const eventFull = await prisma.event.findUnique({
      where: { id: event.id },
      select: { capacity: true, confirmedCount: true },
    })
    const atCapacity = !!(eventFull?.capacity && eventFull.confirmedCount >= eventFull.capacity)
    const forcedStatus = (status === 'waitlist' || atCapacity) ? 'waitlist' : 'confirmed'

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
          ...(forcedStatus === 'confirmed' ? { qrCode: uuidv4(), confirmationCode: generateConfirmationCode() } : {}),
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
      movedToWaitlist: atCapacity && status === 'confirmed',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

