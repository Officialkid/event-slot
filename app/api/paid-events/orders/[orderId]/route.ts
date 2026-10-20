import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { offerNextPaidWaitlistSpot } from '@/lib/paidEventWaitlist'
import { failPaidEventOrderPayment, finalizePaidEventOrderPayment } from '@/lib/paymentFinalizers'
import { verifyPaystackTransaction, PaystackTimeoutError } from '@/lib/paystack'
import { toMinorUnits } from '@/lib/financialLedger'
import { extractInvoiceState, extractProviderReference, getIntaSendPaymentStatus } from '@/lib/intasend'

export async function GET(_req: NextRequest, props: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await props.params

  const order = await prisma.paidEventOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      fulfillmentStatus: true,
      providerReference: true,
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
      select: {
        checkoutRequestId: true,
        providerReference: true,
        amountKes: true,
        currency: true,
      },
    })

    if (paymentOrder?.providerReference?.startsWith('paystack:')) {
      const reference = paymentOrder.providerReference.slice('paystack:'.length)
      try {
        const paystack = await verifyPaystackTransaction(reference)
        const expectedMinor = Number(toMinorUnits(paymentOrder.amountKes, paymentOrder.currency || 'KES'))

        // Strict verification:
        // 1. Transaction status must be 'success'
        // 2. Exact amount verification in minor units
        // 3. Exact currency verification
        if (
          paystack.status === 'success' &&
          paystack.amountMinorUnits === expectedMinor &&
          paystack.currency === (paymentOrder.currency || 'KES')
        ) {
          const finalResult = await finalizePaidEventOrderPayment(order.id, reference)
          if (finalResult?.status === 'OVERCAPACITY_PAID') {
            status = 'OVERCAPACITY_PAID'
          } else {
            status = 'PAID'
          }
        } else if (paystack.status === 'failed' || paystack.status === 'abandoned') {
          await failPaidEventOrderPayment(order.id, 'FAILED')
          status = 'FAILED'
        }
      } catch {
        // INVARIANT: Never mark payment failed on timeout or transient network errors!
        // Keep order in PAYMENT_PENDING so future poll or webhook can reconcile.
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
          fulfillmentStatus: true,
          providerReference: true,
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

  const isOvercapacity = status === 'OVERCAPACITY_PAID'

  return NextResponse.json({
    success: true,
    status,
    fulfillmentStatus: (responseOrder as any)?.fulfillmentStatus ?? (order as any).fulfillmentStatus ?? (isOvercapacity ? 'OVERCAPACITY_HOLD' : null),
    message: isOvercapacity
      ? 'Payment was successfully received, but the capacity hold expired and the event reached capacity before payment was finalized. Our team has been notified to resolve your registration or process a refund.'
      : undefined,
    providerReference: responseOrder?.providerReference ?? order.providerReference ?? null,
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
