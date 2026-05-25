import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { askAIWithMeta } from '@/lib/ai'

type InsightsRange = '30d' | '90d' | '1y' | 'all'
type EventQuestion = { id: string; label: string; type: string }
type AnswerRow = { questionId: string; value: string }

function getStartDate(range: InsightsRange): Date | undefined {
  const now = Date.now()
  if (range === '30d') return new Date(now - 30 * 86_400_000)
  if (range === '90d') return new Date(now - 90 * 86_400_000)
  if (range === '1y') return new Date(now - 365 * 86_400_000)
  return undefined
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const rangeParam = body?.range
    const range: InsightsRange =
      rangeParam === '30d' || rangeParam === '90d' || rangeParam === '1y' || rangeParam === 'all'
        ? rangeParam
        : '90d'
    const startDate = getStartDate(range)

    const events = await prisma.event.findMany({
      where: { organizerId: session.user.id },
      take: 20,
      select: {
        questions: true,
        registrations: {
          where: startDate ? { submittedAt: { gte: startDate } } : undefined,
          select: { answers: true },
          take: 300,
        },
      },
    })

    const valueMaps = new Map<string, Map<string, number>>()
    let totalRegistrations = 0

    for (const event of events) {
      const questions = Array.isArray(event.questions) ? (event.questions as EventQuestion[]) : []
      for (const registration of event.registrations) {
        totalRegistrations += 1
        const answers = Array.isArray(registration.answers)
          ? (registration.answers as AnswerRow[])
          : []

        for (const answer of answers) {
          const question = questions.find((q) => q.id === answer.questionId)
          if (!question || !answer.value?.trim()) continue

          if (!valueMaps.has(question.label)) {
            valueMaps.set(question.label, new Map<string, number>())
          }

          const key = answer.value.trim().toLowerCase()
          const map = valueMaps.get(question.label)!
          map.set(key, (map.get(key) ?? 0) + 1)
        }
      }
    }

    const questionSummary = Array.from(valueMaps.entries())
      .map(([label, countMap]) => {
        const topAnswers = Array.from(countMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([value, count]) => `${value} (${count})`)
          .join(', ')
        return `${label}: ${topAnswers}`
      })
      .slice(0, 10)
      .join('\n')

    const prompt = `You are an event analytics assistant. Based on this registration data from an event organizer's events, write a 2-sentence audience profile. Be specific, use the numbers, and make it feel insightful.\n\nRange: ${range}\nTotal registrations across all events: ${totalRegistrations}\nQuestion answer breakdown:\n${questionSummary || 'No custom question data available yet.'}\n\nWrite only the profile. No preamble. No bullet points. Max 40 words.`

    const aiResult = await askAIWithMeta({
      system: 'Write concise audience profile summaries for event organizers.',
      prompt,
      taskType: 'tracker',
      maxTokens: 120,
    })

    const profile = aiResult.content?.trim() || 'Audience profile is temporarily unavailable. Try regenerating in a moment.'

    return NextResponse.json({ profile, source: aiResult.content ? 'ai' : 'fallback' })
  } catch (error) {
    console.error('Audience profile error:', error)
    return NextResponse.json({ error: 'Unable to generate audience profile right now.' }, { status: 503 })
  }
}
