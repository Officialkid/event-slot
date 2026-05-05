import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { askAI } from '@/lib/ai'
import { aiRatelimit } from '@/lib/ratelimit'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ prediction: null, reason: 'Sign in required' })
    }

    const { success: rlOk } = await aiRatelimit.limit(`predict:${session.user.id}`)
    if (!rlOk) {
      return NextResponse.json({ error: 'Too many requests. Please try again shortly.' }, { status: 429 })
    }

    let body: { title?: string; description?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const title = (body?.title ?? '').trim()
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

    // Fetch organizer's previous non-archived events with registration data
    const previousEvents = await prisma.event.findMany({
      where: {
        organizerId: session.user.id,
        archived: false,
      },
      select: {
        title: true,
        confirmedCount: true,
        waitlistCount: true,
        capacity: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    if (previousEvents.length < 2) {
      return NextResponse.json({
        prediction: null,
        reason: 'Not enough data yet',
      })
    }

    const previousEventsSummary = previousEvents.map(e => ({
      title: e.title,
      confirmedRegistrations: e.confirmedCount,
      waitlistRegistrations: e.waitlistCount,
      capacitySet: e.capacity,
    }))

    const system = `You are an event capacity prediction assistant.
Analyse historical event data and predict registration numbers.
Respond ONLY with JSON: { "suggestedCapacity": number, "confidence": "low"|"medium"|"high", "reasoning": string (max 30 words) }`

    const prompt = `Previous events: ${JSON.stringify(previousEventsSummary)}
New event title: ${title}
New event description: ${body?.description ?? 'Not provided'}
Predict the likely registration count.`

    const raw = await askAI({
      system,
      prompt,
      taskType: 'capacity',
      maxTokens: 150,
    })

    if (!raw) {
      return NextResponse.json({ prediction: null, reason: 'AI is temporarily unavailable' })
    }

    let parsed: { suggestedCapacity: number; confidence: 'low' | 'medium' | 'high'; reasoning: string }
    try {
      const cleaned = raw.replace(/```json|```/g, '').trim()
      parsed = JSON.parse(cleaned)
      if (
        typeof parsed.suggestedCapacity !== 'number' ||
        !['low', 'medium', 'high'].includes(parsed.confidence)
      ) {
        throw new Error('Invalid prediction shape')
      }
    } catch {
      return NextResponse.json({ prediction: null, reason: 'Could not parse prediction' })
    }

    return NextResponse.json({ prediction: parsed })
  } catch (err) {
    console.error('Predict capacity error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
