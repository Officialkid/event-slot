import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { activateEventPassPayment, activateSubscriptionPayment } from '@/lib/paymentFinalizers'

export async function POST(request: Request) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-paystack-signature')

    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
      .update(body)
      .digest('hex')

    if (hash !== signature) {
      return Response.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const event = JSON.parse(body)

    switch (event.event) {

    case 'subscription.create': {
      const { customer, plan, next_payment_date, subscription_code } = event.data
      const userId = event.data.metadata?.userId

      if (!userId) break

      await prisma.user.update({
        where: { id: userId },
        data: {
          // Subscription plans are disabled; keep all users on free.
          plan: 'free',
          billingCycle: null,
          planEndDate: null,
          paystackCustomerCode: customer.customer_code,
          paystackSubscriptionCode: subscription_code,
        },
      })
      void plan
      void next_payment_date
      break
    }

    case 'invoice.payment_failed': {
      const { subscription } = event.data
      const user = await prisma.user.findFirst({
        where: { paystackSubscriptionCode: subscription.subscription_code },
      })
      if (!user) break

      await prisma.notification.create({
        data: {
          userId: user.id,
          type: 'EVENT',
          title: 'Payment Failed',
          message: 'Your last payment failed. Please update your payment method to keep your plan active.',
          link: '/dashboard/billing',
        },
      })
      break
    }

    case 'subscription.disable': {
      const { subscription_code } = event.data
      const user = await prisma.user.findFirst({
        where: { paystackSubscriptionCode: subscription_code },
      })
      if (!user) break

      await prisma.user.update({
        where: { id: user.id },
        data: {
          plan: 'free',
          billingCycle: null,
          planEndDate: null,
          paystackSubscriptionCode: null,
        },
      })
      break
    }

    case 'subscription.not_renew': {
      const { subscription_code, next_payment_date } = event.data
      const user = await prisma.user.findFirst({
        where: { paystackSubscriptionCode: subscription_code },
      })
      if (!user) break

      await prisma.user.update({
        where: { id: user.id },
        data: { planEndDate: new Date(next_payment_date) },
      })
      break
    }

    case 'charge.success': {
      const { metadata, amount, reference, customer } = event.data
      if (metadata?.type === 'credits') {
        const creditsToAdd = amount / 100
        await prisma.user.update({
          where: { id: metadata.userId },
          data: { creditBalance: { increment: creditsToAdd } },
        })
      } else if (metadata?.type === 'subscription_plan' && metadata?.paymentRecordId) {
        await activateSubscriptionPayment(metadata.paymentRecordId, reference ?? null)

        if (metadata?.userId && customer?.customer_code) {
          await prisma.user.update({
            where: { id: metadata.userId },
            data: { paystackCustomerCode: customer.customer_code },
          }).catch(() => {})
        }
      } else if (metadata?.type === 'event_pass' && metadata?.paymentRecordId) {
        await activateEventPassPayment(metadata.paymentRecordId, reference ?? null)
      }
      break
    }
  }

    return Response.json({ received: true })
  } catch (err) {
    console.error('[billing/webhook] POST error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

