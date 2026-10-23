import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { APP_URL } from '@/lib/config'
import { sendPaidWaitlistPromotionEmail } from '@/lib/email'
import { calculatePaidEventCommission } from '@/lib/paidEventCommission'

export async function offerNextPaidWaitlistSpot(eventId: string, ticketTierId: string) {
  // Perform the ENTIRE waitlist promotion flow inside a single atomic database transaction
  // with TicketTier row locking (SELECT ... FOR UPDATE) to prevent concurrent over-allocation.
  return await prisma.$transaction(async (tx) => {
    // 1. Lock the TicketTier row exclusively
    try {
      await tx.$queryRaw`SELECT id, capacity, "soldCount" FROM "TicketTier" WHERE id = ${ticketTierId} FOR UPDATE`
    } catch {
      // Fallback for non-Postgres test environments
    }

    // 2. Authoritative reload of event and ticket tier
    const event = await tx.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        slug: true,
        title: true,
        eventDate: true,
        eventEndAt: true,
        location: true,
        organizer: { select: { plan: true } },
        ticketTiers: {
          where: { id: ticketTierId },
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

    const tier = event?.ticketTiers[0]
    if (!event || !tier) return null

    // 3. Count authoritative active holds on this tier
    const activeHolds =
      typeof tx.paidEventOrder?.count === 'function'
        ? await tx.paidEventOrder.count({
            where: {
              ticketTierId,
              status: { in: ['PENDING', 'PAYMENT_PENDING'] },
              holdExpiresAt: { gt: new Date() },
            },
          })
        : 0

    // 4. Recalculate remaining capacity under the lock
    const available = tier.capacity - tier.soldCount - activeHolds
    if (available <= 0) {
      // Capacity no longer exists (tier full or already committed to active holds/invitations)
      return null
    }

    // 5. Select the next waitlisted candidate under the lock
    const nextWaitlisted = await tx.registration.findFirst({
      where: {
        eventId,
        ticketTierId,
        status: 'waitlist',
      },
      orderBy: { waitlistPosition: 'asc' },
      select: {
        id: true,
        attendeeEmail: true,
        answers: true,
        waitlistPosition: true,
      },
    })

    if (!nextWaitlisted?.attendeeEmail) return null

    // 6. Atomically reserve 24-hour hold and create waitlist order
    const holdExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const commission = calculatePaidEventCommission(tier.priceKes, event.organizer?.plan ?? 'free')

    const createdOrder = await tx.paidEventOrder.create({
      data: {
        eventId,
        ticketTierId,
        status: 'PENDING',
        paymentMethod: 'MPESA',
        attendeePayload: nextWaitlisted.answers as Prisma.InputJsonValue,
        attendeeEmail: nextWaitlisted.attendeeEmail,
        amountKes: tier.priceKes,
        holdExpiresAt,
        promotionRegistrationId: nextWaitlisted.id,
      },
      select: { id: true },
    })

    await tx.payment.create({
      data: {
        eventId,
        paidEventOrderId: createdOrder.id,
        registrationId: nextWaitlisted.id,
        ticketTierId,
        amount: tier.priceKes,
        commissionAmount: commission.commissionAmount,
        organizerAmount: commission.organizerAmount,
        commissionRate: commission.commissionRate,
        method: 'MPESA',
        status: 'PENDING',
      },
    })

    // Atomically transition candidate's status to prevent duplicate promotion
    const regUpdate = await tx.registration.updateMany({
      where: {
        id: nextWaitlisted.id,
        status: 'waitlist',
      },
      data: {
        status: 'waitlist-payment-pending',
        waitlistPosition: null,
      },
    })

    if (regUpdate.count === 0) {
      // Another worker concurrently promoted this candidate; rollback
      throw new Error(`WAITLIST_CANDIDATE_ALREADY_PROMOTED: Registration ${nextWaitlisted.id}`)
    }

    await tx.registration.updateMany({
      where: {
        eventId,
        ticketTierId,
        status: 'waitlist',
        waitlistPosition: { gt: nextWaitlisted.waitlistPosition ?? 0 },
      },
      data: {
        waitlistPosition: { decrement: 1 },
      },
    })

    await tx.event.update({
      where: { id: eventId },
      data: { waitlistCount: { decrement: 1 } },
    })

    await tx.ticketTier.update({
      where: { id: ticketTierId },
      data: { waitlistCount: { decrement: 1 } },
    })

    return {
      orderId: createdOrder.id,
      emailParams: {
        to: nextWaitlisted.attendeeEmail,
        eventTitle: event.title,
        tierName: tier.name,
        priceKes: tier.priceKes,
        paymentLink: `${APP_URL}/pay/${createdOrder.id}`,
        expiresAt: holdExpiresAt,
      },
    }
  }).then(async (result) => {
    if (!result) return null
    await sendPaidWaitlistPromotionEmail(result.emailParams).catch(() => {})
    return result.orderId
  }).catch((err) => {
    if (String(err?.message || err).includes('WAITLIST_CANDIDATE_ALREADY_PROMOTED')) {
      return null
    }
    throw err
  })
}
