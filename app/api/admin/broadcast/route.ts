import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'
import { isAdminEmail } from '@/lib/isAdmin'

const EMAIL_FROM = process.env.RESEND_FROM?.trim() || ''
const BATCH_SIZE = 50
const BATCH_DELAY_MS = 500

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

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!isAdminEmail(session?.user?.email)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Get count of users who opted in for marketing emails
    const recipientCount = await prisma.user.count({
      where: { marketingConsent: true },
    })

    // Get sample recipients for preview
    const sampleRecipients = await prisma.user.findMany({
      where: { marketingConsent: true },
      select: { email: true, name: true },
      take: 5,
    })

    return NextResponse.json({
      recipientCount,
      sampleRecipients,
    })
  } catch (error) {
    console.error('Error fetching broadcast preview:', error)
    return NextResponse.json(
      { error: 'Failed to fetch preview' },
      { status: 500 }
    )
  }
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

    const { subject, html } = await req.json() as {
      subject: string
      html: string
    }

    if (!subject?.trim() || !html?.trim()) {
      return NextResponse.json({ error: 'Subject and HTML content are required.' }, { status: 400 })
    }

    // Get all users who opted in for marketing emails
    const recipients = await prisma.user.findMany({
      where: { marketingConsent: true },
      select: { id: true, email: true, name: true },
    })

    if (recipients.length === 0) {
      return NextResponse.json({
        ok: true,
        attempted: 0,
        accepted: 0,
        failed: 0,
        message: 'No recipients to send to.',
      })
    }

    const batches = chunk(recipients.filter((u): u is typeof u & { email: string } => !!u.email), BATCH_SIZE)
    let accepted = 0
    let failed = 0

    for (let i = 0; i < batches.length; i += 1) {
      const batch = batches[i]
      try {
        const response = await resend.batch.send(
          batch.map(user => ({
            from: EMAIL_FROM,
            to: user.email,
            subject: subject.trim(),
            html: html.trim(),
            headers: {
              'List-Unsubscribe': '<https://www.eventsslot.com/unsubscribe>',
            },
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
      } catch (batchError) {
        console.error('Error sending batch:', batchError)
        failed += batch.length
        await prisma.errorLog.create({
          data: {
            route: '/api/admin/broadcast',
            message: `Broadcast batch error: ${batchError instanceof Error ? batchError.message : 'unknown error'}`,
          },
        })
      }

      if (i < batches.length - 1) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS))
      }
    }

    // Log to audit log
    if (session?.user?.id) {
      await prisma.auditLog.create({
        data: {
          actorId: session.user.id,
          action: 'BROADCAST_EMAIL',
          metadata: {
            subject,
            recipientCount: recipients.length,
            sent: accepted,
            failed,
          },
        },
      })
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
