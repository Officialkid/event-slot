import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import prisma from '@/lib/prisma'
import { ratelimit } from '@/lib/ratelimit'
import { createNotification } from '@/lib/notifications'
import {
  sendConfirmationEmail,
  sendWaitlistJoinedEmail,
  sendOrganizerFirstWaitlistEmail,
} from '@/lib/email'
import { generateConfirmationCode } from '@/lib/confirmationCode'
import { generateTicketForRegistration } from '@/lib/tickets'
import { detectCountry } from '@/lib/geoip'
import { createCalendarEvent, isCalendarConnected } from '@/lib/googleCalendar'
import { decrypt } from '@/lib/encrypt'
import { APP_URL } from '@/lib/config'
import { canUseWaitlist } from '@/lib/planEnforcement'
import { getEffectivePlanPolicy } from '@/lib/effectivePlanPolicy'
import { isPricingRolloutActive } from '@/lib/pricingRollout'
import { sendEventCapacityMilestones } from '@/lib/capacityNotifications'
type AttendeePayload = { answers: Array<{ questionId: string; value: string }>; baseEmail?: string }
type EventQuestion = { id: string; type: string; label: string; required?: boolean }
type AttendeeResult = { status: 'confirmed' | 'waitlist'; waitlistPosition?: number; registrationId: string; registrationNumber: number; confirmationCode?: string }

function getDurationMins(startIso: Date | null | undefined, endIso: Date | null | undefined) {
  if (!startIso || !endIso) return 120
  const diff = Math.round((endIso.getTime() - startIso.getTime()) / 60000)
  return diff > 0 ? diff : 120
}

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
    const { eventSlug, attendees, consentTransactional, consentMarketing, forceDuplicate, source, refCode, utmSource } = body as {
      eventSlug: string
      attendees: AttendeePayload[]
      consentTransactional?: boolean
      consentMarketing?: boolean
      forceDuplicate?: boolean
      source?: string
      refCode?: string
      utmSource?: string
    }

    const normalizedSource = typeof source === 'string' && source.trim().length > 0 ? source.trim().toLowerCase() : 'unknown'
    const normalizedRefCode = typeof refCode === 'string' && refCode.trim().length > 0 ? refCode.trim() : null
    const normalizedUtmSource = typeof utmSource === 'string' && utmSource.trim().length > 0 ? utmSource.trim() : null

    if (!eventSlug || !Array.isArray(attendees) || attendees.length === 0) {
      return NextResponse.json({ success: false, error: 'Missing eventSlug or attendees' }, { status: 400 })
    }
    if (attendees.length > 20) {
      return NextResponse.json({ success: false, error: 'Maximum 20 attendees per submission' }, { status: 400 })
    }

    // 1. Find event by slug
    const event = await prisma.event.findUnique({ where: { slug: eventSlug }, include: { organizer: { select: { username: true, email: true } } } })
    const eventQuestions = (event?.questions as EventQuestion[] | null) ?? []
    if (!event) {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 })
    }

    // Plan enforcement — check organizer's attendee cap for this event
    const organizerPlanKey = event.organizerId
      ? (await prisma.user.findUnique({
          where: { id: event.organizerId },
          select: {
            plan: true,
            paygSettings: {
              select: {
                id: true,
                isEnabled: true,
                monthlyCapUsd: true,
              },
            },
          },
        }))
      : null

    const effectivePlan = getEffectivePlanPolicy(organizerPlanKey?.plan)
    let planWaitlistForced = false
    if (event.organizerId) {
      const organizerEmail = event.organizer?.email ?? ''
      const currentCount = event.confirmedCount
      const paygEnabled = Boolean(organizerPlanKey?.paygSettings?.isEnabled)
      if (
        isPricingRolloutActive() &&
        effectivePlan.maxAttendeesPerEvent !== -1 &&
        currentCount >= effectivePlan.maxAttendeesPerEvent &&
        !paygEnabled
      ) {
        const waitlistCheck = await canUseWaitlist(event.organizerId, organizerEmail)
        if (!waitlistCheck.allowed) {
          return NextResponse.json(
            { success: false, error: 'This event is full and the waitlist is not available.', code: 'EVENT_FULL' },
            { status: 409 }
          )
        }
        planWaitlistForced = true
      }
    }

    // 2. Check deadline / closed status
    if (event.status === 'closed' || event.status === 'COMPLETED') {
      return NextResponse.json({ success: false, error: 'Registration is closed' }, { status: 400 })
    }
    const effectiveCloseAt = event.deadline ?? event.eventEndAt ?? null
    if (effectiveCloseAt && new Date(effectiveCloseAt) < new Date()) {
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
    const registrationCountryCode = await detectCountry(req).catch(() => null)
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

        // Override to waitlist if organizer's plan attendee cap is reached and PAYG is not enabled.
        const paygEnabled = Boolean(organizerPlanKey?.paygSettings?.isEnabled)
        if (
          planWaitlistForced ||
          (isPricingRolloutActive() &&
            effectivePlan.maxAttendeesPerEvent !== -1 &&
            freshEvent.confirmedCount >= effectivePlan.maxAttendeesPerEvent &&
            !paygEnabled)
        ) {
          status = 'waitlist'
        }

        const emailAnswer = attendee.answers.find(a => {
          const question = eventQuestions.find(q => q.id === a.questionId)
          return question?.type === 'email'
        })
        const attendeeEmail = emailAnswer?.value ?? attendee.baseEmail ?? null

        // Sequential registration number per event
        const existingCount = await tx.registration.count({ where: { eventId: freshEvent.id } })
        const registrationNumber = existingCount + 1

        let registrationId: string

        if (status === 'confirmed') {
          const confirmationCode = generateConfirmationCode()
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
              qrCode: uuidv4(),
              confirmationCode,
              source: normalizedSource,
              refCode: normalizedRefCode,
              utmSource: normalizedUtmSource,
              countryCode: registrationCountryCode ?? undefined,
            },
          })
          registrationId = reg.id
          attendeeResults.push({ status, registrationId, registrationNumber, confirmationCode })
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
              source: normalizedSource,
              refCode: normalizedRefCode,
              utmSource: normalizedUtmSource,
              countryCode: registrationCountryCode ?? undefined,
            },
          })
          registrationId = reg.id
          attendeeResults.push({ status, waitlistPosition, registrationId, registrationNumber })
        }

      }

      return attendeeResults
    })

    // Auto-generate tickets for confirmed registrations (non-blocking, idempotent)
    try {
      await Promise.all(
        results
          .filter((r) => r.status === 'confirmed')
          .map((r) => generateTicketForRegistration(r.registrationId))
      )
    } catch { /* non-critical */ }

    // Waitlist intelligence notification (non-blocking)
    if (event.organizerId && event.capacity && event.capacity > 0) {
      try {
        const updatedEvent = await prisma.event.findUnique({
          where: { id: event.id },
          select: { waitlistCount: true },
        })
        const waitlistCount = updatedEvent?.waitlistCount ?? 0
        const prevWaitlistCount = waitlistCount - results.filter(r => r.status === 'waitlist').length

        const crossedThreshold =
          (waitlistCount >= 5 && prevWaitlistCount < 5) ||
          (waitlistCount >= 10 && prevWaitlistCount < 10) ||
          (Math.floor(waitlistCount / 25) > Math.floor(prevWaitlistCount / 25) && waitlistCount >= 25)

        if (crossedThreshold && waitlistCount > 0) {
          const suggestedIncrease = Math.min(waitlistCount, Math.round(event.capacity * 0.2))
          await createNotification({
            userId: event.organizerId,
            type: 'EVENT',
            title: 'Waitlist Growing',
            message: `${waitlistCount} ${waitlistCount === 1 ? 'person is' : 'people are'} waiting for "${event.title}". Increasing capacity by ${suggestedIncrease} would confirm ${suggestedIncrease} of them immediately.`,
            link: `/dashboard/events/${event.slug}#capacity`,
          })
        }

        // One-time email when the first person joins the waitlist
        if (prevWaitlistCount === 0 && waitlistCount >= 1) {
          const organizer = await prisma.user.findUnique({
            where: { id: event.organizerId },
            select: { email: true, consentSystemEmails: true },
          })
          if (organizer?.email && organizer.consentSystemEmails) {
            sendOrganizerFirstWaitlistEmail({
              to: organizer.email,
              eventTitle: event.title,
            }).catch(() => {})
          }
        }
      } catch { /* non-critical */ }
    }

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
          await createNotification({
            userId: event.organizerId,
            type: 'EVENT',
            title: 'New Registration',
            message: msg,
            link: `/dashboard/events/${event.slug}`,
          })
        }
      } catch { /* non-critical */ }
    }

    // Send confirmation emails for newly confirmed attendees (non-blocking)
    try {
      const confirmedToNotify = results
        .map((reg, index) => ({ reg, attendee: attendees[index] }))
        .filter(({ reg }) => reg.status === 'confirmed' && !!reg.confirmationCode)

      await Promise.all(
        confirmedToNotify.map(async ({ reg, attendee }) => {
          const answers = attendee?.answers ?? []
          const emailQuestion = eventQuestions.find((q) => q.type === 'email')
          const nameQuestion = eventQuestions.find(
            (q) => q.type === 'text' && q.label.toLowerCase().includes('name')
          )

          const attendeeEmail =
            (emailQuestion
              ? answers.find((a) => a.questionId === emailQuestion.id)?.value?.trim()
              : '') || attendee?.baseEmail?.trim() || ''

          if (!attendeeEmail) return

          const attendeeName =
            (nameQuestion
              ? answers.find((a) => a.questionId === nameQuestion.id)?.value?.trim()
              : '') || 'there'

          const user = await prisma.user.findUnique({
            where: { email: attendeeEmail.toLowerCase() },
            select: { id: true },
          })

          await sendConfirmationEmail({
            to: attendeeEmail,
            name: attendeeName,
            eventTitle: event.title,
            confirmationNumber: reg.confirmationCode as string,
            userId: user?.id ?? null,
            eventDate: event.eventDate,
            eventSlug: event.slug,
            eventLocation: event.location,
          })

          // Auto-push to Google Calendar if attendee has it connected
          if (user?.id && event.eventDate) {
            const isVirtual = event.eventType === 'VIRTUAL'
            const meetingLink = isVirtual && event.virtualLink
              ? decrypt(event.virtualLink, event.virtualLinkIv ?? '')
              : null
            const organizerUsername = event.organizer?.username
            const eventUrl = organizerUsername
              ? `${APP_URL}/${organizerUsername}/${event.slug}`
              : `${APP_URL}/join/${event.slug}`
            createCalendarEvent({
              userId:       user.id,
              eventSlotId:  event.id,
              role:         'attendee',
              title:        event.title,
              description:  `You're registered for ${event.title}!\n\nConfirmation: ${reg.confirmationCode}`,
              location:     event.location,
              startDate:    new Date(event.eventDate),
              durationMins: getDurationMins(event.eventDate, event.eventEndAt),
              eventUrl,
              isVirtual,
              meetingLink,
            }).catch(err => console.error('[calendar] Auto-push after registration failed:', err))
          }
        })
      )
    } catch {
      // Email delivery should never block registration success.
    }

    // Send waitlist joined email + calendar push for waitlisted attendees (non-blocking)
    try {
      const waitlistedToNotify = results
        .map((reg, index) => ({ reg, attendee: attendees[index] }))
        .filter(({ reg }) => reg.status === 'waitlist')

      await Promise.all(
        waitlistedToNotify.map(async ({ reg, attendee }) => {
          const answers = attendee?.answers ?? []
          const emailQuestion = eventQuestions.find((q) => q.type === 'email')
          const attendeeEmail =
            (emailQuestion
              ? answers.find((a) => a.questionId === emailQuestion.id)?.value?.trim()
              : '') || attendee?.baseEmail?.trim() || ''

          if (!attendeeEmail) return

          // Fire-and-forget waitlist join confirmation email with calendar links
          sendWaitlistJoinedEmail({
            to:               attendeeEmail,
            eventTitle:       event.title,
            waitlistPosition: reg.waitlistPosition,
            eventDate:        event.eventDate,
            eventSlug:        event.slug,
            eventLocation:    event.location,
          }).catch(err => console.error('[email] Waitlist join email failed:', err))

          // Auto-push to Google Calendar if attendee has it connected
          const user = await prisma.user.findUnique({
            where:  { email: attendeeEmail.toLowerCase() },
            select: { id: true },
          })
          if (user?.id && event.eventDate) {
            const calendarConnected = await isCalendarConnected(user.id)
            if (calendarConnected) {
              const organizerUsername = event.organizer?.username
              const eventUrl = organizerUsername
                ? `${APP_URL}/${organizerUsername}/${event.slug}`
                : `${APP_URL}/join/${event.slug}`
              createCalendarEvent({
                userId:       user.id,
                eventSlotId:  event.id,
                role:         'attendee',
                title:        `[Waitlisted] ${event.title}`,
                description:  [
                  `You are on the waitlist for ${event.title}.`,
                  `Waitlist position: #${reg.waitlistPosition ?? '?'}`,
                  '',
                  `You will be notified if a spot opens up.`,
                  `Check your status: ${eventUrl}`,
                ].join('\n'),
                location:     event.location,
                startDate:    new Date(event.eventDate),
                durationMins: getDurationMins(event.eventDate, event.eventEndAt),
                eventUrl,
                isVirtual:    event.eventType === 'VIRTUAL',
                meetingLink:  null, // No meeting link for waitlisted attendees
              }).catch(err => console.error('[calendar] Waitlist calendar push failed:', err))
            }
          }
        })
      )
    } catch {
      // Non-critical
    }

    if (event.capacity && event.organizerId) {
      await sendEventCapacityMilestones({
        eventId: event.id,
        eventSlug: event.slug,
        eventTitle: event.title,
        organizerId: event.organizerId,
        previousConfirmedCount: event.confirmedCount,
        capacity: event.capacity,
      }).catch(() => {})
    }

    if (
      event.organizerId &&
      organizerPlanKey?.paygSettings?.id &&
      organizerPlanKey.paygSettings.isEnabled &&
      isPricingRolloutActive() &&
      effectivePlan.maxAttendeesPerEvent !== -1
    ) {
      const updatedEvent = await prisma.event.findUnique({
        where: { id: event.id },
        select: { confirmedCount: true },
      })

      const previousOverage = Math.max(0, event.confirmedCount - effectivePlan.maxAttendeesPerEvent)
      const newOverage = Math.max(0, (updatedEvent?.confirmedCount ?? event.confirmedCount) - effectivePlan.maxAttendeesPerEvent)
      const overageAdded = newOverage - previousOverage

      if (overageAdded > 0) {
        const billingMonth = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`
        await prisma.paygUsage.create({
          data: {
            paygSettingsId: organizerPlanKey.paygSettings.id,
            userId: event.organizerId,
            billingMonth,
            usageType: 'EXTRA_ATTENDEE',
            quantity: overageAdded,
            unitCostUsd: 0.05,
            totalCostUsd: overageAdded * 0.05,
            description: `Extra attendee usage for "${event.title}"`,
            eventId: event.id,
          },
        }).catch(() => {})
      }
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

