import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { detectCountry } from '@/lib/geoip'
import { parseAttendeeIdentity } from '@/lib/paidEvents'
import { calculatePaidEventCommission } from '@/lib/paidEventCommission'
import { normalizeMpesaPhone, startIntaSendStkPush } from '@/lib/intasend'
import { joinPaidEventWaitlist } from '@/lib/paymentFinalizers'

type AttendeePayload = {
  answers: Array<{ questionId: string; value: string }>
  baseEmail?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      eventSlug,
      ticketTierId,
      attendee,
      consentTransactional,
      consentMarketing,
      paymentMethod,
      mpesaPhone,
      source,
      refCode,
      utmSource,
    } = body as {
      eventSlug: string
      ticketTierId: string
      attendee: AttendeePayload
      consentTransactional?: boolean
      consentMarketing?: boolean
      paymentMethod: 'mpesa' | 'card'
      mpesaPhone?: string
      source?: string
      refCode?: string
      utmSource?: string
    }

    if (!eventSlug || !ticketTierId || !attendee?.answers?.length) {
      return NextResponse.json({ success: false, error: 'Missing required checkout details' }, { status: 400 })
    }

    if (paymentMethod !== 'mpesa') {
      return NextResponse.json({ success: false, error: 'Card payments are coming soon. Please use M-Pesa for now.' }, { status: 400 })
    }

    if (!mpesaPhone?.trim()) {
      return NextResponse.json({ success: false, error: 'M-Pesa phone number is required' }, { status: 400 })
    }

    const event = await prisma.event.findUnique({
      where: { slug: eventSlug },
      select: {
        id: true,
        slug: true,
        title: true,
        isPaid: true,
        status: true,
        deadline: true,
        eventEndAt: true,
        confirmedCount: true,
        waitlistCount: true,
        questions: true,
        organizerEmail: true,
        organizer: { select: { plan: true } },
        ticketTiers: {
          where: { id: ticketTierId, status: 'ACTIVE' },
          select: {
            id: true,
            name: true,
            priceKes: true,
            capacity: true,
            soldCount: true,
            waitlistCount: true,
          },
        },
      },
    })

    if (!event?.isPaid) {
      return NextResponse.json({ success: false, error: 'This event is not configured for paid checkout' }, { status: 400 })
    }

    if (event.status === 'closed' || event.status === 'COMPLETED') {
      return NextResponse.json({ success: false, error: 'Registration is closed' }, { status: 400 })
    }

    const effectiveCloseAt = event.deadline ?? event.eventEndAt ?? null
    if (effectiveCloseAt && new Date(effectiveCloseAt) < new Date()) {
      return NextResponse.json({ success: false, error: 'Registration is closed' }, { status: 400 })
    }

    const ticketTier = event.ticketTiers[0]
    if (!ticketTier) {
      return NextResponse.json({ success: false, error: 'Ticket tier not found' }, { status: 404 })
    }

    const identity = parseAttendeeIdentity(
      attendee.answers,
      ((event.questions as Array<{ id: string; type: string; label: string }>) ?? [])
    )
    const attendeeEmail = identity.attendeeEmail ?? attendee.baseEmail?.trim() ?? null
    const attendeeName = identity.attendeeName ?? 'Attendee'
    const attendeePhone = identity.attendeePhone ?? null

    if (!attendeeEmail) {
      return NextResponse.json({ success: false, error: 'Email is required for paid event registrations' }, { status: 400 })
    }

    const normalizedSource = typeof source === 'string' && source.trim() ? source.trim().toLowerCase() : 'unknown'
    const normalizedRefCode = typeof refCode === 'string' && refCode.trim() ? refCode.trim() : null
    const normalizedUtmSource = typeof utmSource === 'string' && utmSource.trim() ? utmSource.trim() : null
    const normalizedMpesaPhone = normalizeMpesaPhone(mpesaPhone)

    if (!/^2547\d{8}$/.test(normalizedMpesaPhone) && !/^2541\d{8}$/.test(normalizedMpesaPhone)) {
      return NextResponse.json({ success: false, error: 'Invalid M-Pesa phone number' }, { status: 400 })
    }

    const now = new Date()
    const holdExpiresAt = new Date(now.getTime() + 10 * 60 * 1000)

    const pendingCount = await prisma.paidEventOrder.count({
      where: {
        ticketTierId: ticketTier.id,
        status: { in: ['PENDING', 'PAYMENT_PENDING'] },
        holdExpiresAt: { gt: now },
      },
    })

    const available = Math.max(0, ticketTier.capacity - ticketTier.soldCount - pendingCount)

    if (available <= 0) {
      const registrationCountryCode = await detectCountry(req).catch(() => null)
      const registration = await joinPaidEventWaitlist({
        eventId: event.id,
        eventSlug: event.slug,
        eventTitle: event.title,
        ticketTierId: ticketTier.id,
        ticketTierWaitlistCount: ticketTier.waitlistCount,
        attendeeEmail,
        attendeeAnswers: attendee.answers,
        consentTransactional: consentTransactional ?? false,
        consentMarketing: consentMarketing ?? false,
        source: normalizedSource,
        refCode: normalizedRefCode,
        utmSource: normalizedUtmSource,
        countryCode: registrationCountryCode,
      })

      return NextResponse.json({
        success: true,
        results: [{
          status: 'waitlist',
          waitlistPosition: registration.waitlistPosition,
          registrationId: registration.id,
          registrationNumber: registration.registrationNumber,
        }],
        eventTitle: event.title,
      })
    }

    const order = await prisma.paidEventOrder.create({
      data: {
        eventId: event.id,
        ticketTierId: ticketTier.id,
        status: 'PENDING',
        paymentMethod: 'MPESA',
        attendeePayload: attendee.answers,
        attendeeEmail,
        attendeeName,
        attendeePhone,
        amountKes: ticketTier.priceKes,
        holdExpiresAt,
        mpesaPhone: normalizedMpesaPhone,
      },
      select: { id: true },
    })

    const commission = calculatePaidEventCommission(ticketTier.priceKes, event.organizer?.plan ?? 'free')

    await prisma.payment.create({
      data: {
        eventId: event.id,
        paidEventOrderId: order.id,
        ticketTierId: ticketTier.id,
        amount: ticketTier.priceKes,
        commissionAmount: commission.commissionAmount,
        organizerAmount: commission.organizerAmount,
        commissionRate: commission.commissionRate,
        method: 'MPESA',
        status: 'PENDING',
      },
    })

    try {
      const apiRef = `order_${order.id}`
      const stk = await startIntaSendStkPush({
        apiRef,
        phone: normalizedMpesaPhone,
        amountKes: ticketTier.priceKes,
        email: attendeeEmail,
        name: attendeeName,
      })

      await prisma.paidEventOrder.update({
        where: { id: order.id },
        data: {
          status: 'PAYMENT_PENDING',
          checkoutRequestId: stk.invoiceId,
          providerReference: apiRef,
        },
      })

      return NextResponse.json({
        success: true,
        orderId: order.id,
        checkoutRequestId: stk.invoiceId,
        customerMessage: 'Check your phone to complete payment.',
        amountKes: ticketTier.priceKes,
        eventTitle: event.title,
        ticketTierName: ticketTier.name,
        paymentMethod: 'mpesa',
      })
    } catch (error) {
      await prisma.paidEventOrder.update({
        where: { id: order.id },
        data: { status: 'FAILED' },
      })
      const message = error instanceof Error ? error.message : 'Payment initiation failed'
      return NextResponse.json({ success: false, error: message }, { status: 500 })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
