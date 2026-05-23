import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { FALLBACK_RATES } from '@/lib/currency'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

async function getExchangeRate(currencyCode: string): Promise<number> {
  try {
    // Check DB cache first
    const cached = await prisma.exchangeRate.findUnique({
      where: { currency: currencyCode },
    })
    if (cached && Date.now() - cached.updatedAt.getTime() < CACHE_TTL_MS) {
      return cached.rate
    }

    // Fetch fresh from free exchange rate API
    const res  = await fetch('https://api.exchangerate-api.com/v4/latest/USD', {
      next: { revalidate: 86400 },
    })
    if (!res.ok) throw new Error('Exchange rate API unavailable')
    const data = await res.json() as { rates: Record<string, number> }
    const rate = data.rates[currencyCode] ?? FALLBACK_RATES[currencyCode] ?? 1

    // Upsert into DB cache
    await prisma.exchangeRate.upsert({
      where:  { currency: currencyCode },
      update: { rate },
      create: { currency: currencyCode, rate },
    })

    return rate
  } catch {
    return FALLBACK_RATES[currencyCode] ?? 1
  }
}

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ currency: string }> }
) {
  const { currency } = await props.params
  const code = currency.toUpperCase()
  const rate = await getExchangeRate(code)
  return NextResponse.json({ currency: code, rate })
}
