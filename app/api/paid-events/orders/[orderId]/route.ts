import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { offerNextPaidWaitlistSpot } from '@/lib/paidEventWaitlist'
import { failPaidEventOrderPayment, finalizePaidEventOrderPayment } from '@/lib/paymentFinalizers'
import { paystackFetch } from '@/lib/paystack'
import { extractInvoiceState, extractProviderReference, getIntaSendPaymentStatus } from '@/lib/intasend'

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

  if (status === 'PAYMENT_PENDING' && order.id) {
    const paymentOrder = await prisma.paidEventOrder.findUnique({
      where: { id: order.id },
      select: { checkoutRequestId: true, providerReference: true },
    })

    if (paymentOrder?.providerReference?.startsWith('paystack:')) {
      const reference = paymentOrder.checkoutRequestId ?? paymentOrder.providerReference.slice('paystack:'.length)
      try {
        const paystack = await paystackFetch(`/transaction/verify/${reference}`)
        if (paystack.status && paystack.data?.status === 'success') {
          await finalizePaidEventOrderPayment(order.id, reference)
          status = 'PAID'
        } else if (paystack.data?.status === 'failed' || paystack.data?.status === 'abandoned') {
          await failPaidEventOrderPayment(order.id, 'FAILED')
          status = 'FAILED'
        }
      } catch {
        // Keep polling if the provider check is temporarily unavailable.
      }
    } else if (paymentOrder?.checkoutRequestId) {
      try {
        const providerStatus = await getIntaSendPaymentStatus(paymentOrder.checkoutRequestId)
        const state = extractInvoiceState(providerStatus)
        const providerRef = extractProviderReference(providerStatus) ?? paymentOrder.providerReference

        if (state === 'COMPLETE') {
          await finalizePaidEventOrderPayment(order.id, providerRef)
          status = 'PAID'
        } else if (state === 'FAILED') {
          await failPaidEventOrderPayment(order.id, 'FAILED')
          status = 'FAILED'
        }
      } catch {
        // Keep the stored status if the provider check is temporarily unavailable.
      }
    }
  }

  const responseOrder = status === order.status
    ? order
    : await prisma.paidEventOrder.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          status: true,
          holdExpiresAt: true,
          attendeeEmail: true,
          amountKes: true,
          event: {
            select: {
              title: true,
              slug: true,
            },
          },
          ticketTier: {
            select: {
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

  return NextResponse.json({
    success: true,
    status,
    confirmationCode: responseOrder?.registrations[0]?.confirmationCode ?? order.registrations[0]?.confirmationCode ?? null,
    registrationId: responseOrder?.registrations[0]?.id ?? order.registrations[0]?.id ?? null,
    eventTitle: responseOrder?.event.title ?? order.event.title,
    eventSlug: responseOrder?.event.slug ?? order.event.slug,
    ticketTierName: responseOrder?.ticketTier.name ?? order.ticketTier.name,
    amountKes: responseOrder?.amountKes ?? order.amountKes,
    attendeeEmail: responseOrder?.attendeeEmail ?? order.attendeeEmail,
    holdExpiresAt: (responseOrder?.holdExpiresAt ?? order.holdExpiresAt).toISOString(),
  })
}
