import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { CREDIT_COSTS, getUserCredits, spendCredits } from '@/lib/credits'
import { askClaude } from '@/lib/claude'

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { slug } = params
    const token = req.nextUrl.searchParams.get('token')
    const session = await getServerSession(authOptions)

    let body: { question?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const question = (body?.question ?? '').trim()
    if (!question) return NextResponse.json({ error: 'Question is required' }, { status: 400 })
    if (question.length > 500) return NextResponse.json({ error: 'Question too long' }, { status: 400 })

    const event = await prisma.event.findUnique({
      where: { slug },
      include: {
        organizer: { select: { id: true, plan: true } },
        insight: true,
      },
    })

    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

    const isOwner = !!(session?.user?.id && event.organizerId === session.user.id)
    const hasValidToken = !!(token && event.dashboardToken === token)
    if (!isOwner && !hasValidToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const plan = event.organizer?.plan ?? 'free'
    const userId = session?.user?.id ?? event.organizerId

    // Business: free. Pro/free with credits: spend 1. Free no credits: locked.
    if (plan !== 'business') {
      if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      const credits = await getUserCredits(userId)
      if (credits < CREDIT_COSTS.ai_query) {
        return NextResponse.json(
          { locked: true, requiredCredits: CREDIT_COSTS.ai_query, currentCredits: credits },
          { status: 402 }
        )
      }
      const spendResult = await spendCredits({
        userId,
        amount: CREDIT_COSTS.ai_query,
        description: `AI Q&A for "${event.title}"`,
        eventId: event.id,
      })
      if (!spendResult.success) {
        return NextResponse.json({ error: spendResult.error ?? 'Insufficient credits' }, { status: 402 })
      }
    }

    // Fetch registrations and view count
    const [registrations, viewCount] = await Promise.all([
      prisma.registration.findMany({
        where: { eventId: event.id },
        select: { submittedAt: true, status: true, answers: true },
      }),
      prisma.eventView.count({ where: { eventId: event.id } }),
    ])

    const totalRegistrations = registrations.length
    const confirmedCount = registrations.filter(r => r.status === 'confirmed').length
    const waitlistCount = registrations.filter(r => r.status === 'waitlist').length
    const conversionRate = viewCount > 0
      ? Math.round((totalRegistrations / viewCount) * 1000) / 10
      : 0

    // Top answers per form question
    const questions = (event.questions as Array<{ id: string; label: string; type: string }>) ?? []
    const answerSummaries: string[] = []
    for (const q of questions) {
      const values = registrations.flatMap(r => {
        const ans = r.answers as unknown as Array<{ questionId: string; value: string }>
        return (Array.isArray(ans) ? ans : []).filter(a => a.questionId === q.id).map(a => a.value)
      }).filter(Boolean)
      if (values.length === 0) continue
      const freq = new Map<string, number>()
      for (const v of values) freq.set(v, (freq.get(v) ?? 0) + 1)
      const sorted: Array<[string, number]> = []
      freq.forEach((count, val) => sorted.push([val, count]))
      sorted.sort((a, b) => b[1] - a[1])
      const top = sorted.slice(0, 3).map(([v, n]) => `"${v}" (${n}x)`).join(', ')
      answerSummaries.push(`"${q.label}": ${top}`)
    }

    // Registrations by day of week
    const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const dowMap: Record<string, number> = {}
    for (const r of registrations) {
      const d = DOW[new Date(r.submittedAt).getDay()]
      dowMap[d] = (dowMap[d] ?? 0) + 1
    }
    const regsByDow = Object.entries(dowMap)
      .sort((a, b) => b[1] - a[1])
      .map(([day, count]) => `${day}: ${count}`)
      .join(', ')

    // Cached insights summary
    const insightSummary = event.insight
      ? (event.insight.cards as Array<{ title: string; body: string }>)
          .map(c => `• ${c.title}: ${c.body}`)
          .join('\n')
      : null

    const context = `Event: "${event.title}"
Date: ${event.eventDate ? new Date(event.eventDate).toDateString() : 'TBD'}
Location: ${event.location ?? 'Not specified'}
Capacity: ${event.capacity ?? 'Unlimited'}

Registrations: ${totalRegistrations} total (${confirmedCount} confirmed, ${waitlistCount} on waitlist)
Page views: ${viewCount} | Conversion rate: ${conversionRate}%
Registrations by day of week: ${regsByDow || 'no data'}

Form responses:
${answerSummaries.length > 0 ? answerSummaries.join('\n') : 'No form question data.'}${insightSummary ? `\n\nAI insights:\n${insightSummary}` : ''}`

    const system = `You are an event analytics assistant for the event organizer.
You have access to their event registration data.
Answer questions clearly and specifically using the data provided.
If the data does not support a confident answer, say so honestly.
Keep answers under 100 words. Be direct and practical.`

    const answer = await askClaude({
      system,
      prompt: `Event data:\n${context}\n\nOrganizer question: ${question}`,
      maxTokens: 200,
    })

    return NextResponse.json({ answer })
  } catch (err) {
    console.error('Ask error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
