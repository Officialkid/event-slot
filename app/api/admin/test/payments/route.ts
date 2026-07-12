import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { hasAdminAccess } from '@/lib/isAdmin'
import { calculatePaidEventCommission, getPaidEventCommissionRate } from '@/lib/paidEventCommission'
import { normalizeMpesaPhone, startIntaSendStkPush } from '@/lib/intasend'

type ScenarioKey = 'standard-main' | 'free-mini' | 'pro-mini' | 'business-mini'

type ScenarioConfig = {
  key: ScenarioKey
  label: string
  defaultCount: number
  eventTitle: string
  tierName: string
  organizerEmail: string
}

const SCENARIOS: ScenarioConfig[] = [
  {
    key: 'standard-main',
    label: 'Standard Plan Main Run',
    defaultCount: 10,
    eventTitle: 'Test Paid Event - Single Tier',
    tierName: 'Standard',
    organizerEmail: 'bob.standard@eventslot.test',
  },
  {
    key: 'free-mini',
    label: 'Free Plan Mini-Test',
    defaultCount: 2,
    eventTitle: 'Test Paid Event - Single Tier',
    tierName: 'Standard',
    organizerEmail: 'alice.free@eventslot.test',
  },
  {
    key: 'pro-mini',
    label: 'Pro Plan Mini-Test',
    defaultCount: 2,
    eventTitle: 'Test Paid Event - Multi Tier',
    tierName: 'Regular',
    organizerEmail: 'carol.pro@eventslot.test',
  },
  {
    key: 'business-mini',
    label: 'Business Plan Mini-Test',
    defaultCount: 2,
    eventTitle: 'Test Paid Event - Multi Tier',
    tierName: 'VIP',
    organizerEmail: 'david.business@eventslot.test',
  },
]

function isValidLocalMpesaPhone(phone: string) {
  return /^(07\d{8}|01\d{8})$/.test(phone.trim())
}

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session || !hasAdminAccess(session)) {
    return null
  }

  return session
}

function getScenario(key: string | null): ScenarioConfig | null {
  return SCENARIOS.find((scenario) => scenario.key === key) ?? null
}

async function ensureScenarioPricing() {
  for (const scenario of SCENARIOS) {
    const event = await prisma.event.findFirst({
      where: { isTestData: true, title: scenario.eventTitle },
      select: {
        id: true,
        ticketTiers: {
          where: { name: scenario.tierName },
          select: { id: true, priceKes: true },
        },
      },
    })

    const tier = event?.ticketTiers[0]
    if (tier && tier.priceKes !== 100) {
      await prisma.ticketTier.update({
        where: { id: tier.id },
        data: { priceKes: 100 },
      })
    }
  }
}

function buildAttendeeAnswers(
  questions: Array<{ id: string; type: string; label: string }>,
  attendee: { name: string; email: string; attendeePhone: string }
) {
  return questions.map((question) => {
    const label = question.label.toLowerCase()
    if (question.type === 'email' || label.includes('email')) {
      return { questionId: question.id, value: attendee.email }
    }
    if (question.type === 'tel' || question.type === 'phone' || label.includes('phone') || label.includes('mobile')) {
      return { questionId: question.id, value: attendee.attendeePhone }
    }
    if (question.type === 'text' && label.includes('name')) {
      return { questionId: question.id, value: attendee.name }
    }
    return { questionId: question.id, value: 'Test value' }
  })
}

async function loadScenarioBundle(scenario: ScenarioConfig) {
  const [event, organizer] = await Promise.all([
    prisma.event.findFirst({
      where: {
        isTestData: true,
        title: scenario.eventTitle,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        organizerId: true,
        organizerEmail: true,
        questions: true,
        ticketTiers: {
          where: { name: scenario.tierName },
          select: {
            id: true,
            name: true,
            priceKes: true,
            capacity: true,
            soldCount: true,
            waitlistCount: true,
          },
          take: 1,
        },
      },
    }),
    prisma.user.findFirst({
      where: {
        isTestData: true,
        email: { equals: scenario.organizerEmail, mode: 'insensitive' },
      },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
      },
    }),
  ])

  const tier = event?.ticketTiers[0]
  if (!event || !tier || !organizer?.email) {
    throw new Error('Missing seeded payment test data. Run npm run test:seed first.')
  }

  const organizerEmail = organizer.email
  if (!organizerEmail) {
    throw new Error(`Missing organizer email for ${scenario.organizerEmail}.`)
  }

  return {
    event,
    tier,
    organizer: { ...organizer, email: organizerEmail },
    questions: ((event.questions as Array<{ id: string; type: string; label: string }>) ?? []),
  }
}

async function resetScenarioState(bundle: Awaited<ReturnType<typeof loadScenarioBundle>>) {
  const registrations = await prisma.registration.findMany({
    where: {
      eventId: bundle.event.id,
      ticketTierId: bundle.tier.id,
      attendeeEmail: { endsWith: '@eventslot.test' },
    },
    select: { id: true },
  })

  const registrationIds = registrations.map((registration) => registration.id)
  const tickets = registrationIds.length > 0
    ? await prisma.ticket.findMany({
        where: { registrationId: { in: registrationIds } },
        select: { id: true },
      })
    : []
  const ticketIds = tickets.map((ticket) => ticket.id)

  const orders = await prisma.paidEventOrder.findMany({
    where: {
      eventId: bundle.event.id,
      ticketTierId: bundle.tier.id,
      attendeeEmail: { endsWith: '@eventslot.test' },
    },
    select: { id: true },
  })
  const orderIds = orders.map((order) => order.id)

  if (ticketIds.length > 0) {
    await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } })
  }
  if (registrationIds.length > 0) {
    await prisma.registration.deleteMany({ where: { id: { in: registrationIds } } })
  }
  if (orderIds.length > 0) {
    await prisma.payment.deleteMany({ where: { paidEventOrderId: { in: orderIds } } })
    await prisma.paidEventOrder.deleteMany({ where: { id: { in: orderIds } } })
  }

  const [confirmedCount, waitlistCount, tierConfirmedCount, tierWaitlistCount] = await Promise.all([
    prisma.registration.count({ where: { eventId: bundle.event.id, status: 'confirmed' } }),
    prisma.registration.count({ where: { eventId: bundle.event.id, status: { startsWith: 'waitlist' } } }),
    prisma.registration.count({ where: { eventId: bundle.event.id, ticketTierId: bundle.tier.id, status: 'confirmed' } }),
    prisma.registration.count({ where: { eventId: bundle.event.id, ticketTierId: bundle.tier.id, status: { startsWith: 'waitlist' } } }),
  ])

  await prisma.event.update({
    where: { id: bundle.event.id },
    data: {
      confirmedCount,
      waitlistCount,
    },
  })

  await prisma.ticketTier.update({
    where: { id: bundle.tier.id },
    data: {
      soldCount: tierConfirmedCount,
      waitlistCount: tierWaitlistCount,
    },
  })
}

function buildScenarioReport(
  key: ScenarioKey,
  bundle: Awaited<ReturnType<typeof loadScenarioBundle>>
) {
  const rate = getPaidEventCommissionRate(bundle.organizer.plan)
  return {
    key,
    label: SCENARIOS.find((scenario) => scenario.key === key)?.label ?? key,
    eventTitle: bundle.event.title,
    eventSlug: bundle.event.slug,
    eventId: bundle.event.id,
    tierId: bundle.tier.id,
    tierName: bundle.tier.name,
    amountKes: bundle.tier.priceKes,
    capacity: bundle.tier.capacity,
    soldCount: bundle.tier.soldCount,
    waitlistCount: bundle.tier.waitlistCount,
    organizerPlan: (bundle.organizer.plan ?? 'free').toUpperCase(),
    organizerEmail: bundle.organizer.email,
    expectedCommissionRate: rate,
    defaultCount: SCENARIOS.find((scenario) => scenario.key === key)?.defaultCount ?? 1,
  }
}

export async function GET() {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await ensureScenarioPricing()

  try {
    const scenarios = await Promise.all(
      SCENARIOS.map(async (scenario) => buildScenarioReport(scenario.key, await loadScenarioBundle(scenario)))
    )

    return NextResponse.json({
      success: true,
      scenarios,
      appUrl: process.env.APP_URL ?? null,
      liveProvider: 'INTASEND_MPESA',
      note: 'Live STK Push uses the current IntaSend-backed M-Pesa flow in this codebase.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load payment test config.'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = (await req.json().catch(() => null)) as
    | {
        action?: 'start' | 'expire'
        scenarioKey?: ScenarioKey
        phone?: string
        attendeeNumber?: number
        resetScenario?: boolean
        orderId?: string
      }
    | null

  if (body?.action === 'expire') {
    if (!body.orderId) {
      return NextResponse.json({ success: false, error: 'orderId is required.' }, { status: 400 })
    }

    const order = await prisma.paidEventOrder.findUnique({
      where: { id: body.orderId },
      select: {
        id: true,
        status: true,
        promotionRegistrationId: true,
        eventId: true,
        ticketTierId: true,
      },
    })

    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found.' }, { status: 404 })
    }

    if (order.status === 'PAID' || order.status === 'FAILED' || order.status === 'CANCELLED' || order.status === 'EXPIRED') {
      return NextResponse.json({ success: true, status: order.status })
    }

    await prisma.paidEventOrder.update({
      where: { id: order.id },
      data: { status: 'EXPIRED' },
    })
    await prisma.payment.updateMany({
      where: { paidEventOrderId: order.id },
      data: { status: 'FAILED' },
    })

    if (order.promotionRegistrationId) {
      await prisma.registration.update({
        where: { id: order.promotionRegistrationId },
        data: { status: 'waitlist-offer-expired' },
      }).catch(() => {})
    }

    return NextResponse.json({ success: true, status: 'EXPIRED' })
  }

  const scenario = getScenario(body?.scenarioKey ?? null)
  if (!scenario) {
    return NextResponse.json({ success: false, error: 'Unknown payment test scenario.' }, { status: 400 })
  }

  if (!body?.phone || !isValidLocalMpesaPhone(body.phone)) {
    return NextResponse.json({ success: false, error: 'Enter a valid Kenyan M-Pesa number in 07XX or 01XX format.' }, { status: 400 })
  }

  const attendeeNumber = Number(body.attendeeNumber ?? 0)
  if (!Number.isInteger(attendeeNumber) || attendeeNumber < 1 || attendeeNumber > 55) {
    return NextResponse.json({ success: false, error: 'attendeeNumber must be between 1 and 55.' }, { status: 400 })
  }

  await ensureScenarioPricing()

  try {
    const bundle = await loadScenarioBundle(scenario)
    if (body.resetScenario) {
      await resetScenarioState(bundle)
    }

    if (bundle.event.organizerId !== bundle.organizer.id || bundle.event.organizerEmail !== bundle.organizer.email) {
      await prisma.event.update({
        where: { id: bundle.event.id },
        data: {
          organizerId: bundle.organizer.id,
          organizerEmail: bundle.organizer.email,
        },
      })
    }

    const attendeeEmail = `attendee${String(attendeeNumber).padStart(2, '0')}@eventslot.test`
    const attendeeName = `Attendee ${String(attendeeNumber).padStart(2, '0')}`
    const attendeePhone = `071200${String(attendeeNumber).padStart(4, '0')}`

    const pendingCount = await prisma.paidEventOrder.count({
      where: {
        ticketTierId: bundle.tier.id,
        status: { in: ['PENDING', 'PAYMENT_PENDING'] },
        holdExpiresAt: { gt: new Date() },
      },
    })

    const available = Math.max(0, bundle.tier.capacity - bundle.tier.soldCount - pendingCount)
    if (available <= 0) {
      return NextResponse.json({
        success: false,
        error: 'No slots available for this tier.',
        code: 'TIER_FULL',
      }, { status: 409 })
    }

    const attendeeAnswers = buildAttendeeAnswers(bundle.questions, {
      name: attendeeName,
      email: attendeeEmail,
      attendeePhone,
    })

    const holdExpiresAt = new Date(Date.now() + 10 * 60 * 1000)
    const order = await prisma.paidEventOrder.create({
      data: {
        eventId: bundle.event.id,
        ticketTierId: bundle.tier.id,
        status: 'PENDING',
        paymentMethod: 'MPESA',
        attendeePayload: attendeeAnswers,
        attendeeEmail,
        attendeeName,
        attendeePhone,
        amountKes: bundle.tier.priceKes,
        holdExpiresAt,
        mpesaPhone: normalizeMpesaPhone(body.phone),
      },
      select: { id: true },
    })

    const commission = calculatePaidEventCommission(bundle.tier.priceKes, bundle.organizer.plan)
    await prisma.payment.create({
      data: {
        isTestData: true,
        eventId: bundle.event.id,
        paidEventOrderId: order.id,
        ticketTierId: bundle.tier.id,
        amount: bundle.tier.priceKes,
        commissionAmount: commission.commissionAmount,
        organizerAmount: commission.organizerAmount,
        commissionRate: commission.commissionRate,
        method: 'MPESA',
        status: 'PENDING',
      },
    })

    try {
      const apiRef = `payment_test_${scenario.key}_${order.id}`
      const stk = await startIntaSendStkPush({
        apiRef,
        phone: normalizeMpesaPhone(body.phone),
        amountKes: bundle.tier.priceKes,
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
        eventTitle: bundle.event.title,
        ticketTierName: bundle.tier.name,
        amountKes: bundle.tier.priceKes,
        organizerPlan: (bundle.organizer.plan ?? 'free').toUpperCase(),
        expectedCommissionRate: commission.commissionRate,
        attendee: {
          name: attendeeName,
          email: attendeeEmail,
          phone: attendeePhone,
          number: attendeeNumber,
        },
      })
    } catch (error) {
      await prisma.paidEventOrder.update({
        where: { id: order.id },
        data: { status: 'FAILED' },
      }).catch(() => {})
      await prisma.payment.updateMany({
        where: { paidEventOrderId: order.id },
        data: { status: 'FAILED' },
      }).catch(() => {})

      const message = error instanceof Error ? error.message : 'Payment initiation failed.'
      return NextResponse.json({ success: false, error: message }, { status: 500 })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to start payment test.'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
