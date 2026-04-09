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

    if (!user?.paystackCustomerCode) {
      return NextResponse.json({ invoices: [] })
    }

    const response = await paystackFetch(`/transaction?customer=${user.paystackCustomerCode}&perPage=10`)

    const invoices = (response.data ?? []).map((tx: Record<string, unknown>) => ({
      id: tx.reference,
      date: tx.paid_at ?? tx.created_at,
      amount: tx.amount,
      currency: tx.currency,
      status: tx.status,
      invoiceUrl: null,
    }))

    return NextResponse.json({ invoices })
  } catch (err) {
    console.error('[billing/invoices] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
