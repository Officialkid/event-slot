// Daily country snapshot cron — Cloud Scheduler: 0 0 * * * UTC
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCountryName } from '@/lib/geoip'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [usersByCountry, organisersByCountry, eventsByCountry] = await Promise.all([
      prisma.user.groupBy({
        by: ['signupCountry'],
        _count: { id: true },
        where: { signupCountry: { not: null } },
      }),
      prisma.user.groupBy({
        by: ['signupCountry'],
        _count: { id: true },
        where: { signupCountry: { not: null }, events: { some: {} } },
      }),
      prisma.event.groupBy({
        by: ['countryCode'],
        _count: { id: true },
        where: { countryCode: { not: null } },
      }),
    ])

    const orgMap = Object.fromEntries(organisersByCountry.map(r => [r.signupCountry, r._count.id]))
    const evtMap = Object.fromEntries(eventsByCountry.map(r => [r.countryCode, r._count.id]))

    for (const row of usersByCountry) {
      const code = row.signupCountry!
      await prisma.countrySnapshot.upsert({
        where: { countryCode_snapshotDate: { countryCode: code, snapshotDate: today } },
        update: {
          userCount: row._count.id,
          organizerCount: orgMap[code] ?? 0,
          eventCount: evtMap[code] ?? 0,
        },
        create: {
          countryCode: code,
          countryName: getCountryName(code),
          userCount: row._count.id,
          organizerCount: orgMap[code] ?? 0,
          eventCount: evtMap[code] ?? 0,
          snapshotDate: today,
        },
      })
    }

    return NextResponse.json({ ok: true, processed: usersByCountry.length })
  } catch (err) {
    console.error('[country-snapshot] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
