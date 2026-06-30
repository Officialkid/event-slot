import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { normalizeMpesaPhone } from '@/lib/intasend'
import { paystackFetch } from '@/lib/paystack'
import { APP_URL } from '@/lib/config'

export async function POST(req: NextRequest, props: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await props.params
  const body = await req.json().catch(() => ({}))
  const rawPhone = typeof body.mpesaPhone === 'string' ? body.mpesaPhone : ''
  const requestedPaymentMethod = typeof body.paymentMethod === 'string' ? body.paymentMethod : ''

  const order = await prisma.paidEventOrder.findUnique({
    where: { id: orderId },
    include: {
      ticketTier: { select: { name: true } },
      event: { select: { title: true, slug: true } },
    },
  })

  if (!order) {
    return NextResponse.json({ success: false, error: 'Payment order not found' }, { status: 404 })
  }

  if (order.status === 'PAID') {
    return NextResponse.json({ success: false, error: 'This order is already paid' }, { status: 400 })
  }

  if (order.holdExpiresAt < new Date()) {
    await prisma.paidEventOrder.update({
      where: { id: order.id },
      data: { status: 'EXPIRED' },
    }).catch(() => {})
    return NextResponse.json({ success: false, error: 'This payment link has expired' }, { status: 400 })
  }

  const paymentMethod = requestedPaymentMethod === 'card'
    ? 'card'
    : requestedPaymentMethod === 'mpesa'
      ? 'mpesa'
      : order.paymentMethod === 'CARD'
        ? 'card'
        : 'mpesa'

  const phone = paymentMethod === 'mpesa' ? normalizeMpesaPhone(rawPhone) : null
  if (paymentMethod === 'mpesa') {
    if (!rawPhone.trim()) {
      return NextResponse.json({ success: false, error: 'M-Pesa phone number is required' }, { status: 400 })
    }
    if (!/^2547\d{8}$/.test(phone ?? '') && !/^2541\d{8}$/.test(phone ?? '')) {
      return NextResponse.json({ success: false, error: 'Invalid M-Pesa phone number' }, { status: 400 })
    }
  }

  try {
    const apiRef = `paid_event_${order.id}`
    const paystack = await paystackFetch('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: order.attendeeEmail ?? `${order.id}@eventslot.local`,
        amount: Math.round(order.amountKes * 100),
        currency: 'KES',
        callback_url: `${APP_URL}/api/billing/verify`,
        channels: ['mobile_money'],
        metadata: {
          type: 'paid_event_checkout',
          eventId: order.eventId,
          eventSlug: order.event.slug,
          paymentRecordId: order.id,
          orderId: order.id,
          ticketTierId: order.ticketTierId,
          paymentMethod,
          ...(phone ? { mpesaPhone: phone } : {}),
          apiRef,
        },
      }),
    })

    if (!paystack.status || !paystack.data?.authorization_url || !paystack.data?.reference) {
      return NextResponse.json(
        { success: false, error: paystack.message ?? 'Unable to start checkout.' },
        { status: 502 }
      )
    }

    await prisma.paidEventOrder.update({
      where: { id: order.id },
      data: {
        status: 'PAYMENT_PENDING',
        checkoutRequestId: paystack.data.reference,
        providerReference: `paystack:${paystack.data.reference}`,
        mpesaPhone: phone,
      },
    })

    return NextResponse.json({
      success: true,
      orderId: order.id,
      checkoutRequestId: paystack.data.reference,
      url: paystack.data.authorization_url,
      customerMessage: 'Continue to secure payment checkout.',
      amountKes: order.amountKes,
      eventTitle: order.event.title,
      ticketTierName: order.ticketTier.name,
      paymentMethod: 'paystack',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payment initiation failed'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
