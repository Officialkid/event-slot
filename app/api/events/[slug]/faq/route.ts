import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// GET /api/events/[slug]/faq — public, returns FAQs for event page
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params
  const includeAll = req.nextUrl.searchParams.get('includeAll') === '1'

  const event = await prisma.event.findUnique({
    where: { slug },
    select: {
      id: true,
      organizerId: true,
      faqEnabled: true,
      faqs: { orderBy: { order: 'asc' } },
    },
  })
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (includeAll) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || event.organizerId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ enabled: event.faqEnabled, faqs: event.faqs })
  }

  if (!event.faqEnabled) return NextResponse.json({ enabled: false, faqs: [] })
  return NextResponse.json({ enabled: true, faqs: event.faqs })
}

// PUT /api/events/[slug]/faq — organiser only, saves FAQs
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { enabled, faqs } = body as {
    enabled: boolean
    faqs: { id?: string; question: string; answer: string; order: number }[]
  }

  if (Array.isArray(faqs) && faqs.length > 10) {
    return NextResponse.json({ error: 'Maximum 10 FAQ items allowed' }, { status: 400 })
  }

  const event = await prisma.event.findUnique({ where: { slug } })
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (event.organizerId !== session.user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.event.update({
    where: { id: event.id },
    data: { faqEnabled: enabled },
  })

  if (enabled && faqs?.length) {
    await prisma.eventFAQ.deleteMany({ where: { eventId: event.id } })
    await prisma.eventFAQ.createMany({
      data: faqs
        .filter((f) => f.question?.trim() && f.answer?.trim())
        .map((f, i) => ({
          eventId: event.id,
          question: f.question.trim(),
          answer: f.answer.trim(),
          order: i,
        })),
    })
  }

  return NextResponse.json({ ok: true })
}
