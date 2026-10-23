import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { paystackFetch } from '@/lib/paystack'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { paystackCustomerCode: true },
    })

    // 1. Fetch all local SubscriptionPayment records (historical records and active Paystack)
    const localPayments = await prisma.subscriptionPayment.findMany({
      where: {
        subscription: { userId: session.user.id },
        status: 'SUCCESS',
      },
      orderBy: { paidAt: 'desc' },
      take: 20,
      select: {
        id: true,
        amountKes: true,
        amountUsd: true,
        provider: true,
        providerRef: true,
        paidAt: true,
        createdAt: true,
        description: true,
      },
    })

    const invoiceMap = new Map<string, {
      id: string
      date: string
      amount: number
      currency: string
      status: string
      provider: string
      invoiceUrl: string | null
    }>()

    // Add local records
    for (const p of localPayments) {
      const key = p.providerRef || p.id
      invoiceMap.set(key, {
        id: key,
        date: (p.paidAt || p.createdAt).toISOString(),
        amount: p.amountKes,
        currency: 'KES',
        status: 'success',
        provider: p.provider,
        invoiceUrl: null,
      })
    }

    // 2. Query Paystack transactions if customerCode exists
    if (user?.paystackCustomerCode) {
      try {
        const response = await paystackFetch(
          `/transaction?customer=${encodeURIComponent(user.paystackCustomerCode)}&perPage=20`
        )
        const paystackTxList = response.data ?? []

        for (const tx of paystackTxList) {
          const ref = tx.reference || String(tx.id)
          if (!invoiceMap.has(ref)) {
            invoiceMap.set(ref, {
              id: ref,
              date: tx.paid_at || tx.created_at || new Date().toISOString(),
              amount: (tx.amount || 0) / 100,
              currency: (tx.currency || 'KES').toUpperCase(),
              status: tx.status || 'success',
              provider: 'paystack',
              invoiceUrl: null,
            })
          }
        }
      } catch (paystackErr) {
        console.warn('[billing/invoices] Failed to load Paystack remote transactions:', paystackErr)
      }
    }

    const invoices = Array.from(invoiceMap.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )

    return NextResponse.json({ invoices })
  } catch (err) {
    console.error('[billing/invoices] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
