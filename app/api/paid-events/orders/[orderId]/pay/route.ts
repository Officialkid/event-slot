import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { initiateStkPush, normaliseMpesaPhone } from '@/lib/daraja'

export async function POST(req: NextRequest, props: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await props.params
  const body = await req.json().catch(() => ({}))
  const rawPhone = typeof body.mpesaPhone === 'string' ? body.mpesaPhone : ''

  if (!rawPhone.trim()) {
    return NextResponse.json({ success: false, error: 'M-Pesa phone number is required' }, { status: 400 })
  }

  const order = await prisma.paidEventOrder.findUnique({
    where: { id: orderId },
    include: {
      ticketTier: { select: { name: true } },
      event: { select: { title: true } },
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

  const phone = normaliseMpesaPhone(rawPhone)
  if (!/^2547\d{8}$/.test(phone) && !/^2541\d{8}$/.test(phone)) {
    return NextResponse.json({ success: false, error: 'Invalid M-Pesa phone number' }, { status: 400 })
  }

  try {
    const stk = await initiateStkPush({
      phone,
      amountKes: order.amountKes,
      accountReference: 'EventSlot',
      transactionDesc: `${order.ticketTier.name} ticket`,
    })

    if (stk.ResponseCode !== '0') {
      return NextResponse.json({ success: false, error: 'M-Pesa request failed. Please try again.' }, { status: 502 })
    }

    await prisma.paidEventOrder.update({
      where: { id: order.id },
      data: {
        status: 'PAYMENT_PENDING',
        checkoutRequestId: stk.CheckoutRequestID,
        providerReference: stk.MerchantRequestID,
        mpesaPhone: phone,
      },
    })

    return NextResponse.json({
      success: true,
      orderId: order.id,
      checkoutRequestId: stk.CheckoutRequestID,
      customerMessage: stk.CustomerMessage,
      amountKes: order.amountKes,
      eventTitle: order.event.title,
      ticketTierName: order.ticketTier.name,
      paymentMethod: 'mpesa',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payment initiation failed'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
