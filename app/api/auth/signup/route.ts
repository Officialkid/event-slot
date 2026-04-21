import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { sendWelcomeEmail } from '@/lib/email'
import { signupRatelimit } from '@/lib/ratelimit'

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

    const { name, email, password, consentSystemEmails } = await req.json()

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required.' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 400 })
    }

    const hashed = await bcrypt.hash(password, 12)
    const newUser = await prisma.user.create({
      data: { name, email, password: hashed, consentSystemEmails: consentSystemEmails === true },
      select: { id: true },
    })

    await prisma.userOnboarding.create({
      data: { userId: newUser.id },
    })

    // Fire-and-forget welcome email — don't block the response
    sendWelcomeEmail({ to: email, name }).catch(() => {})

    return NextResponse.json({ success: true }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
