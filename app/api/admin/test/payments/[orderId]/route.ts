import fs from 'fs'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { isAdminEmail } from '@/lib/isAdmin'
import { getPaidEventCommissionRate } from '@/lib/paidEventCommission'
import { generateQRPayload } from '@/lib/ticket-qr'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  const isAdmin =
    session?.user?.role === 'SUPER_ADMIN' ||
    session?.user?.isAdmin ||
    isAdminEmail(session?.user?.email)

  if (!session || !isAdmin) {
    return null
  }

  return session
}

function routeExists(routePath: string) {
  const filePath = path.join(
    process.cwd(),
    'app',
    '(organizer)',
    ...routePath.replace(/^\//, '').split('/'),
    'page.tsx'
  )
  return fs.existsSync(filePath)
}

export async function GET(_req: NextRequest, props: { params: Promise<{ orderId: string }> }) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { orderId } = await props.params
  const order = await prisma.paidEventOrder.findUnique({
    where: { id: orderId },
    include: {
      event: {
        select: {
          id: true,
          title: true,
          slug: true,
          organizerId: true,
          organizer: {
            select: {
              id: true,
              email: true,
              plan: true,
            },
          },
        },
      },
      ticketTier: {
        select: {
          id: true,
          name: true,
        },
      },
      payment: true,
      registrations: {
        take: 1,
        include: {
          ticket: true,
        },
      },
    },
  })

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const registration = order.registrations[0] ?? null
  const ticket = registration?.ticket ?? null
  const payment = order.payment
  const plan = order.event.organizer?.plan ?? 'free'
  const expectedRate = getPaidEventCommissionRate(plan)
  const expectedCommission = Math.round(order.amountKes * expectedRate)
  const expectedNet = order.amountKes - expectedCommission

  const emailLog = await prisma.errorLog.findFirst({
    where: { route: `paid-ticket-email:${order.id}` },
    orderBy: { createdAt: 'desc' },
  })
  const callbackLog = await prisma.errorLog.findFirst({
    where: { route: `mpesa-callback:${order.id}` },
    orderBy: { createdAt: 'desc' },
  })

  let emailStatus: 'sent' | 'failed' | 'unknown' = 'unknown'
  if (emailLog) {
    try {
      const parsed = JSON.parse(emailLog.message) as { status?: 'sent' | 'failed' }
      if (parsed.status === 'sent' || parsed.status === 'failed') {
        emailStatus = parsed.status
      }
    } catch {
      emailStatus = 'unknown'
    }
  }

  let failureReason: string | null = null
  if (callbackLog) {
    try {
      const parsed = JSON.parse(callbackLog.message) as { resultCode?: number; resultDesc?: string | null }
      if (parsed.resultCode === 1032) {
        failureReason = 'User cancelled STK Push'
      } else if (parsed.resultCode === 1) {
        failureReason = 'Insufficient funds'
      } else if (typeof parsed.resultDesc === 'string' && parsed.resultDesc.trim()) {
        failureReason = parsed.resultDesc.trim()
      }
    } catch {
      failureReason = null
    }
  }

  let qrGenerated = false
  if (ticket && registration) {
    try {
      qrGenerated = Boolean(generateQRPayload(ticket.id, order.event.id, registration.id))
    } catch {
      qrGenerated = false
    }
  }

  const gapChecks = [
    {
      key: 'organiser-earnings-dashboard',
      name: 'Organiser earnings dashboard',
      passed: routeExists('/dashboard/earnings'),
      fix: 'Build organiser earnings page - see test-04-gaps.md',
    },
    {
      key: 'organiser-balance-visible',
      name: 'Organiser balance visible',
      passed: false,
      fix: 'Add earnings/balance aggregation to organiser dashboard',
    },
    {
      key: 'commission-stored',
      name: 'Commission stored on Payment record',
      passed: Boolean(payment && payment.commissionAmount === expectedCommission && payment.organizerAmount === expectedNet),
      fix: 'Ensure commissionAmount and organizerAmount are saved on Payment creation',
    },
    {
      key: 'ticket-generated',
      name: 'Ticket generated after payment',
      passed: Boolean(ticket && payment?.ticketId),
      fix: 'Ticket generation not triggered on payment success callback',
    },
    {
      key: 'qr-generated',
      name: 'QR code generated on ticket',
      passed: qrGenerated,
      fix: 'QR payload is not being generated - check ticket creation service',
    },
    {
      key: 'confirmation-email',
      name: 'Confirmation email sent',
      passed: emailStatus === 'sent',
      fix: 'Email not triggered after successful payment',
    },
    {
      key: 'confirmation-lookup',
      name: 'Attendee can look up ticket via Confirm My Attendance',
      passed: Boolean(registration?.attendeeEmail && registration?.status === 'confirmed' && registration.confirmationCode),
      fix: 'Lookup returning null for paid event tickets',
    },
  ]

  return NextResponse.json({
    success: true,
    status: order.status,
    attendee: {
      name: order.attendeeName ?? 'Attendee',
      email: order.attendeeEmail,
      phone: order.attendeePhone,
    },
    amountKes: order.amountKes,
    eventTitle: order.event.title,
    ticketTierName: order.ticketTier.name,
    organizerPlan: (plan ?? 'free').toUpperCase(),
    commission: {
      rate: expectedRate,
      expectedCommission,
      expectedNet,
      storedCommission: payment?.commissionAmount ?? null,
      storedNet: payment?.organizerAmount ?? null,
      correct: Boolean(payment && payment.commissionAmount === expectedCommission && payment.organizerAmount === expectedNet),
    },
    mpesaRef: payment?.mpesaRef ?? order.mpesaReceiptNumber ?? order.providerReference ?? null,
    failureReason,
    ticket: ticket
      ? {
          id: ticket.id,
          code: ticket.code,
          qrGenerated,
        }
      : null,
    registration: registration
      ? {
          id: registration.id,
          status: registration.status,
          confirmationCode: registration.confirmationCode,
        }
      : null,
    emailSent: emailStatus === 'sent',
    gapChecks,
  })
}
