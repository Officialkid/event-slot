import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { isAdminEmail } from '@/lib/isAdmin'
import { getCountryFlag, getCountryName } from '@/lib/geoip'
import { COUNTRY_CURRENCY, DEFAULT_CURRENCY } from '@/lib/currency'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    // Latest snapshot per country (PostgreSQL DISTINCT ON)
    const latest = await prisma.$queryRaw<Array<{
      countryCode: string
      countryName: string
      userCount: number
      organizerCount: number
      eventCount: number
    }>>`
      SELECT DISTINCT ON ("countryCode")
        "countryCode", "countryName", "userCount", "organizerCount", "eventCount"
      FROM "CountrySnapshot"
      ORDER BY "countryCode", "snapshotDate" DESC
    `

    // 7-day-ago snapshots for growth calculation
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000)
    const previous = await prisma.countrySnapshot.findMany({
      where: { snapshotDate: { lte: sevenDaysAgo } },
      orderBy: [{ countryCode: 'asc' }, { snapshotDate: 'desc' }],
      distinct: ['countryCode'],
    })
    const prevMap = Object.fromEntries(previous.map(p => [p.countryCode, p]))

    // If cron snapshots are empty (e.g. before first daily run), build a live view from existing users/events.
    if (latest.length === 0) {
      const [usersByCountry, eventsByCountry] = await Promise.all([
        prisma.$queryRaw<Array<{ countryCode: string; userCount: bigint; organizerCount: bigint }>>`
          SELECT
            COALESCE(u."signupCountry", u."countryCode") AS "countryCode",
            COUNT(*)::bigint AS "userCount",
            COUNT(*) FILTER (
              WHERE EXISTS (
                SELECT 1
                FROM "Event" e
                WHERE e."organizerId" = u."id"
              )
            )::bigint AS "organizerCount"
          FROM "User" u
          WHERE COALESCE(u."signupCountry", u."countryCode") IS NOT NULL
          GROUP BY COALESCE(u."signupCountry", u."countryCode")
        `,
        prisma.$queryRaw<Array<{ countryCode: string; eventCount: bigint }>>`
          SELECT "countryCode", COUNT(*)::bigint AS "eventCount"
          FROM "Event"
          WHERE "countryCode" IS NOT NULL
          GROUP BY "countryCode"
        `,
      ])

      const userMap = Object.fromEntries(usersByCountry.map(r => [r.countryCode, r]))
      const eventMap = Object.fromEntries(eventsByCountry.map(r => [r.countryCode, Number(r.eventCount)]))
      const codes = Array.from(new Set([...Object.keys(userMap), ...Object.keys(eventMap)]))

      latest.push(
        ...codes.map(code => ({
          countryCode: code,
          countryName: getCountryName(code),
          userCount: Number(userMap[code]?.userCount ?? 0),
          organizerCount: Number(userMap[code]?.organizerCount ?? 0),
          eventCount: Number(eventMap[code] ?? 0),
        }))
      )
    }

    const countries = latest.map(c => {
      const prev = prevMap[c.countryCode]
      const growth7d = prev
        ? Math.round(((Number(c.userCount) - prev.userCount) / (prev.userCount || 1)) * 100)
        : 0
      return {
        ...c,
        userCount: Number(c.userCount),
        organizerCount: Number(c.organizerCount),
        eventCount: Number(c.eventCount),
        growth7d,
        flag: getCountryFlag(c.countryCode),
        currency: (COUNTRY_CURRENCY[c.countryCode as keyof typeof COUNTRY_CURRENCY] ?? DEFAULT_CURRENCY).code,
      }
    }).sort((a, b) => b.userCount - a.userCount)

    const recommendations: string[] = []
    for (const c of countries.slice(0, 10)) {
      if (c.countryCode === 'NG' && c.userCount >= 100)
        recommendations.push(`Nigeria has ${c.userCount} users — add NGN pricing and bank transfer via Paystack.`)
      if (c.countryCode === 'GH' && c.userCount >= 50)
        recommendations.push(`Ghana growing — MTN Mobile Money would unlock faster conversion.`)
      if (c.growth7d > 20)
        recommendations.push(`${c.countryName} grew ${c.growth7d}% this week — consider a targeted launch campaign.`)
      if (c.userCount > 20 && (c.organizerCount / c.userCount) < 0.1)
        recommendations.push(`${c.countryName}: low organiser rate (${Math.round((c.organizerCount / c.userCount) * 100)}%) — add country-specific onboarding.`)
    }

    return NextResponse.json({
      countries,
      totalCountries: countries.length,
      totalUsers: countries.reduce((s, c) => s + c.userCount, 0),
      topCountry: countries[0] ?? null,
      fastestGrowing: [...countries].sort((a, b) => b.growth7d - a.growth7d)[0] ?? null,
      recommendations,
    })
  } catch (err) {
    console.error('[admin/countries] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
