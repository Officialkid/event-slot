/** @jest-environment node */

import { generateEventReport, EventReportData } from '@/lib/generateEventReport'
import { generateAIReportContent, buildFallbackReport } from '@/lib/generateAIReportContent'

jest.mock('@/lib/ai', () => ({
  askAI: jest.fn().mockResolvedValue(null),
}))

describe('EventSlot AI Event Intelligence Engine', () => {
  it('strictly adheres to the "know what it does not know" principle for untracked metrics', () => {
    const fallback = buildFallbackReport({
      event: {
        title: 'Tech Meetup Kenya',
        slug: 'tech-meetup-ke',
        organizerEmail: 'host@eventslot.co',
        confirmedCount: 4,
        waitlistCount: 0,
        capacity: 4,
        eventDate: '2026-11-20T09:00:00.000Z',
        location: 'iHub Nairobi',
        deadline: '2026-11-19T18:00:00.000Z',
        createdAt: '2026-11-01T08:00:00.000Z',
        questions: [],
      },
      confirmed: [
        { id: '1', answers: [{ questionId: 'name', value: 'Alice' }], submittedAt: '2026-11-02T10:00:00.000Z' },
        { id: '2', answers: [{ questionId: 'name', value: 'Bob' }], submittedAt: '2026-11-02T11:00:00.000Z' },
        { id: '3', answers: [{ questionId: 'name', value: 'Charlie' }], submittedAt: '2026-11-03T10:00:00.000Z' },
        { id: '4', answers: [{ questionId: 'name', value: 'David' }], submittedAt: '2026-11-03T11:00:00.000Z' },
      ],
      waitlist: [],
      viewsTracked: false, // Views not tracked
      checkInDataAvailable: false, // Check-in data unrecorded
      attributionTracked: false, // Attribution untracked
    })

    // Funnel must state page view tracking was inactive
    expect(fallback.funnelAnalysis).toContain('Page view tracking was not active for this event')
    // Attribution must state untracked
    expect(fallback.attributionAnalysis).toContain('Campaign attribution was not configured for this event')
    // Attendance must state unrecorded
    expect(fallback.attendanceAnalysis).toContain('Attendance performance cannot be calculated because gate check-in data was not recorded')
    // Recommendations must be concrete
    expect(fallback.actionableRecommendations.length).toBeGreaterThanOrEqual(3)
  })

  it('generates a valid DOCX report buffer with EventSlot AI Event Intelligence layout', async () => {
    const reportData: EventReportData = {
      title: 'DevFest Nairobi 2026',
      slug: 'devfest-nairobi-2026',
      organizerEmail: 'organizer@devfest.ke',
      organizerName: 'DevFest Team',
      eventDate: new Date('2026-11-25T08:00:00Z'),
      location: 'Sarit Expo Centre, Nairobi',
      registrationOpenDate: new Date('2026-10-01T08:00:00Z'),
      registrationDeadline: new Date('2026-11-24T23:59:00Z'),
      capacity: 500,
      totalRegistrations: 420,
      confirmedCount: 390,
      waitlistCount: 30,
      totalPageViews: 1250,
      viewsTracked: true,
      conversionRate: 33.6,
      checkedInCount: 352,
      checkInDataAvailable: true,
      turnoutRate: 90.3,
      noShowCount: 38,
      noShowRate: 9.7,
      sourceBreakdown: [
        { source: 'WhatsApp', count: 210, percentage: 50.0 },
        { source: 'Instagram', count: 105, percentage: 25.0 },
        { source: 'Direct Link', count: 105, percentage: 25.0 },
      ],
      attributionTracked: true,
      attendees: [
        { name: 'Attendee One', registrationNumber: 1, registeredAt: new Date() },
        { name: 'Attendee Two', registrationNumber: 2, registeredAt: new Date() },
      ],
      waitlist: [
        { name: 'Waitlist One', position: 1, joinedAt: new Date() },
      ],
      dailyRegistrationCounts: [
        { date: '1 Oct', count: 50 },
        { date: '15 Oct', count: 120 },
        { date: '1 Nov', count: 250 },
      ],
      peakDate: '1 Nov',
      peakDayCount: 250,
      theme: 'eventslot',
    }

    const buffer = await generateEventReport(reportData)
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(10000)
  }, 25000)
  it('generates a clean operational report when EventSlot Intelligence is disabled (production mode)', async () => {
    const reportData: EventReportData = {
      title: 'DevFest Nairobi 2026',
      slug: 'devfest-nairobi-2026',
      organizerEmail: 'organizer@devfest.ke',
      organizerName: 'DevFest Team',
      eventDate: new Date('2026-11-25T08:00:00Z'),
      location: 'Sarit Expo Centre, Nairobi',
      registrationOpenDate: new Date('2026-10-01T08:00:00Z'),
      registrationDeadline: new Date('2026-11-24T23:59:00Z'),
      capacity: 500,
      totalRegistrations: 420,
      confirmedCount: 390,
      waitlistCount: 30,
      dailyRegistrationCounts: [{ date: '1 Nov', count: 250 }],
      peakDate: '1 Nov',
      peakDayCount: 250,
      attendees: [{ name: 'Attendee One', registrationNumber: 1, registeredAt: new Date() }],
      waitlist: [],
      enableIntelligence: false,
    }

    const buffer = await generateEventReport(reportData)
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(5000)
  }, 25000)
});
