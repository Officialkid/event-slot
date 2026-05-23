import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { detectCountry, getCountryName } from '@/lib/geoip'

// Resolve the user's country from standard geo-IP headers.
// If the requesting user is logged in and has no signupCountry recorded yet,
// we persist it now — this covers Google OAuth users who bypass the email signup route.
export async function GET(req: NextRequest) {
  const countryCode = await detectCountry(req).catch(() => 'US')

  // Persist for OAuth users (non-blocking, best-effort)
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.id) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { signupCountry: true },
      })
      if (!user?.signupCountry) {
        const countryName = getCountryName(countryCode)
        prisma.user.update({
          where: { id: session.user.id },
          data: { signupCountry: countryCode, countryCode, countryName },
        }).catch(() => {})
      }
    }
  } catch {
    // never block the response
  }

  return NextResponse.json({ countryCode })
}
