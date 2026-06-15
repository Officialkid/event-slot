import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(_req: NextRequest, props: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await props.params

  const order = await prisma.paidEventOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      holdExpiresAt: true,
      registration: {
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
  }

  return NextResponse.json({
    success: true,
    status,
    confirmationCode: order.registration?.confirmationCode ?? null,
    registrationId: order.registration?.id ?? null,
  })
}
