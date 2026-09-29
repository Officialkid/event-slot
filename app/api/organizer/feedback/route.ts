import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'

const VALID_TYPES = ['complaint', 'compliment', 'suggestion', 'general'] as const

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { type, subject, message, rating } = body

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Invalid feedback type' }, { status: 400 })
    }
    if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 })
    }
    if (subject.trim().length > 100) {
      return NextResponse.json({ error: 'Subject must be 100 characters or fewer' }, { status: 400 })
    }
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }
    if (message.trim().length > 2000) {
      return NextResponse.json({ error: 'Message must be 2000 characters or fewer' }, { status: 400 })
    }
    let parsedRating: number | null = null
    if (rating !== undefined && rating !== null) {
      const r = Number(rating)
      if (!Number.isInteger(r) || r < 1 || r > 5) {
        return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
      }
      parsedRating = r
    }

    const feedback = await prisma.organizerFeedback.create({
      data: {
        organizerId: session.user.id,
        type: type.trim(),
        subject: subject.trim(),
        message: message.trim(),
        rating: parsedRating,
      },
    })

    // If rating is <= 3, send alert email to eventslot.co@gmail.com
    if (parsedRating !== null && parsedRating <= 3) {
      try {
        const organizer = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { name: true, email: true },
        })
        const orgName = organizer?.name || 'Organizer'
        const orgEmail = organizer?.email || session.user.email || 'No email'

        await sendEmail({
          to: 'eventslot.co@gmail.com',
          subject: `⚠️ Urgent Organizer Feedback Alert (${parsedRating}★): ${subject.trim()}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #fee2e2; border-radius: 12px; background: #ffffff;">
              <h2 style="color: #dc2626; margin-top: 0; font-size: 1.25rem;">⚠️ Urgent Organizer Feedback Alert (${parsedRating} / 5 Stars)</h2>
              <p style="color: #4b5563; font-size: 0.95rem; line-height: 1.5;">An organizer reported challenges or rated an event with <strong>${parsedRating} out of 5 stars</strong>.</p>
              <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 14px 16px; border-radius: 8px; margin: 16px 0;">
                <p style="margin: 0 0 6px; font-size: 0.85rem; color: #991b1b;"><strong>Organizer:</strong> ${orgName} (${orgEmail})</p>
                <p style="margin: 0 0 6px; font-size: 0.85rem; color: #991b1b;"><strong>Subject:</strong> ${subject.trim()}</p>
                <p style="margin: 0 0 6px; font-size: 0.85rem; color: #991b1b;"><strong>Category:</strong> ${type.trim()}</p>
                <p style="margin: 0; font-size: 0.85rem; color: #991b1b;"><strong>Rating:</strong> ${'★'.repeat(parsedRating)}${'☆'.repeat(5 - parsedRating)} (${parsedRating}/5)</p>
              </div>
              <div style="background: #f9fafb; padding: 14px 16px; border-radius: 8px; border-left: 4px solid #dc2626;">
                <p style="margin: 0 0 6px; font-size: 0.85rem; font-weight: bold; color: #374151;">Feedback & Challenges Reported:</p>
                <p style="margin: 0; font-size: 0.9rem; white-space: pre-wrap; color: #111827; line-height: 1.6;">${message.trim()}</p>
              </div>
              <p style="margin-top: 20px; font-size: 0.75rem; color: #9ca3af;">Delivered automatically by EventSlot Operational Alert Engine</p>
            </div>
          `,
        })
      } catch (emailErr) {
        console.error('[POST /api/organizer/feedback] Failed to send low rating alert email:', emailErr)
      }
    }

    return NextResponse.json({ success: true, id: feedback.id }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/organizer/feedback]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)

    // Check for pending post-event feedback prompt (Google Meet style)
    if (searchParams.get('prompt') === 'true') {
      const now = new Date()
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

      const pastEvents = await prisma.event.findMany({
        where: {
          organizerId: session.user.id,
          OR: [
            { eventEndAt: { lte: now, gte: fourteenDaysAgo } },
            { eventEndAt: null, eventDate: { lte: new Date(now.getTime() - 3 * 60 * 60 * 1000), gte: fourteenDaysAgo } },
          ],
        },
        orderBy: { eventDate: 'desc' },
        take: 5,
        select: { id: true, title: true, slug: true, eventDate: true, eventEndAt: true },
      })

      if (pastEvents.length === 0) {
        return NextResponse.json({ pendingEvent: null })
      }

      const subjects = pastEvents.map(e => `Post-Event Review: ${e.title}`)
      const existing = await prisma.organizerFeedback.findMany({
        where: {
          organizerId: session.user.id,
          subject: { in: subjects },
        },
        select: { subject: true },
      })
      const reviewedSubjects = new Set(existing.map(f => f.subject))
      const unreviewed = pastEvents.find(e => !reviewedSubjects.has(`Post-Event Review: ${e.title}`))

      return NextResponse.json({ pendingEvent: unreviewed ?? null })
    }
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = 20
    const skip = (page - 1) * limit

    const [items, total] = await Promise.all([
      prisma.organizerFeedback.findMany({
        where: { organizerId: session.user.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
        select: {
          id: true,
          type: true,
          subject: true,
          rating: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.organizerFeedback.count({ where: { organizerId: session.user.id } }),
    ])

    return NextResponse.json({ items, total, page, pages: Math.ceil(total / limit) })
  } catch (err) {
    console.error('[GET /api/organizer/feedback]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
