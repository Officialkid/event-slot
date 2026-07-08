import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { detectCountry, getCountryName } from '@/lib/geoip'

const UNKNOWN_COUNTRY = 'UNKNOWN'

// Resolve the user's country from standard geo-IP headers.
// If the requesting user is logged in and has no signupCountry recorded yet,
// we persist it now - this covers Google OAuth users who bypass the email signup route.
export async function GET(req: NextRequest) {
  const countryCode = await detectCountry(req).catch(() => UNKNOWN_COUNTRY)
  const countryName = getCountryName(countryCode)
  const hasKnownCountry = countryCode !== UNKNOWN_COUNTRY

  // Persist for signed-in users (non-blocking, best-effort).
  // signupCountry keeps the first-seen country while countryCode/countryName can reflect later visits.
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.id) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { signupCountry: true, countryCode: true, countryName: true },
      })

      const updateData: { signupCountry?: string; countryCode?: string; countryName?: string } = {}
      if (hasKnownCountry && !user?.signupCountry) {
        updateData.signupCountry = countryCode
      }
      if (hasKnownCountry && (user?.countryCode !== countryCode || user?.countryName !== countryName)) {
        updateData.countryCode = countryCode
        updateData.countryName = countryName
      }

      if (Object.keys(updateData).length > 0) {
        prisma.user.update({
          where: { id: session.user.id },
          data: updateData,
        }).catch(() => {})
      }
    }
  } catch {
    // never block the response
  }

  return NextResponse.json({ countryCode })
}
