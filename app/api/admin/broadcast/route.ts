import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { Resend } from 'resend'
import { isAdminEmail } from '@/lib/isAdmin'

const EMAIL_FROM = process.env.RESEND_FROM?.trim() || ''

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured')
  }
  return new Resend(apiKey)
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function buildBroadcastEmail(name: string | null | undefined, body: string) {
  const greeting = name ? `Hi ${name},` : 'Hi there,'
  const safeBody = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')

  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:2rem;background:#0A0A0A;color:#F0EDE6">
      <div style="color:#C8F55A;font-size:0.95rem;font-weight:600;margin-bottom:1.75rem">EventSlot</div>
      <p style="color:rgba(240,237,230,0.75);font-size:0.95rem;font-weight:500;margin:0 0 1rem">${greeting}</p>
      <p style="color:rgba(240,237,230,0.65);font-size:0.9rem;line-height:1.65;margin:0">${safeBody}</p>
      <p style="margin-top:2.5rem;color:rgba(240,237,230,0.25);font-size:0.7rem;border-top:0.5px solid rgba(240,237,230,0.07);padding-top:1rem">
        You received this message because you have an EventSlot account.
        © ${new Date().getFullYear()} EventSlot.
      </p>
    </div>
  `
}

export async function POST(req: NextRequest) {
  try {
    if (!EMAIL_FROM) {
      return NextResponse.json(
        { error: 'Email sender is not configured. Set RESEND_FROM to a verified sender address.' },
        { status: 400 }
      )
    }

    const resend = getResendClient()

    const session = await getServerSession(authOptions)
    if (!isAdminEmail(session?.user?.email)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { plans, subject, body } = await req.json() as {
      plans: string[]
      subject: string
      body: string
    }

    if (!subject?.trim() || !body?.trim()) {
      return NextResponse.json({ error: 'Subject and body are required.' }, { status: 400 })
    }

    const isAll = plans.includes('all') || !plans.length

    const users = await prisma.user.findMany({
      where: {
        email: { not: null },
        suspended: false,
        ...(isAll ? {} : { plan: { in: plans } }),
      },
      select: { id: true, email: true, name: true },
    })

    const recipients = users.filter((u): u is typeof u & { email: string } => !!u.email)

    const batches = chunk(recipients, 50)
    let accepted = 0
    let failed = 0

    for (let i = 0; i < batches.length; i += 1) {
      const batch = batches[i]
      const response = await resend.batch.send(
        batch.map(user => ({
          from: EMAIL_FROM,
          to: user.email,
          subject: subject.trim(),
          html: buildBroadcastEmail(user.name, body.trim()),
        }))
      )

      if (response.error) {
        failed += batch.length
        await prisma.errorLog.create({
          data: {
            route: '/api/admin/broadcast',
            message: `Resend batch error: ${response.error.message ?? 'unknown error'} (batch size: ${batch.length})`,
          },
        })
      } else {
        const rawData = (response as unknown as { data?: unknown }).data
        const responseData = Array.isArray(rawData)
          ? (rawData as Array<{ id?: string; error?: unknown }>)
          : Array.isArray((rawData as { data?: unknown })?.data)
          ? ((rawData as { data: Array<{ id?: string; error?: unknown }> }).data)
          : []
        const acceptedInBatch = responseData.filter(item => item?.id && !item?.error).length
        const fallbackAccepted = responseData.length === 0 ? batch.length : acceptedInBatch
        accepted += fallbackAccepted
        failed += Math.max(batch.length - fallbackAccepted, 0)
      }

      if (i < batches.length - 1) {
        await new Promise(r => setTimeout(r, 1000))
      }
    }

    return NextResponse.json({
      ok: true,
      attempted: recipients.length,
      accepted,
      failed,
      sender: EMAIL_FROM,
    })
  } catch (err) {
    console.error('[admin/broadcast] POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
