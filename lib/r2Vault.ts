import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import prisma from '@/lib/prisma'

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'eventsslot'

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY
  )
}

export function getR2Client(): S3Client | null {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })
}

export interface ArchiveResult {
  success: boolean
  key?: string
  url?: string
  recordsArchived?: number
  error?: string
}

/**
 * Archives an event's registration dataset into Cloudflare R2 Vault.
 * Supports archiving by specific occurrence date (for recurring events) or the full event.
 */
export async function archiveEventToR2(
  eventId: string,
  options?: { occurrenceDate?: Date | null; reason?: string }
): Promise<ArchiveResult> {
  try {
    const s3 = getR2Client()
    if (!s3) {
      return { success: false, error: 'Cloudflare R2 credentials not configured' }
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        organizer: {
          select: { id: true, name: true, email: true, plan: true },
        },
      },
    })

    if (!event) {
      return { success: false, error: 'Event not found' }
    }

    // Query registrations
    const registrationWhere: any = { eventId }
    if (options?.occurrenceDate) {
      registrationWhere.occurrenceDate = options.occurrenceDate
    }

    const registrations = await prisma.registration.findMany({
      where: registrationWhere,
      include: {
        ticket: true,
      },
      orderBy: { submittedAt: 'asc' },
    })

    const viewsCount = await prisma.eventView.count({ where: { eventId } })

    const dateSlug = options?.occurrenceDate
      ? options.occurrenceDate.toISOString().split('T')[0]
      : 'all'
    const timestamp = Date.now()
    const objectKey = `vault/${event.slug || event.id}/${dateSlug}-${timestamp}.json`

    const payload = {
      vaultVersion: '1.0',
      archivedAt: new Date().toISOString(),
      reason: options?.reason || 'periodic-vault-sync',
      eventId: event.id,
      eventSlug: event.slug,
      eventTitle: event.title,
      occurrenceDate: options?.occurrenceDate?.toISOString() ?? null,
      totalRegistrations: registrations.length,
      totalViews: viewsCount,
      eventMeta: {
        isRecurring: event.isRecurring,
        recurrenceFrequency: event.recurrenceFrequency,
        status: event.status,
        capacity: event.capacity,
        deadline: event.deadline,
        eventDate: event.eventDate,
      },
      organizer: event.organizer,
      registrations: registrations.map((r) => ({
        id: r.id,
        registrationNumber: r.registrationNumber,
        status: r.status,
        attendeeEmail: r.attendeeEmail,
        occurrenceDate: r.occurrenceDate?.toISOString() ?? null,
        submittedAt: r.submittedAt?.toISOString() ?? null,
        answers: r.answers,
        checkedIn: r.checkedIn,
        checkedInAt: r.checkedInAt?.toISOString() ?? null,
        confirmationCode: r.confirmationCode,
        ticket: r.ticket ? {
          code: r.ticket.code,
          ticketTierName: r.ticket.ticketTierName,
          scannedAt: r.ticket.scannedAt?.toISOString() ?? null,
          admissionsTotal: r.ticket.admissionsTotal,
          admissionsUsed: r.ticket.admissionsUsed,
        } : null,
      })),
    }

    const jsonBody = JSON.stringify(payload, null, 2)

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: objectKey,
        Body: Buffer.from(jsonBody, 'utf-8'),
        ContentType: 'application/json',
      })
    )

    // Update lastArchivedAt on Event
    await prisma.event.update({
      where: { id: eventId },
      data: { lastArchivedAt: new Date() },
    })

    const publicUrl = process.env.R2_PUBLIC_URL
      ? `${process.env.R2_PUBLIC_URL.replace(/\/$/, '')}/${objectKey}`
      : undefined

    return {
      success: true,
      key: objectKey,
      url: publicUrl,
      recordsArchived: registrations.length,
    }
  } catch (err: any) {
    console.error('[r2Vault] Error archiving event to R2:', err)
    return {
      success: false,
      error: err?.message || 'Failed to archive event to R2',
    }
  }
}
