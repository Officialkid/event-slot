import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { paystackFetch } from '@/lib/paystack'
import { addCredits } from '@/lib/credits'
import { REPORT_DOWNLOAD_PRICING } from '@/lib/plans'

function redirectTo(request: Request, path: string) {
  const current = new URL(request.url)
  return NextResponse.redirect(new URL(path, current.origin))
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const reference = searchParams.get('reference')

  if (!reference) {
    return redirectTo(request, '/dashboard/billing?error=missing_reference')
  }

  try {
    const data = await paystackFetch(`/transaction/verify/${reference}`)

    if (!data.status || data.data?.status !== 'success') {
      console.error('[billing/verify] Payment not successful:', data.message ?? data.data?.status)
      return redirectTo(request, '/dashboard/billing?error=payment_failed')
    }

    const { userId, plan, billingCycle, type, creditAmount, bundleKey } = data.data.metadata ?? {}

    if (!userId) {
      return redirectTo(request, '/dashboard/billing?error=invalid_metadata')
    }

    if (type === 'credits') {
      const amount = typeof creditAmount === 'number' ? creditAmount : Math.round(data.data.amount / 100)
      await addCredits({
        userId,
        amount,
        description: `Purchased ${amount} points`,
        reference,
      })
      return redirectTo(request, '/dashboard/billing?credits=added')
    } else if (type === 'report_download') {
      const bundle = bundleKey ? REPORT_DOWNLOAD_PRICING[bundleKey as keyof typeof REPORT_DOWNLOAD_PRICING] : null
      if (!bundle) {
        return redirectTo(request, '/dashboard/billing?error=invalid_bundle')
      }

      const existing = await prisma.reportDownloadTransaction.findUnique({
        where: { reference },
        select: { id: true },
      })
      if (existing) {
        return redirectTo(request, '/dashboard/billing?downloads=added')
      }

      const amountKsh = Math.round(data.data.amount / 100)

      await prisma.$transaction(async (tx) => {
        await tx.reportDownloadTransaction.create({
          data: {
            userId,
            bundleKey,
            amountKsh,
            downloads: bundle.downloads,
            reference,
          },
        })

        await tx.reportDownload.upsert({
          where: { userId },
          create: {
            userId,
            downloadsRemaining: bundle.downloads,
            totalPurchased: bundle.downloads,
          },
          update: {
            downloadsRemaining: { increment: bundle.downloads },
            totalPurchased: { increment: bundle.downloads },
          },
        })
      })

      return redirectTo(request, '/dashboard/billing?downloads=added')
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
      return redirectTo(request, `/dashboard/billing?success=true&plan=${plan}`)
    }
  } catch (err) {
    console.error('[billing/verify]', err)
    return redirectTo(request, '/dashboard/billing?error=verification_failed')
  }
}
