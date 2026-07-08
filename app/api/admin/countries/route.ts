import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { hasAdminAccess } from '@/lib/isAdmin'
import { getCountryFlag, getCountryName } from '@/lib/geoip'
import { COUNTRY_CURRENCY, DEFAULT_CURRENCY } from '@/lib/currency'

type LiveCountryRow = {
  countryCode: string
  userCount: bigint
  organizerCount: bigint
}

type EventCountryRow = {
  countryCode: string
  eventCount: bigint
}

type CountryPayload = {
  countryCode: string
  countryName: string
  userCount: number
  organizerCount: number
  eventCount: number
  growth7d: number
  flag: string
  currency: string
}

function normalizeCountryCode(code?: string | null): string | null {
  if (!code) return null
  const normalized = code.trim().toUpperCase()
  if (!normalized || normalized === 'UNKNOWN') return null
  return normalized
}

async function assertAdmin() {
  const session = await getServerSession(authOptions)
  if (!hasAdminAccess(session)) {
    return null
  }

  return session
}

async function getLiveCountryRows() {
  const [usersByCountry, eventsByCountry, totalAccounts] = await Promise.all([
    prisma.$queryRaw<LiveCountryRow[]>`
      SELECT
        COALESCE(NULLIF(COALESCE(u."signupCountry", u."countryCode"), ''), 'UNKNOWN') AS "countryCode",
        COUNT(*)::bigint AS "userCount",
        COUNT(*) FILTER (
          WHERE EXISTS (
            SELECT 1
            FROM "Event" e
            WHERE e."organizerId" = u."id"
          )
        )::bigint AS "organizerCount"
      FROM "User" u
      GROUP BY 1
    `,
    prisma.$queryRaw<EventCountryRow[]>`
      SELECT
        COALESCE(NULLIF("countryCode", ''), 'UNKNOWN') AS "countryCode",
        COUNT(*)::bigint AS "eventCount"
      FROM "Event"
      GROUP BY 1
    `,
    prisma.user.count(),
  ])

  const userMap = new Map(
    usersByCountry.map((row) => {
      const code = normalizeCountryCode(row.countryCode) ?? 'UNKNOWN'
      return [code, row]
    })
  )
  const eventMap = new Map(
    eventsByCountry.map((row) => {
      const code = normalizeCountryCode(row.countryCode) ?? 'UNKNOWN'
      return [code, Number(row.eventCount)]
    })
  )
  const codes = Array.from(new Set([...userMap.keys(), ...eventMap.keys()]))

  return {
    totalAccounts,
    rows: codes.map((code) => {
      const normalized = normalizeCountryCode(code) ?? 'UNKNOWN'
      const users = userMap.get(normalized)
      return {
        countryCode: normalized,
        countryName: getCountryName(normalized),
        userCount: Number(users?.userCount ?? 0),
        organizerCount: Number(users?.organizerCount ?? 0),
        eventCount: Number(eventMap.get(normalized) ?? 0),
      }
    }),
  }
}

async function getCountriesPayload() {
  const [{ rows: liveRows, totalAccounts }, previous] = await Promise.all([
    getLiveCountryRows(),
    prisma.countrySnapshot.findMany({
      where: {
        snapshotDate: {
          lte: new Date(Date.now() - 7 * 86_400_000),
        },
      },
      orderBy: [{ countryCode: 'asc' }, { snapshotDate: 'desc' }],
      distinct: ['countryCode'],
    }),
  ])

  const previousMap = new Map(previous.map((row) => [row.countryCode, row]))
  const countries = liveRows
    .map<CountryPayload>((row) => {
      const previousRow = previousMap.get(row.countryCode)
      const growth7d = previousRow
        ? Math.round(((row.userCount - previousRow.userCount) / (previousRow.userCount || 1)) * 100)
        : 0

      return {
        ...row,
        growth7d,
        flag: getCountryFlag(row.countryCode),
        currency: (COUNTRY_CURRENCY[row.countryCode as keyof typeof COUNTRY_CURRENCY] ?? DEFAULT_CURRENCY).code,
      }
    })
    .sort((a, b) => {
      if (a.countryCode === 'UNKNOWN') return 1
      if (b.countryCode === 'UNKNOWN') return -1
      return b.userCount - a.userCount
    })

  const knownCountries = countries.filter((country) => country.countryCode !== 'UNKNOWN')
  const trackedUsers = knownCountries.reduce((sum, country) => sum + country.userCount, 0)
  const unknownUsers = Math.max(totalAccounts - trackedUsers, 0)

  const recommendations: string[] = []
  for (const country of knownCountries.slice(0, 10)) {
    if (country.countryCode === 'NG' && country.userCount >= 100) {
      recommendations.push(`Nigeria has ${country.userCount} users - add NGN pricing and bank transfer via Paystack.`)
    }
    if (country.countryCode === 'GH' && country.userCount >= 50) {
      recommendations.push('Ghana is growing - MTN Mobile Money would unlock faster conversion.')
    }
    if (country.growth7d > 20) {
      recommendations.push(`${country.countryName} grew ${country.growth7d}% this week - consider a targeted launch campaign.`)
    }
    if (country.userCount > 20 && (country.organizerCount / country.userCount) < 0.1) {
      recommendations.push(
        `${country.countryName}: low organiser rate (${Math.round((country.organizerCount / country.userCount) * 100)}%) - add country-specific onboarding.`
      )
    }
  }

  if (unknownUsers > 0) {
    recommendations.unshift(
      `${unknownUsers} users still have no reliable country on file - run the backfill, then let returning users refresh their sessions to improve coverage.`
    )
  }

  return {
    countries,
    totalCountries: knownCountries.length,
    totalUsers: totalAccounts,
    trackedUsers,
    unknownUsers,
    coveragePercent: totalAccounts > 0 ? Math.round((trackedUsers / totalAccounts) * 100) : 0,
    topCountry: knownCountries[0] ?? null,
    fastestGrowing: [...knownCountries].sort((a, b) => b.growth7d - a.growth7d)[0] ?? null,
    recommendations,
  }
}

async function syncTodayCountrySnapshot() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { rows } = await getLiveCountryRows()
  const knownRows = rows.filter((row) => row.countryCode !== 'UNKNOWN')

  await prisma.$transaction(
    knownRows.map((row) =>
      prisma.countrySnapshot.upsert({
        where: {
          countryCode_snapshotDate: {
            countryCode: row.countryCode,
            snapshotDate: today,
          },
        },
        update: {
          countryName: row.countryName,
          userCount: row.userCount,
          organizerCount: row.organizerCount,
          eventCount: row.eventCount,
        },
        create: {
          countryCode: row.countryCode,
          countryName: row.countryName,
          userCount: row.userCount,
          organizerCount: row.organizerCount,
          eventCount: row.eventCount,
          snapshotDate: today,
        },
      })
    )
  )
}

export async function GET() {
  const session = await assertAdmin()
  if (!session) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    return NextResponse.json(await getCountriesPayload())
  } catch (err) {
    console.error('[admin/countries] GET error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST() {
  const session = await assertAdmin()
  if (!session) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const [users, organizerEvents, attendeeRegistrations] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          email: true,
          signupCountry: true,
          countryCode: true,
          countryName: true,
        },
      }),
      prisma.event.findMany({
        where: {
          organizerId: { not: null },
          countryCode: { not: null },
        },
        select: {
          organizerId: true,
          countryCode: true,
        },
      }),
      prisma.registration.findMany({
        where: {
          attendeeEmail: { not: null },
          countryCode: { not: null },
        },
        select: {
          attendeeEmail: true,
          countryCode: true,
        },
      }),
    ])

    const organizerCountryMap = new Map<string, Set<string>>()
    for (const event of organizerEvents) {
      const organizerId = event.organizerId
      const countryCode = normalizeCountryCode(event.countryCode)
      if (!organizerId || !countryCode) continue

      const countrySet = organizerCountryMap.get(organizerId) ?? new Set<string>()
      countrySet.add(countryCode)
      organizerCountryMap.set(organizerId, countrySet)
    }

    const attendeeCountryMap = new Map<string, Set<string>>()
    for (const registration of attendeeRegistrations) {
      const attendeeEmail = registration.attendeeEmail?.trim().toLowerCase()
      const countryCode = normalizeCountryCode(registration.countryCode)
      if (!attendeeEmail || !countryCode) continue

      const countrySet = attendeeCountryMap.get(attendeeEmail) ?? new Set<string>()
      countrySet.add(countryCode)
      attendeeCountryMap.set(attendeeEmail, countrySet)
    }

    let filledSignupFromExisting = 0
    let filledCurrentFromExisting = 0
    let namedFromExisting = 0
    let inferredFromOrganizerEvents = 0
    let inferredFromAttendeeRegistrations = 0

    const updates = users.flatMap((user) => {
      const signupCountry = normalizeCountryCode(user.signupCountry)
      const currentCountry = normalizeCountryCode(user.countryCode)
      const organizerCountries = organizerCountryMap.get(user.id)
      const attendeeCountries = user.email ? attendeeCountryMap.get(user.email.trim().toLowerCase()) : null
      const inferredCountry =
        organizerCountries && organizerCountries.size === 1
          ? Array.from(organizerCountries)[0]
          : attendeeCountries && attendeeCountries.size === 1
            ? Array.from(attendeeCountries)[0]
            : null

      const sourceCountry = signupCountry ?? currentCountry ?? inferredCountry
      if (!sourceCountry) {
        return []
      }

      const updateData: {
        signupCountry?: string
        countryCode?: string
        countryName?: string
      } = {}

      if (!signupCountry) {
        updateData.signupCountry = sourceCountry
        if (currentCountry || user.countryCode === 'UNKNOWN') {
          filledSignupFromExisting += 1
        } else if (organizerCountries && organizerCountries.size === 1) {
          inferredFromOrganizerEvents += 1
        } else if (attendeeCountries && attendeeCountries.size === 1) {
          inferredFromAttendeeRegistrations += 1
        }
      }

      if (!currentCountry && sourceCountry) {
        updateData.countryCode = sourceCountry
        updateData.countryName = getCountryName(sourceCountry)
        filledCurrentFromExisting += 1
      }

      const resolvedCurrentCountry = currentCountry ?? sourceCountry
      const resolvedCountryName = getCountryName(resolvedCurrentCountry)
      if (!user.countryName || user.countryName === 'UNKNOWN') {
        updateData.countryName = resolvedCountryName
        namedFromExisting += 1
      }

      if (Object.keys(updateData).length === 0) {
        return []
      }

      return prisma.user.update({
        where: { id: user.id },
        data: updateData,
      })
    })

    if (updates.length > 0) {
      await prisma.$transaction(updates)
    }

    await syncTodayCountrySnapshot()

    return NextResponse.json({
      ok: true,
      updatedUsers: updates.length,
      filledSignupFromExisting,
      filledCurrentFromExisting,
      namedFromExisting,
      inferredFromOrganizerEvents,
      inferredFromAttendeeRegistrations,
      message: 'Country coverage backfill completed.',
    })
  } catch (err) {
    console.error('[admin/countries] POST error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
