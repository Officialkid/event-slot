import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { paystackFetch } from '@/lib/paystack'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const reference = searchParams.get('reference')

  if (!reference) {
    redirect('/dashboard/billing?error=missing_reference')
  }

  try {
    const data = await paystackFetch(`/transaction/verify/${reference}`)

    if (!data.status || data.data?.status !== 'success') {
      console.error('[billing/verify] Payment not successful:', data.message ?? data.data?.status)
      redirect('/dashboard/billing?error=payment_failed')
    }

    const { userId, plan, billingCycle, type, creditAmount } = data.data.metadata ?? {}

    if (!userId) {
      redirect('/dashboard/billing?error=invalid_metadata')
    }

    if (type === 'credits') {
      const amount = typeof creditAmount === 'number' ? creditAmount : data.data.amount / 100
      await prisma.user.update({
        where: { id: userId },
        data: { creditBalance: { increment: amount } },
      })
      await prisma.creditTransaction.create({
        data: {
          userId,
          amount,
          type: 'purchase',
          description: `Purchased ${amount} credits`,
        },
      })
      redirect('/dashboard/billing?credits=added')
    } else {
      const planEndDate = new Date()
      if (billingCycle === 'annual') {
        planEndDate.setFullYear(planEndDate.getFullYear() + 1)
      } else {
        planEndDate.setMonth(planEndDate.getMonth() + 1)
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          plan,
          billingCycle,
          planEndDate,
          planStartDate: new Date(),
        },
      })
      redirect(`/dashboard/billing?success=true&plan=${plan}`)
    }
  } catch (err) {
    console.error('[billing/verify]', err)
    redirect('/dashboard/billing?error=verification_failed')
  }
}
