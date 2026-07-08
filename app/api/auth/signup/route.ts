import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { sendWelcomeEmail } from '@/lib/email'
import { signupRatelimit } from '@/lib/ratelimit'
import { checkAndAwardPioneerBadge, processSignupReferral } from '@/lib/referral'
import { detectCountry, getCountryName } from '@/lib/geoip'

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1'
    const { success } = await signupRatelimit.limit(`signup:${ip}`)
    if (!success) {
      return NextResponse.json(
        { error: 'Too many signup attempts. Please try again later.' },
        { status: 429 }
      )
    }

    const { name, email, password, privacyAccepted } = await req.json()

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required.' }, { status: 400 })
    }

    if (String(password).length < 8) {
      return NextResponse.json(
        {
          error: 'Password must be at least 8 characters.',
          code: 'WEAK_PASSWORD',
        },
        { status: 400 }
      )
    }

    if (!privacyAccepted) {
      return NextResponse.json(
        {
          error: 'You must accept the Privacy Policy to create an account',
          code: 'PRIVACY_NOT_ACCEPTED',
        },
        { status: 400 }
      )
    }

    const normalizedEmail = email.trim().toLowerCase()
    const existing = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    })
    if (existing) {
      const googleAccount = await prisma.account.findFirst({
        where: { userId: existing.id, provider: 'google' },
      })

      if (googleAccount) {
        return NextResponse.json(
          {
            error: 'This email is already linked to Google Sign-In. Please continue with Google, or use Forgot password to set a password for this account.',
            code: 'USE_GOOGLE_AUTH',
          },
          { status: 409 }
        )
      }

      return NextResponse.json(
        {
          error: 'An account with this email already exists. Please sign in or reset your password.',
          code: 'EMAIL_EXISTS',
        },
        { status: 409 }
      )
    }

    const hashed = await bcrypt.hash(password, 12)
    const newUser = await prisma.user.create({
      data: {
        name: String(name).trim(),
        email: normalizedEmail,
        password: hashed,
        consentSystemEmails: true,
        marketingConsent: true,
        otpRequired: true,
      },
      select: { id: true },
    })

    await prisma.userOnboarding.create({
      data: { userId: newUser.id },
    })

    // Detect and persist signup country (fire-and-forget, non-critical)
    detectCountry(req).then(code => {
      const name = getCountryName(code)
      prisma.user.update({
        where: { id: newUser.id },
        data: { signupCountry: code, countryCode: code, countryName: name },
      }).catch(() => {})
    }).catch(() => {})

    const cookieStore = await cookies()
    const referralCode = cookieStore.get('eventslot_ref')?.value

    if (referralCode) {
      await processSignupReferral(newUser.id, referralCode)
      cookieStore.delete('eventslot_ref')
    }

    await checkAndAwardPioneerBadge(newUser.id)

    // Fire-and-forget welcome email — don't block the response
    sendWelcomeEmail({ to: normalizedEmail, name: String(name).trim() }).catch(() => {})

    return NextResponse.json({ success: true }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
