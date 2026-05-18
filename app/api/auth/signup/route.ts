import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { sendWelcomeEmail } from '@/lib/email'
import { signupRatelimit } from '@/lib/ratelimit'
import { checkAndAwardPioneerBadge, processSignupReferral } from '@/lib/referral'

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

    const { name, email, password, consentSystemEmails, marketingConsent } = await req.json()

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required.' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
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
      data: { name, email, password: hashed, consentSystemEmails: consentSystemEmails === true, marketingConsent: marketingConsent === true },
      select: { id: true },
    })

    await prisma.userOnboarding.create({
      data: { userId: newUser.id },
    })

    const cookieStore = await cookies()
    const referralCode = cookieStore.get('eventslot_ref')?.value

    if (referralCode) {
      await processSignupReferral(newUser.id, referralCode)
      cookieStore.delete('eventslot_ref')
    }

    await checkAndAwardPioneerBadge(newUser.id)

    // Fire-and-forget welcome email — don't block the response
    sendWelcomeEmail({ to: email, name }).catch(() => {})

    return NextResponse.json({ success: true }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
