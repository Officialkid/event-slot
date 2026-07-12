import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasAdminAccess } from '@/lib/isAdmin'
import prisma from '@/lib/prisma'
import { decrypt, encrypt } from '@/lib/encrypt'

function hasValidEncryptionKey(): boolean {
  const key = process.env.ENCRYPTION_KEY
  return typeof key === 'string' && /^[0-9a-fA-F]{64}$/.test(key)
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!hasAdminAccess(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!hasValidEncryptionKey()) {
    return NextResponse.json(
      { error: 'ENCRYPTION_KEY is missing or invalid. Configure it before running this migration.' },
      { status: 503 }
    )
  }

  try {
    const batchSize = 500
    let cursor: string | null = null
    let scanned = 0
    let fixed = 0
    let skipped = 0

    for (;;) {
      const events: { id: string; virtualLink: string | null; virtualLinkIv: string | null }[] = await prisma.event.findMany({
        where: {
          eventType: 'VIRTUAL',
          virtualLink: { not: null },
        },
        select: {
          id: true,
          virtualLink: true,
          virtualLinkIv: true,
        },
        orderBy: { id: 'asc' },
        take: batchSize,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })

      if (events.length === 0) {
        break
      }

      scanned += events.length

      for (const event of events) {
        const stored = event.virtualLink
        if (!stored) {
          skipped++
          continue
        }

        const plain = decrypt(stored, event.virtualLinkIv ?? '')
        if (!plain) {
          skipped++
          continue
        }

        const reencrypted = encrypt(plain)
        await prisma.event.update({
          where: { id: event.id },
          data: {
            virtualLink: reencrypted.encrypted,
            virtualLinkIv: reencrypted.iv,
          },
        })
        fixed++
      }

      cursor = events[events.length - 1].id
    }

    return NextResponse.json({ success: true, fixed, skipped, scanned })
  } catch (err) {
    console.error('[admin/migrate-virtual-links] POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
