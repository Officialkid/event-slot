import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { ratelimit } from '@/lib/ratelimit'
import { createNotification } from '@/lib/notifications'
import { getPlanLimits } from '@/lib/plans'
import { spendCredits } from '@/lib/credits'
type AttendeePayload = { answers: Array<{ questionId: string; value: string }> }
type EventQuestion = { id: string; type: string; label: string; required?: boolean }
type AttendeeResult = { status: 'confirmed' | 'waitlist'; waitlistPosition?: number; registrationId: string; registrationNumber: number }

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1'
  const { success } = await ratelimit.limit(ip)
  if (!success) {
    return NextResponse.json(
      { success: false, error: 'Too many requests. Please try again shortly.' },
      { status: 429 }
    )
  }

  try {
    const body = await req.json()
    const { eventSlug, attendees, consentTransactional, consentMarketing, forceDuplicate } = body as {
      eventSlug: string
      attendees: AttendeePayload[]
      consentTransactional?: boolean
      consentMarketing?: boolean
      forceDuplicate?: boolean
    }

    if (!eventSlug || !Array.isArray(attendees) || attendees.length === 0) {
      return NextResponse.json({ success: false, error: 'Missing eventSlug or attendees' }, { status: 400 })
    }
    if (attendees.length > 20) {
      return NextResponse.json({ success: false, error: 'Maximum 20 attendees per submission' }, { status: 400 })
    }

    // 1. Find event by slug
    const event = await prisma.event.findUnique({ where: { slug: eventSlug } })
    const eventQuestions = (event?.questions as EventQuestion[] | null) ?? []
    if (!event) {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 })
    }

    // 2. Check deadline / closed status
    if (event.status === 'closed') {
      return NextResponse.json({ success: false, error: 'Registration is closed' }, { status: 400 })
    }
    if (event.deadline && new Date(event.deadline) < new Date()) {
      return NextResponse.json({ success: false, error: 'Registration is closed' }, { status: 400 })
    }

    // 3. Duplicate detection (skip if forceDuplicate is set)
    if (!forceDuplicate) {
      const existingRegs = await prisma.registration.findMany({
        where: { eventId: event.id },
        select: { registrationNumber: true, answers: true },
      })

      for (let i = 0; i < attendees.length; i++) {
        const newAnswers = attendees[i].answers
        for (const reg of existingRegs) {
          const existingAnswers = reg.answers as Array<{ questionId: string; value: string }>
          // All submitted answer values must match the existing registration's values
          const allMatch = newAnswers.every(newA => {
            const existingA = existingAnswers.find(e => e.questionId === newA.questionId)
            return (existingA?.value?.trim().toLowerCase() ?? '') === (newA.value?.trim().toLowerCase() ?? '')
          })

          if (allMatch && newAnswers.length > 0) {
            // Extract name from the first text/name-type question
            const nameQ = eventQuestions.find(q =>
              q.type === 'text' && q.label.toLowerCase().includes('name')
            )
            const name = nameQ
              ? (existingAnswers.find(a => a.questionId === nameQ.id)?.value?.trim() ?? '')
              : ''

            // Extract phone from tel/phone question
            const phoneQ = eventQuestions.find(q =>
              q.type === 'tel' || q.label.toLowerCase().includes('phone')
            )
            const phone = phoneQ
              ? (existingAnswers.find(a => a.questionId === phoneQ.id)?.value?.trim() ?? '')
              : ''
            const maskedPhone = phone.length >= 5
              ? phone.slice(0, 2) + '****' + phone.slice(-2)
              : phone

            return NextResponse.json({
              success: false,
              duplicate: true,
              attendeeIndex: i,
              existing: {
                registrationNumber: reg.registrationNumber,
                name,
                maskedPhone,
              },
            }, { status: 409 })
          }
        }
      }
    }

    // 4. Process each attendee sequentially inside a transaction
    const results = await prisma.$transaction(async (tx): Promise<AttendeeResult[]> => {
      const attendeeResults: AttendeeResult[] = []

      for (const attendee of attendees) {
        const freshEvent = await tx.event.findUnique({ where: { slug: eventSlug } })
        if (!freshEvent) throw new Error('Event not found')

        let status: 'confirmed' | 'waitlist'
        let waitlistPosition: number | undefined = undefined

        if (freshEvent.capacity != null && freshEvent.confirmedCount >= freshEvent.capacity) {
          status = 'waitlist'
        } else {
          status = 'confirmed'
        }

        const emailAnswer = attendee.answers.find(a => {
          const question = eventQuestions.find(q => q.id === a.questionId)
          return question?.type === 'email'
        })
        const attendeeEmail = emailAnswer?.value ?? null

        // Sequential registration number per event
        const existingCount = await tx.registration.count({ where: { eventId: freshEvent.id } })
        const registrationNumber = existingCount + 1

        let registrationId: string

        if (status === 'confirmed') {
          const reg = await tx.registration.create({
            data: {
              eventId: freshEvent.id,
              answers: attendee.answers,
              status,
              registrationNumber,
              submittedAt: new Date(),
              notified: false,
              attendeeEmail,
              consentTransactional: consentTransactional ?? false,
              consentMarketing: consentMarketing ?? false,
              isDuplicate: forceDuplicate ?? false,
            },
          })
          registrationId = reg.id
          await tx.event.update({
            where: { id: freshEvent.id },
            data: { confirmedCount: { increment: 1 } },
          })
        } else {
          const updatedEvent = await tx.event.update({
            where: { id: freshEvent.id },
            data: { waitlistCount: { increment: 1 } },
          })
          waitlistPosition = updatedEvent.waitlistCount
          const reg = await tx.registration.create({
            data: {
              eventId: freshEvent.id,
              answers: attendee.answers,
              status,
              waitlistPosition,
              registrationNumber,
              submittedAt: new Date(),
              notified: false,
              attendeeEmail,
              consentTransactional: consentTransactional ?? false,
              consentMarketing: consentMarketing ?? false,
              isDuplicate: forceDuplicate ?? false,
            },
          })
          registrationId = reg.id
        }

        attendeeResults.push({ status, waitlistPosition, registrationId, registrationNumber })
      }

      return attendeeResults
    })

    // Per-registration notifications for organizer (non-blocking)
    if (event.organizerId) {
      try {
        for (let i = 0; i < results.length; i++) {
          const reg = results[i]
          const regAnswers = attendees[i]?.answers ?? []
          const nameQ = eventQuestions.find(q => q.type === 'text' && q.label.toLowerCase().includes('name'))
          const name = nameQ ? (regAnswers.find(a => a.questionId === nameQ.id)?.value?.trim() || '') : ''
          const who = name || 'Someone'
          const msg = reg.status === 'confirmed'
            ? `${who} registered for "${event.title}" (#${reg.registrationNumber})`
            : `${who} joined the waitlist for "${event.title}" (waitlist #${reg.waitlistPosition})`
          await createNotification({ userId: event.organizerId, type: 'registration', message: msg, eventId: event.id })
        }
      } catch { /* non-critical */ }
    }

    // Trigger fill-rate notifications (non-blocking, best-effort)
    if (event.capacity && event.organizerId) {
      try {
        const updatedEvent = await prisma.event.findUnique({ where: { slug: eventSlug } })
        if (updatedEvent) {
          const oldFill = event.confirmedCount / event.capacity
          const newFill = updatedEvent.confirmedCount / event.capacity
          if (newFill >= 1.0 && oldFill < 1.0) {
            await createNotification({
              userId: event.organizerId,
              type: "full",
              message: `Your event "${event.title}" is now full. ${updatedEvent.waitlistCount} ${updatedEvent.waitlistCount === 1 ? "person is" : "people are"} on the waitlist.`,
              eventId: event.id,
            })
          } else if (newFill >= 0.8 && oldFill < 0.8) {
            await createNotification({
              userId: event.organizerId,
              type: "info",
              message: `Your event "${event.title}" is 80% full. Consider increasing capacity.`,
              eventId: event.id,
            })
          }
        }
      } catch {
        // Notifications are non-critical; do not fail the registration
      }
    }

    // Pay-as-you-go overage check (non-blocking)
    if (event.organizerId) {
      try {
        const confirmedResults = results.filter(r => r.status === 'confirmed')
        if (confirmedResults.length > 0) {
          const organizer = await prisma.user.findUnique({
            where: { id: event.organizerId },
            select: { id: true, plan: true },
          })
          if (organizer && organizer.plan !== 'business') {
            const limits = getPlanLimits(organizer.plan)
            const updatedEvent = await prisma.event.findUnique({
              where: { id: event.id },
              select: { confirmedCount: true },
            })
            const newCount = updatedEvent?.confirmedCount ?? 0
            const threshold = limits.freeRegistrationsPerEvent as number

            if (threshold !== Infinity && newCount > threshold) {
              const overage = newCount - threshold
              const isNewBlock = overage % 100 <= confirmedResults.length

              if (isNewBlock) {
                const result = await spendCredits({
                  userId: organizer.id,
                  amount: 1.00,
                  description: `100 registrations overage for "${event.title}"`,
                  eventId: event.id,
                })

                if (!result.success) {
                  await createNotification({
                    userId: organizer.id,
                    type: 'credits_required',
                    message: `Your event "${event.title}" has exceeded your free registration limit. Add credits to continue accepting registrations.`,
                    eventId: event.id,
                  })
                }
              }
            }
          }
        }
      } catch { /* non-critical */ }
    }

    return NextResponse.json({
      success: true,
      results,
      eventTitle: event.title,
    }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    try { await prisma.errorLog.create({ data: { route: '/api/register', message } }) } catch { /* non-critical */ }
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

