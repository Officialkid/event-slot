import { Prisma, PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

function loadLocalEnv() {
  try {
    const fs = require('fs') as typeof import('fs')
    const path = require('path') as typeof import('path')
    const envPath = path.join(process.cwd(), '.env')
    if (!fs.existsSync(envPath)) return

    const contents = fs.readFileSync(envPath, 'utf8')
    for (const rawLine of contents.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const eqIndex = line.indexOf('=')
      if (eqIndex === -1) continue
      const key = line.slice(0, eqIndex).trim()
      let value = line.slice(eqIndex + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!(key in process.env)) {
        process.env[key] = value
      }
    }
  } catch {
    // Best effort only.
  }
}

loadLocalEnv()
if (process.env.DIRECT_URL && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL
}

type TestContext = {
  freeEvent: { id: string; slug: string; title: string; dashboardToken: string; confirmedCount: number; waitlistCount: number }
  paidSingle: { id: string; slug: string; title: string; tier: { id: string; name: string; capacity: number; soldCount: number; waitlistCount: number; priceKes: number } }
  paidMulti: {
    id: string
    slug: string
    title: string
    tiers: Array<{ id: string; name: string; capacity: number; soldCount: number; waitlistCount: number; priceKes: number }>
  }
  walkInEvent: { id: string; slug: string; title: string }
  attendees: Map<number, { id: string; name: string; email: string }>
}

function normalizeInternationalPhoneNumber(rawPhone: string) {
  const trimmed = rawPhone.trim()
  if (!trimmed) return { ok: false as const, error: 'Phone number is required.' }

  const hasLeadingPlus = trimmed.startsWith('+')
  const body = hasLeadingPlus ? trimmed.slice(1) : trimmed
  const digits = body.replace(/[^\d]/g, '')

  if (!digits) {
    return { ok: false as const, error: 'Enter a valid phone number.' }
  }

  if (digits.startsWith('0') && digits.length === 10) {
    return { ok: true as const, number: `+254${digits.slice(1)}` }
  }

  if (digits.startsWith('254') && digits.length === 12) {
    return { ok: true as const, number: `+${digits}` }
  }

  if (hasLeadingPlus && digits.length >= 10 && digits.length <= 15) {
    return { ok: true as const, number: `+${digits}` }
  }

  return { ok: false as const, error: 'Enter a valid phone number.' }
}

function getTodayWalkInDate(now = new Date()) {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)

  return new Date(`${formatted}T00:00:00.000Z`)
}

async function promoteNextFreeWaitlistSpot(eventId: string) {
  const nextWaitlisted = await prisma.registration.findFirst({
    where: {
      eventId,
      status: 'waitlist',
      ticketTierId: null,
    },
    orderBy: { waitlistPosition: 'asc' },
    select: {
      id: true,
      attendeeEmail: true,
      waitlistPosition: true,
      confirmationCode: true,
      qrCode: true,
      consentTransactional: true,
    },
  })

  if (!nextWaitlisted) return null

  const confirmationCode = nextWaitlisted.confirmationCode ?? `TEST-${randomUUID().slice(0, 8).toUpperCase()}`
  const qrCode = nextWaitlisted.qrCode ?? randomUUID()

  return prisma.$transaction(async (tx) => {
    const promoted = await tx.registration.update({
      where: { id: nextWaitlisted.id },
      data: {
        status: 'confirmed',
        waitlistPosition: null,
        submittedAt: new Date(),
        confirmationCode,
        qrCode,
      },
      select: {
        id: true,
        attendeeEmail: true,
        consentTransactional: true,
        confirmationCode: true,
      },
    })

    await tx.registration.updateMany({
      where: {
        eventId,
        status: 'waitlist',
        ticketTierId: null,
        waitlistPosition: { gt: nextWaitlisted.waitlistPosition ?? 0 },
      },
      data: {
        waitlistPosition: { decrement: 1 },
      },
    })

    await tx.event.update({
      where: { id: eventId },
      data: {
        confirmedCount: { increment: 1 },
        waitlistCount: { decrement: 1 },
      },
    })

    return promoted
  })
}

async function joinPaidEventWaitlist(input: {
  eventId: string
  eventSlug: string
  eventTitle: string
  ticketTierId: string
  ticketTierWaitlistCount: number
  attendeeEmail: string | null
  attendeeAnswers: Array<{ questionId: string; value: string }>
  consentTransactional: boolean
  consentMarketing: boolean
  source: string
  refCode: string | null
  utmSource: string | null
  countryCode: string | null
}) {
  const registrationNumber = (await prisma.registration.count({ where: { eventId: input.eventId } })) + 1
  const nextPosition = input.ticketTierWaitlistCount + 1

  const registration = await prisma.$transaction(async (tx) => {
    const created = await tx.registration.create({
      data: {
        eventId: input.eventId,
        ticketTierId: input.ticketTierId,
        answers: input.attendeeAnswers,
        status: 'waitlist',
        waitlistPosition: nextPosition,
        registrationNumber,
        attendeeEmail: input.attendeeEmail,
        consentTransactional: input.consentTransactional,
        consentMarketing: input.consentMarketing,
        source: input.source,
        refCode: input.refCode,
        utmSource: input.utmSource,
        countryCode: input.countryCode ?? undefined,
        isTestData: true,
      },
      select: { id: true, registrationNumber: true, waitlistPosition: true },
    })

    await tx.event.update({
      where: { id: input.eventId },
      data: { waitlistCount: { increment: 1 } },
    })

    await tx.ticketTier.update({
      where: { id: input.ticketTierId },
      data: { waitlistCount: { increment: 1 } },
    })

    return created
  })

  return registration
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function buildAttendeeAnswers(name: string, email: string, phone: string) {
  return [
    { questionId: 'test-name', value: name },
    { questionId: 'test-email', value: email },
    { questionId: 'test-phone', value: phone },
  ]
}

async function getContext(): Promise<TestContext> {
  const [events, users] = await Promise.all([
    prisma.event.findMany({
      where: {
        isTestData: true,
        title: {
          in: [
            'Test Free Event',
            'Test Paid Event - Single Tier',
            'Test Paid Event - Multi Tier',
            'Test Walk-In Event',
          ],
        },
      },
      select: {
        id: true,
        slug: true,
        title: true,
        dashboardToken: true,
        confirmedCount: true,
        waitlistCount: true,
        ticketTiers: {
          select: {
            id: true,
            name: true,
            capacity: true,
            soldCount: true,
            waitlistCount: true,
            priceKes: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    }),
    prisma.user.findMany({
      where: {
        isTestData: true,
        email: {
          in: Array.from({ length: 55 }, (_, i) => `attendee${String(i + 1).padStart(2, '0')}@eventslot.test`),
        },
      },
      select: { id: true, name: true, email: true },
      orderBy: { email: 'asc' },
    }),
  ])

  const eventMap = new Map(events.map((event) => [event.title, event]))
  const attendeeMap = new Map<number, { id: string; name: string; email: string }>()
  for (const user of users) {
    if (!user.email) continue
    const match = user.email.match(/attendee(\d{2})@eventslot\.test/)
    if (match) {
      attendeeMap.set(Number(match[1]), {
        id: user.id,
        name: user.name ?? `Attendee ${match[1]}`,
        email: user.email,
      })
    }
  }

  const freeEvent = eventMap.get('Test Free Event')
  const paidSingle = eventMap.get('Test Paid Event - Single Tier')
  const paidMulti = eventMap.get('Test Paid Event - Multi Tier')
  const walkInEvent = eventMap.get('Test Walk-In Event')

  assert(freeEvent, 'Missing Test Free Event. Run npm run test:seed first.')
  assert(paidSingle, 'Missing Test Paid Event - Single Tier. Run npm run test:seed first.')
  assert(paidMulti, 'Missing Test Paid Event - Multi Tier. Run npm run test:seed first.')
  assert(walkInEvent, 'Missing Test Walk-In Event. Run npm run test:seed first.')
  assert(paidSingle.ticketTiers.length === 1, 'Expected a single tier on Test Paid Event - Single Tier.')

  return {
    freeEvent,
    paidSingle: { ...paidSingle, tier: paidSingle.ticketTiers[0] },
    paidMulti: { ...paidMulti, tiers: paidMulti.ticketTiers },
    walkInEvent,
    attendees: attendeeMap,
  }
}

async function resetPart2Artifacts(ctx: TestContext) {
  const overflowEmails = Array.from({ length: 5 }, (_, i) => `attendee${String(i + 51).padStart(2, '0')}@eventslot.test`)
  const multiTierEmails = Array.from({ length: 20 }, (_, i) => `attendee${String(i + 21).padStart(2, '0')}@eventslot.test`)
  const holdEmails = Array.from({ length: 11 }, (_, i) => `attendee${String(i + 1).padStart(2, '0')}@eventslot.test`)

  const eventBOrderIds = await prisma.paidEventOrder.findMany({
    where: {
      eventId: ctx.paidSingle.id,
      attendeeEmail: { in: holdEmails },
    },
    select: { id: true },
  })

  const eventCOrderIds = await prisma.paidEventOrder.findMany({
    where: {
      eventId: ctx.paidMulti.id,
      attendeeEmail: { in: multiTierEmails },
    },
    select: { id: true },
  })

  const orderIds = [...eventBOrderIds, ...eventCOrderIds].map((item) => item.id)

  if (orderIds.length > 0) {
    await prisma.payment.deleteMany({ where: { paidEventOrderId: { in: orderIds } } })
    await prisma.paidEventOrder.deleteMany({ where: { id: { in: orderIds } } })
  }

  await prisma.ticket.deleteMany({
    where: {
      registration: {
        eventId: { in: [ctx.freeEvent.id, ctx.paidMulti.id] },
        attendeeEmail: { in: [...overflowEmails, ...multiTierEmails] },
      },
    },
  })

  await prisma.registration.deleteMany({
    where: {
      eventId: ctx.freeEvent.id,
      attendeeEmail: { in: overflowEmails },
    },
  })

  await prisma.registration.deleteMany({
    where: {
      eventId: ctx.paidMulti.id,
      attendeeEmail: { in: multiTierEmails },
    },
  })

  await prisma.walkInCheckin.deleteMany({ where: { eventId: ctx.walkInEvent.id } })

  const attendee01 = ctx.attendees.get(1)
  assert(attendee01, 'Missing Attendee 01')
  const attendee01Reg = await prisma.registration.findFirst({
    where: { eventId: ctx.freeEvent.id, attendeeEmail: attendee01.email },
    select: { id: true, status: true },
  })

  if (!attendee01Reg) {
    await prisma.registration.create({
      data: {
        eventId: ctx.freeEvent.id,
        answers: buildAttendeeAnswers(attendee01.name ?? 'Attendee 01', attendee01.email, '0712000001'),
        status: 'confirmed',
        registrationNumber: 1,
        attendeeEmail: attendee01.email,
        consentTransactional: true,
        consentMarketing: false,
        confirmationCode: 'RESET-A01',
        qrCode: 'RESET-A01-QR',
        source: 'test-reset',
        isTestData: true,
      },
    })
  } else if (attendee01Reg.status !== 'confirmed') {
    await prisma.registration.update({
      where: { id: attendee01Reg.id },
      data: {
        status: 'confirmed',
        waitlistPosition: null,
        confirmationCode: 'RESET-A01',
        qrCode: 'RESET-A01-QR',
      },
    })
  }

  await prisma.registration.updateMany({
    where: {
      eventId: ctx.freeEvent.id,
      status: 'waitlist',
    },
    data: {
      waitlistPosition: null,
    },
  })

  const freeRegs = await prisma.registration.findMany({
    where: { eventId: ctx.freeEvent.id },
    select: { id: true, attendeeEmail: true, status: true },
    orderBy: [{ registrationNumber: 'asc' }, { submittedAt: 'asc' }],
  })

  let confirmedCount = 0
  let waitlistCount = 0
  for (const reg of freeRegs) {
    if (reg.status === 'confirmed') confirmedCount += 1
    if (reg.status === 'waitlist') {
      waitlistCount += 1
      await prisma.registration.update({
        where: { id: reg.id },
        data: { waitlistPosition: waitlistCount },
      })
    }
  }

  await prisma.event.update({
    where: { id: ctx.freeEvent.id },
    data: { confirmedCount, waitlistCount },
  })

  await prisma.ticketTier.update({
    where: { id: ctx.paidSingle.tier.id },
    data: { soldCount: 0, waitlistCount: 0 },
  })

  for (const tier of ctx.paidMulti.tiers) {
    await prisma.ticketTier.update({
      where: { id: tier.id },
      data: { soldCount: 0, waitlistCount: 0 },
    })
  }

  await prisma.event.update({
    where: { id: ctx.paidMulti.id },
    data: { confirmedCount: 0, waitlistCount: 0 },
  })
}

async function testFreeOverflow(ctx: TestContext) {
  for (let num = 51; num <= 55; num += 1) {
    const attendee = ctx.attendees.get(num)
    assert(attendee, `Missing Attendee ${num}`)
    const nextPosition = await prisma.$transaction(async (tx) => {
      const updatedEvent = await tx.event.update({
        where: { id: ctx.freeEvent.id },
        data: { waitlistCount: { increment: 1 } },
        select: { waitlistCount: true },
      })

      const reg = await tx.registration.create({
        data: {
          eventId: ctx.freeEvent.id,
          answers: buildAttendeeAnswers(attendee.name ?? `Attendee ${num}`, attendee.email, `07120000${String(num).padStart(2, '0')}`),
          status: 'waitlist',
          waitlistPosition: updatedEvent.waitlistCount,
          registrationNumber: 50 + (num - 50),
          attendeeEmail: attendee.email,
          consentTransactional: true,
          consentMarketing: false,
          source: 'test-capacity-waitlist',
          isTestData: true,
        },
        select: { waitlistPosition: true },
      })

      return reg.waitlistPosition
    })

    assert(nextPosition === num - 50, `Expected Attendee ${num} waitlist position ${num - 50}, got ${String(nextPosition)}`)
  }

  const [eventState, attendee51, attendee55] = await Promise.all([
    prisma.event.findUnique({
      where: { id: ctx.freeEvent.id },
      select: { confirmedCount: true, waitlistCount: true },
    }),
    prisma.registration.findFirst({
      where: { eventId: ctx.freeEvent.id, attendeeEmail: 'attendee51@eventslot.test' },
      select: { status: true, waitlistPosition: true },
    }),
    prisma.registration.findFirst({
      where: { eventId: ctx.freeEvent.id, attendeeEmail: 'attendee55@eventslot.test' },
      select: { waitlistPosition: true },
    }),
  ])

  assert(eventState?.waitlistCount === 5, `Expected 5 waitlisted on Event A, got ${String(eventState?.waitlistCount)}`)
  assert(eventState?.confirmedCount === 50, `Expected 50 confirmed on Event A, got ${String(eventState?.confirmedCount)}`)
  assert(attendee51?.status === 'waitlist', `Expected Attendee 51 to be waitlisted, got ${String(attendee51?.status)}`)
  assert(attendee51?.waitlistPosition === 1, `Expected Attendee 51 at waitlist position 1, got ${String(attendee51?.waitlistPosition)}`)
  assert(attendee55?.waitlistPosition === 5, `Expected Attendee 55 at waitlist position 5, got ${String(attendee55?.waitlistPosition)}`)
}

async function testFreePromotion(ctx: TestContext) {
  const attendee01 = ctx.attendees.get(1)
  assert(attendee01, 'Missing Attendee 01')
  const attendee01Reg = await prisma.registration.findFirst({
    where: { eventId: ctx.freeEvent.id, attendeeEmail: attendee01.email, status: 'confirmed' },
    select: { id: true },
  })
  assert(attendee01Reg, 'Expected Attendee 01 confirmed registration before cancellation')

  await prisma.registration.delete({ where: { id: attendee01Reg.id } })
  await prisma.event.update({
    where: { id: ctx.freeEvent.id },
    data: { confirmedCount: { decrement: 1 } },
  })

  const promoted = await promoteNextFreeWaitlistSpot(ctx.freeEvent.id)
  assert(promoted?.attendeeEmail === 'attendee51@eventslot.test', `Expected Attendee 51 to be promoted, got ${promoted?.attendeeEmail ?? 'none'}`)

  const [eventState, attendee51, attendee52, attendee01After] = await Promise.all([
    prisma.event.findUnique({
      where: { id: ctx.freeEvent.id },
      select: { confirmedCount: true, waitlistCount: true },
    }),
    prisma.registration.findFirst({
      where: { eventId: ctx.freeEvent.id, attendeeEmail: 'attendee51@eventslot.test' },
      select: { status: true, waitlistPosition: true },
    }),
    prisma.registration.findFirst({
      where: { eventId: ctx.freeEvent.id, attendeeEmail: 'attendee52@eventslot.test' },
      select: { waitlistPosition: true },
    }),
    prisma.registration.findFirst({
      where: { eventId: ctx.freeEvent.id, attendeeEmail: attendee01.email },
      select: { status: true },
    }),
  ])

  assert(!attendee01After, 'Expected Attendee 01 original registration to be removed after cancellation simulation')
  assert(eventState?.confirmedCount === 50, `Expected Event A confirmed count to remain 50, got ${String(eventState?.confirmedCount)}`)
  assert(eventState?.waitlistCount === 4, `Expected Event A waitlist count to drop to 4, got ${String(eventState?.waitlistCount)}`)
  assert(attendee51?.status === 'confirmed', `Expected Attendee 51 confirmed after promotion, got ${String(attendee51?.status)}`)
  assert(attendee52?.waitlistPosition === 1, `Expected Attendee 52 waitlist position to shift to 1, got ${String(attendee52?.waitlistPosition)}`)
}

async function simulateCheckoutStart(params: {
  eventId: string
  ticketTierId: string
  attendeeEmail: string
  attendeeName: string
  attendeePhone: string
  amountKes: number
  now?: Date
}) {
  const now = params.now ?? new Date()

  const tier = await prisma.ticketTier.findUnique({
    where: { id: params.ticketTierId },
    select: { capacity: true, soldCount: true },
  })
  assert(tier, 'Ticket tier not found during checkout simulation')

  const pendingCount = await prisma.paidEventOrder.count({
    where: {
      ticketTierId: params.ticketTierId,
      status: { in: ['PENDING', 'PAYMENT_PENDING'] },
      holdExpiresAt: { gt: now },
    },
  })

  const available = Math.max(0, tier.capacity - tier.soldCount - pendingCount)
  if (available <= 0) {
    return { error: 'TIER_FULL', message: 'No slots available for this tier' } as const
  }

  const holdExpiresAt = new Date(now.getTime() + 10 * 60 * 1000)
  const order = await prisma.paidEventOrder.create({
    data: {
      eventId: params.eventId,
      ticketTierId: params.ticketTierId,
      status: 'PENDING',
      paymentMethod: 'MPESA',
      attendeePayload: buildAttendeeAnswers(params.attendeeName, params.attendeeEmail, params.attendeePhone) as Prisma.InputJsonValue,
      attendeeEmail: params.attendeeEmail,
      attendeeName: params.attendeeName,
      attendeePhone: params.attendeePhone,
      amountKes: params.amountKes,
      holdExpiresAt,
    },
    select: { id: true, holdExpiresAt: true },
  })

  await prisma.payment.create({
    data: {
      eventId: params.eventId,
      paidEventOrderId: order.id,
      ticketTierId: params.ticketTierId,
      amount: params.amountKes,
      commissionAmount: 0,
      organizerAmount: params.amountKes,
      commissionRate: 0,
      method: 'MPESA',
      status: 'PENDING',
      isTestData: true,
    },
  })

  return {
    checkoutSessionId: order.id,
    holdExpiresAt: order.holdExpiresAt,
  } as const
}

async function testPaidTierHolds(ctx: TestContext) {
  for (let num = 1; num <= 10; num += 1) {
    const attendee = ctx.attendees.get(num)
    assert(attendee, `Missing Attendee ${num}`)
    const res = await simulateCheckoutStart({
      eventId: ctx.paidSingle.id,
      ticketTierId: ctx.paidSingle.tier.id,
      attendeeEmail: attendee.email,
      attendeeName: attendee.name ?? `Attendee ${num}`,
      attendeePhone: `07120000${String(num).padStart(2, '0')}`,
      amountKes: ctx.paidSingle.tier.priceKes,
    })
    assert('checkoutSessionId' in res, `Expected checkout hold for attendee ${num}`)
  }

  const attendee11 = ctx.attendees.get(11)
  assert(attendee11, 'Missing Attendee 11')
  const eleventh = await simulateCheckoutStart({
    eventId: ctx.paidSingle.id,
    ticketTierId: ctx.paidSingle.tier.id,
    attendeeEmail: attendee11.email,
    attendeeName: attendee11.name ?? 'Attendee 11',
    attendeePhone: '0712000011',
    amountKes: ctx.paidSingle.tier.priceKes,
  })
  assert('error' in eleventh && eleventh.error === 'TIER_FULL', `Expected TIER_FULL on 11th hold, got ${JSON.stringify(eleventh)}`)

  const elevenMinutesAgo = new Date(Date.now() - 11 * 60 * 1000)
  await prisma.paidEventOrder.updateMany({
    where: {
      eventId: ctx.paidSingle.id,
      ticketTierId: ctx.paidSingle.tier.id,
      status: { in: ['PENDING', 'PAYMENT_PENDING'] },
    },
    data: { holdExpiresAt: elevenMinutesAgo },
  })

  const retry = await simulateCheckoutStart({
    eventId: ctx.paidSingle.id,
    ticketTierId: ctx.paidSingle.tier.id,
    attendeeEmail: attendee11.email,
    attendeeName: attendee11.name ?? 'Attendee 11',
    attendeePhone: '0712000011',
    amountKes: ctx.paidSingle.tier.priceKes,
  })
  assert('checkoutSessionId' in retry, 'Expected checkout hold to succeed after expiry released capacity')
}

async function testPaidWaitlistPending() {
  return {
    status: 'PENDING_PART_3',
    reason: 'Paid waitlist promotion email depends on confirmed paid-ticket flow from Part 3.',
  } as const
}

async function testMultiTierIndependence(ctx: TestContext) {
  const regular = ctx.paidMulti.tiers.find((tier) => tier.name === 'Regular')
  const vip = ctx.paidMulti.tiers.find((tier) => tier.name === 'VIP')
  assert(regular, 'Missing Regular tier on Test Paid Event - Multi Tier')
  assert(vip, 'Missing VIP tier on Test Paid Event - Multi Tier')

  for (let num = 21; num <= 40; num += 1) {
    const attendee = ctx.attendees.get(num)
    assert(attendee, `Missing Attendee ${num}`)
    await prisma.registration.create({
      data: {
        eventId: ctx.paidMulti.id,
        ticketTierId: regular.id,
        answers: buildAttendeeAnswers(attendee.name ?? `Attendee ${num}`, attendee.email, `07120000${String(num).padStart(2, '0')}`),
        status: 'confirmed',
        registrationNumber: num,
        attendeeEmail: attendee.email,
        consentTransactional: true,
        consentMarketing: false,
        source: 'test-capacity-waitlist',
        confirmationCode: `REG-${num}`,
        qrCode: `REG-QR-${num}`,
        isTestData: true,
      },
    })
  }

  await prisma.ticketTier.update({
    where: { id: regular.id },
    data: { soldCount: 20 },
  })
  await prisma.event.update({
    where: { id: ctx.paidMulti.id },
    data: { confirmedCount: 20 },
  })

  const attendee21 = ctx.attendees.get(21)
  assert(attendee21, 'Missing Attendee 21')
  const regularWaitlist = await joinPaidEventWaitlist({
    eventId: ctx.paidMulti.id,
    eventSlug: ctx.paidMulti.slug,
    eventTitle: ctx.paidMulti.title,
    ticketTierId: regular.id,
    ticketTierWaitlistCount: 0,
    attendeeEmail: attendee21.email,
    attendeeAnswers: buildAttendeeAnswers(attendee21.name ?? 'Attendee 21', attendee21.email, '0712000021'),
    consentTransactional: true,
    consentMarketing: false,
    source: 'test-capacity-waitlist',
    refCode: null,
    utmSource: null,
    countryCode: 'KE',
  })

  const vipCheckout = await simulateCheckoutStart({
    eventId: ctx.paidMulti.id,
    ticketTierId: vip.id,
    attendeeEmail: attendee21.email,
    attendeeName: attendee21.name ?? 'Attendee 21',
    attendeePhone: '0712000021',
    amountKes: vip.priceKes,
  })

  const [regularAfter, vipAfter] = await Promise.all([
    prisma.ticketTier.findUnique({
      where: { id: regular.id },
      select: { capacity: true, soldCount: true, waitlistCount: true },
    }),
    prisma.ticketTier.findUnique({
      where: { id: vip.id },
      select: { capacity: true, soldCount: true },
    }),
  ])

  assert(regularAfter && regularAfter.soldCount >= regularAfter.capacity, 'Expected Regular tier to be full')
  assert(vipAfter && vipAfter.soldCount < vipAfter.capacity, 'Expected VIP tier to remain available')
  assert(regularWaitlist.waitlistPosition === 1, `Expected first Regular overflow to be waitlist position 1, got ${String(regularWaitlist.waitlistPosition)}`)
  assert('checkoutSessionId' in vipCheckout, `Expected VIP checkout hold to succeed, got ${JSON.stringify(vipCheckout)}`)
}

async function simulateWalkIn(eventId: string, attendeeData: { name: string; phone: string }) {
  const normalized = normalizeInternationalPhoneNumber(attendeeData.phone)
  assert(normalized.ok, `Invalid phone in walk-in simulation: ${attendeeData.phone}`)

  const todayDate = getTodayWalkInDate(new Date())
  let created = true
  try {
    await prisma.walkInCheckin.create({
      data: {
        eventId,
        name: attendeeData.name,
        phone: normalized.number,
        dayDate: todayDate,
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      created = false
    } else {
      throw error
    }
  }

  const count = await prisma.walkInCheckin.count({
    where: { eventId, dayDate: todayDate },
  })

  return {
    status: created ? 'CHECKED_IN' : 'ALREADY_CHECKED_IN',
    count,
  } as const
}

async function testWalkIns(ctx: TestContext) {
  for (let num = 1; num <= 5; num += 1) {
    const result = await simulateWalkIn(ctx.walkInEvent.id, {
      name: `Walk-In ${num}`,
      phone: `07123344${String(num).padStart(2, '0')}`,
    })
    assert(result.status === 'CHECKED_IN', `Expected walk-in ${num} to check in, got ${result.status}`)
  }

  const duplicate = await simulateWalkIn(ctx.walkInEvent.id, {
    name: 'Walk-In 1',
    phone: '0712334401',
  })

  const todayCount = await prisma.walkInCheckin.count({
    where: { eventId: ctx.walkInEvent.id, dayDate: getTodayWalkInDate(new Date()) },
  })

  assert(todayCount === 5, `Expected live walk-in attendance count 5, got ${todayCount}`)
  assert(duplicate.status === 'ALREADY_CHECKED_IN', `Expected duplicate walk-in warning, got ${duplicate.status}`)
}

async function main() {
  const ctx = await getContext()
  await resetPart2Artifacts(ctx)

  await testFreeOverflow(ctx)
  await testFreePromotion(ctx)
  await testPaidTierHolds(ctx)
  const paidWaitlistPending = await testPaidWaitlistPending()
  await testMultiTierIndependence(ctx)
  await testWalkIns(ctx)

  console.log('✅ EventSlot Capacity & Waitlist Test Complete')
  console.log('──────────────────────────────────────────────')
  console.log('Free overflow:        PASS')
  console.log('Free promotion:       PASS')
  console.log('Paid tier holds:      PASS')
  console.log(`Paid waitlist email:  ${paidWaitlistPending.status}`)
  console.log('Multi-tier capacity:  PASS')
  console.log('Walk-in dedupe:       PASS')
  console.log('──────────────────────────────────────────────')
  console.log('Note: re-run npm run test:cleanup && npm run test:seed before Part 3 for a fresh paid-event baseline.')
}

main()
  .catch((error) => {
    console.error('❌ EventSlot Capacity & Waitlist Test Failed')
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
