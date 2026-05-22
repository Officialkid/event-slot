import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'
import { ratelimit } from '@/lib/ratelimit'

export async function POST(req: NextRequest) {
  try {
    const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous'
    const { success } = await ratelimit.limit(`waitlist:${ip}`)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
    }

    const body = await req.json()
    const email: unknown = body?.email
    const feature: unknown = body?.feature

    if (
      typeof email !== 'string' ||
      typeof feature !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      feature.trim().length === 0 ||
      feature.trim().length > 120
    ) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const featureName = feature.trim()

    await prisma.featureInterest.upsert({
      where: { email_featureName: { email: email.toLowerCase(), featureName } },
      create: { email: email.toLowerCase(), featureName },
      update: {},
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[WAITLIST ERROR]', err)
    return NextResponse.json({ error: 'Failed to save. Please try again.' }, { status: 500 })
  }
}
