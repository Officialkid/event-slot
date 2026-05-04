import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const reference = searchParams.get('reference')

  if (!reference) {
    redirect('/dashboard?error=missing_reference')
  }

  try {
    const existing = await prisma.reportDownloadTransaction.findUnique({
      where: { reference },
      select: { id: true },
    })

    if (existing) {
      redirect('/dashboard?report_downloads=added')
    }

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    )

    const data = await response.json()

    if (!data.status || data.data.status !== 'success') {
      redirect('/dashboard?error=payment_failed')
    }

    const { userId, downloads } = data.data.metadata

    await prisma.reportDownload.upsert({
      where: { userId },
      update: {
        downloadsRemaining: { increment: downloads },
        totalPurchased: { increment: downloads },
      },
      create: {
        userId,
        downloadsRemaining: downloads,
        totalPurchased: downloads,
      },
    })

    await prisma.reportDownloadTransaction.create({
      data: {
        userId,
        bundleKey: data.data.metadata.bundleKey,
        amountKsh: data.data.metadata.bundle?.amount ?? 0,
        downloads,
        reference,
      },
    })

    redirect('/dashboard?report_downloads=added')
  } catch {
    redirect('/dashboard?error=verification_failed')
  }
}
