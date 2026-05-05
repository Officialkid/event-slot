import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { askAIWithMeta } from '@/lib/ai'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all events + registrations for this organizer
    const events = await prisma.event.findMany({
      where: { organizerId: session.user.id },
      select: {
        id: true,
        title: true,
        questions: true,
        registrations: {
          select: {
            answers: true,
            submittedAt: true,
            attendeeEmail: true,
          },
        },
      },
    })

    const totalEventsAnalysed = events.length
    const allRegistrations = events.flatMap(e => e.registrations)
    const totalRespondents = allRegistrations.length

    // Cross-event demographics by question label
    const questionAggMap = new Map<string, {
      type: string
      answers: string[]
    }>()

    for (const event of events) {
      const questions = event.questions as Array<{ id: string; label: string; type: string; options?: string[] }>
      for (const reg of event.registrations) {
        const answers = reg.answers as Array<{ questionId: string; value: string }>
        for (const answer of answers) {
          const question = questions.find(q => q.id === answer.questionId)
          if (!question || !answer.value?.trim()) continue
          const existing = questionAggMap.get(question.label)
          if (existing) {
            existing.answers.push(answer.value.trim())
          } else {
            questionAggMap.set(question.label, { type: question.type, answers: [answer.value.trim()] })
          }
        }
      }
    }

    const questionInsights = Array.from(questionAggMap.entries()).map(([label, { type, answers }]) => {
      const countMap = new Map<string, number>()
      for (const v of answers) {
        const key = v.toLowerCase()
        countMap.set(key, (countMap.get(key) ?? 0) + 1)
      }
      const sorted = Array.from(countMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([value, count]) => ({
          value,
          count,
          percentage: Math.round((count / answers.length) * 1000) / 10,
        }))
      return {
        questionLabel: label,
        questionType: type,
        totalAnswers: answers.length,
        topAnswers: sorted,
      }
    }).sort((a, b) => b.totalAnswers - a.totalAnswers)

    // Registrations by day of week
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const dowMap = new Map<string, number>()
    for (const d of days) dowMap.set(d, 0)
    for (const reg of allRegistrations) {
      const day = days[new Date(reg.submittedAt).getDay()]
      dowMap.set(day, (dowMap.get(day) ?? 0) + 1)
    }
    const registrationsByDayOfWeek = days.map(day => ({ day, count: dowMap.get(day) ?? 0 }))

    // Registrations by month (last 12)
    const monthMap = new Map<string, number>()
    const now = new Date()
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      monthMap.set(key, 0)
    }
    for (const reg of allRegistrations) {
      const d = new Date(reg.submittedAt)
      const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      if (monthMap.has(key)) monthMap.set(key, (monthMap.get(key) ?? 0) + 1)
    }
    const registrationsByMonth = Array.from(monthMap.entries()).map(([month, count]) => ({ month, count }))

    // Repeat attendees (emails that appear in 2+ registrations)
    const emailCount = new Map<string, number>()
    for (const reg of allRegistrations) {
      if (reg.attendeeEmail) {
        const e = reg.attendeeEmail.toLowerCase()
        emailCount.set(e, (emailCount.get(e) ?? 0) + 1)
      }
    }
    const repeatAttendees = Array.from(emailCount.values()).filter(c => c >= 2).length

    const trackerSystem = `You are an analytics assistant. Summarize cross-event registration trends in under 80 words.
Keep it practical and avoid hype. Mention one strength and one thing to improve.`

    const trackerPrompt = `Totals:
- Events analysed: ${totalEventsAnalysed}
- Respondents: ${totalRespondents}
- Repeat attendees: ${repeatAttendees}

Top question insights (up to 3):
${questionInsights.slice(0, 3).map((q) => `${q.questionLabel}: ${q.topAnswers.slice(0, 3).map((a) => `${a.value} (${a.percentage}%)`).join(', ') || 'n/a'}`).join('\n') || 'No question insight data'}

Registrations by day of week:
${registrationsByDayOfWeek.map((d) => `${d.day}: ${d.count}`).join(', ')}

Registrations by month:
${registrationsByMonth.map((m) => `${m.month}: ${m.count}`).join(', ')}`

    const aiSummaryResult = await askAIWithMeta({
      system: trackerSystem,
      prompt: trackerPrompt,
      taskType: 'tracker',
      maxTokens: 180,
    })

    const aiSummary = aiSummaryResult.content
      ?? 'AI summary is temporarily unavailable. Core analytics remain available below.'

    return NextResponse.json({
      totalEventsAnalysed,
      totalRespondents,
      questionInsights,
      registrationsByDayOfWeek,
      registrationsByMonth,
      repeatAttendees,
      aiSummary,
      aiSummarySource: aiSummaryResult.content ? 'ai' : 'fallback',
      aiProvider: aiSummaryResult.provider,
      providerStatus: aiSummaryResult.providerStatus,
      retryRecommended: aiSummaryResult.retryRecommended,
    })
  } catch (err) {
    console.error('Insights error:', err)
    return NextResponse.json({ error: 'Unable to load insights right now. Please retry.' }, { status: 503 })
  }
}
