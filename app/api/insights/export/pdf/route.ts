import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { jsPDF } from 'jspdf'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type InsightsRange = '30d' | '90d' | '1y' | 'all'

function getStartDate(range: InsightsRange): Date | undefined {
  const now = Date.now()
  if (range === '30d') return new Date(now - 30 * 86_400_000)
  if (range === '90d') return new Date(now - 90 * 86_400_000)
  if (range === '1y') return new Date(now - 365 * 86_400_000)
  return undefined
}

function isPIIQuestion(label: string): boolean {
  const normalized = label.trim().toLowerCase()
  const piiPatterns = [
    /\b(full\s*)?name\b/i,
    /\blovely\s*name\b/i,
    /\bfirst\s*name\b/i,
    /\blast\s*name\b/i,
    /\bsir\s*name\b/i,
    /\bsurname\b/i,
    /\bphone(\s*number)?\b/i,
    /\bcontact(\s*number)?\b/i,
    /\bmobile(\s*number)?\b/i,
    /\btel(ephone)?\b/i,
    /\bwhatsapp\b/i,
    /\bemail(\s*address)?\b/i,
    /\bid\s*number\b/i,
    /\bnational\s*id\b/i,
    /\bpassport\b/i,
  ]
  return piiPatterns.some(pattern => pattern.test(normalized))
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rangeParam = req.nextUrl.searchParams.get('range')
    const range: InsightsRange =
      rangeParam === '30d' || rangeParam === '90d' || rangeParam === '1y' || rangeParam === 'all'
        ? rangeParam
        : '90d'
    const startDate = getStartDate(range)

    const [organizer, events] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, email: true },
      }),
      prisma.event.findMany({
        where: { organizerId: session.user.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          eventDate: true,
          questions: true,
          registrations: {
            where: startDate ? { submittedAt: { gte: startDate } } : undefined,
            select: {
              status: true,
              submittedAt: true,
              attendeeEmail: true,
              answers: true,
              ticket: { select: { scannedAt: true } },
            },
          },
          views: {
            where: startDate ? { viewedAt: { gte: startDate } } : undefined,
            select: { id: true },
          },
        },
      }),
    ])

    const totalEvents = events.length
    const allRegistrations = events.flatMap(e => e.registrations)
    const totalRegistrations = allRegistrations.length
    const totalConfirmed = allRegistrations.filter(r => r.status.toLowerCase() === 'confirmed').length
    const totalCheckedIn = allRegistrations.filter(r => r.ticket?.scannedAt).length

    // Generate PDF using jsPDF
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const marginX = 42
    let y = 44

    const eatDate = new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Africa/Nairobi',
    }).format(new Date())

    // Header
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(20, 20, 20)
    doc.text('EventSlot Insight Tracker Report', marginX, y)
    y += 18

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(110, 110, 110)
    doc.text(`Organizer: ${organizer?.name || organizer?.email || 'Organizer'}  |  Timeframe: ${range.toUpperCase()}  |  Exported: ${eatDate}`, marginX, y)
    y += 14

    doc.setDrawColor(220, 220, 220)
    doc.line(marginX, y, pageWidth - marginX, y)
    y += 20

    // Metric Summary Box
    doc.setFillColor(248, 249, 250)
    doc.roundedRect(marginX, y, pageWidth - marginX * 2, 60, 6, 6, 'F')
    doc.setDrawColor(230, 230, 230)
    doc.roundedRect(marginX, y, pageWidth - marginX * 2, 60, 6, 6, 'S')

    const boxWidth = (pageWidth - marginX * 2) / 4
    const metrics = [
      { label: 'EVENTS', value: totalEvents.toString() },
      { label: 'REGISTRATIONS', value: totalRegistrations.toString() },
      { label: 'CONFIRMED', value: totalConfirmed.toString() },
      { label: 'CHECKED IN', value: totalCheckedIn.toString() },
    ]

    metrics.forEach((m, idx) => {
      const colX = marginX + idx * boxWidth + 16
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(120, 120, 120)
      doc.text(m.label, colX, y + 22)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.setTextColor(20, 20, 20)
      doc.text(m.value, colX, y + 44)
    })
    y += 80

    // Section 1: Event Performance Breakdown
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(30, 30, 30)
    doc.text('Event Performance Breakdown', marginX, y)
    y += 16

    // Table Header
    doc.setFillColor(240, 242, 245)
    doc.rect(marginX, y, pageWidth - marginX * 2, 20, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(80, 80, 80)
    doc.text('EVENT TITLE', marginX + 8, y + 13)
    doc.text('DATE', marginX + 220, y + 13)
    doc.text('REGISTRATIONS', marginX + 310, y + 13)
    doc.text('CHECK-IN RATE', marginX + 410, y + 13)
    y += 24

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(40, 40, 40)

    events.slice(0, 15).forEach((ev) => {
      if (y > pageHeight - 60) {
        doc.addPage()
        y = 44
      }
      const title = ev.title.length > 34 ? ev.title.slice(0, 32) + '...' : ev.title
      const dateStr = ev.eventDate ? new Date(ev.eventDate).toLocaleDateString('en-GB') : 'TBD'
      const regCount = ev.registrations.length
      const checkedInCount = ev.registrations.filter(r => r.ticket?.scannedAt).length
      const checkInPct = regCount > 0 ? `${Math.round((checkedInCount / regCount) * 100)}%` : '-'

      doc.text(title, marginX + 8, y)
      doc.text(dateStr, marginX + 220, y)
      doc.text(regCount.toString(), marginX + 310, y)
      doc.text(checkInPct, marginX + 410, y)

      doc.setDrawColor(240, 240, 240)
      doc.line(marginX, y + 5, pageWidth - marginX, y + 5)
      y += 18
    })

    y += 16

    // Section 2: Audience Insights (Non-PII Questions)
    if (y > pageHeight - 120) {
      doc.addPage()
      y = 44
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(30, 30, 30)
    doc.text('Audience Insights & Demographics', marginX, y)
    y += 16

    // Aggregate answers for non-PII questions
    const questionAgg = new Map<string, Map<string, number>>()
    for (const ev of events) {
      const qList = (ev.questions ?? []) as Array<{ id: string; label: string }>
      for (const reg of ev.registrations) {
        const answers = (reg.answers ?? []) as Array<{ questionId: string; value: string }>
        for (const ans of answers) {
          const q = qList.find(item => item.id === ans.questionId)
          if (!q || !ans.value?.trim() || isPIIQuestion(q.label)) continue

          if (!questionAgg.has(q.label)) {
            questionAgg.set(q.label, new Map())
          }
          const valMap = questionAgg.get(q.label)!
          const key = ans.value.trim()
          valMap.set(key, (valMap.get(key) ?? 0) + 1)
        }
      }
    }

    if (questionAgg.size === 0) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(9)
      doc.setTextColor(130, 130, 130)
      doc.text('No custom demographic questions recorded for this timeframe.', marginX + 8, y)
      y += 20
    } else {
      Array.from(questionAgg.entries()).slice(0, 6).forEach(([label, counts]) => {
        if (y > pageHeight - 60) {
          doc.addPage()
          y = 44
        }
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(60, 60, 60)
        doc.text(label, marginX + 8, y)
        y += 14

        const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4)
        const totalQ = Array.from(counts.values()).reduce((a, b) => a + b, 0)

        sorted.forEach(([ansVal, cnt]) => {
          const pct = Math.round((cnt / totalQ) * 100)
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8.5)
          doc.setTextColor(90, 90, 90)
          doc.text(`• ${ansVal} : ${cnt} (${pct}%)`, marginX + 18, y)
          y += 12
        })
        y += 6
      })
    }

    // Footer
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(160, 160, 160)
    doc.text('Generated by EventSlot Analytics Engine - Confidential', marginX, pageHeight - 24)

    const pdfBuffer = doc.output('arraybuffer')
    const filename = `eventslot_insights_${range}_${Date.now()}.pdf`

    return new Response(Buffer.from(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('Insights PDF export error:', err)
    return NextResponse.json({ error: 'Failed to generate insights PDF report' }, { status: 500 })
  }
}
