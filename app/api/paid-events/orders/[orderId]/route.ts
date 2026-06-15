import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { offerNextPaidWaitlistSpot } from '@/lib/paidEventWaitlist'

export async function GET(_req: NextRequest, props: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await props.params

  const order = await prisma.paidEventOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      holdExpiresAt: true,
      promotionRegistrationId: true,
      attendeeEmail: true,
      amountKes: true,
      event: {
        select: {
          id: true,
          title: true,
          slug: true,
        },
      },
      ticketTier: {
        select: {
          id: true,
          name: true,
        },
      },
      registrations: {
        take: 1,
        select: {
          confirmationCode: true,
          id: true,
        },
      },
    },
  })

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  let status = order.status
  if ((status === 'PENDING' || status === 'PAYMENT_PENDING') && order.holdExpiresAt < new Date()) {
    status = 'EXPIRED'
    await prisma.paidEventOrder.update({
      where: { id: order.id },
      data: { status: 'EXPIRED' },
    }).catch(() => {})
    await prisma.payment.updateMany({
      where: { paidEventOrderId: order.id },
      data: { status: 'FAILED' },
    }).catch(() => {})
    if (order.promotionRegistrationId) {
      await prisma.registration.update({
        where: { id: order.promotionRegistrationId },
        data: { status: 'waitlist-offer-expired' },
      }).catch(() => {})
    }
    await offerNextPaidWaitlistSpot(order.event.id, order.ticketTier.id).catch(() => {})
  }

  return NextResponse.json({
    success: true,
    status,
    confirmationCode: order.registrations[0]?.confirmationCode ?? null,
    registrationId: order.registrations[0]?.id ?? null,
    eventTitle: order.event.title,
    eventSlug: order.event.slug,
    ticketTierName: order.ticketTier.name,
    amountKes: order.amountKes,
    attendeeEmail: order.attendeeEmail,
    holdExpiresAt: order.holdExpiresAt.toISOString(),
  })
}
