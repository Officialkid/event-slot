import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { APP_URL } from '@/lib/config'
import { sendPaidWaitlistPromotionEmail } from '@/lib/email'
import { calculatePaidEventCommission } from '@/lib/paidEventCommission'

export async function offerNextPaidWaitlistSpot(eventId: string, ticketTierId: string) {
  const event = await prisma.event.findUnique({
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
          waitlistCount: true,
        },
      },
    },
  })

  const tier = event?.ticketTiers[0]
  if (!event || !tier) return null

  const nextWaitlisted = await prisma.registration.findFirst({
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

  const holdExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const commission = calculatePaidEventCommission(tier.priceKes, event.organizer?.plan ?? 'free')

  const order = await prisma.$transaction(async (tx) => {
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

    await tx.registration.update({
      where: { id: nextWaitlisted.id },
      data: {
        status: 'waitlist-payment-pending',
        waitlistPosition: null,
      },
    })

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

    return createdOrder
  })

  const paymentLink = `${APP_URL}/pay/${order.id}`
  await sendPaidWaitlistPromotionEmail({
    to: nextWaitlisted.attendeeEmail,
    eventTitle: event.title,
    tierName: tier.name,
    priceKes: tier.priceKes,
    paymentLink,
    expiresAt: holdExpiresAt,
  }).catch(() => {})

  return order.id
}
