import prisma from './prisma'
import { v4 as uuidv4 } from 'uuid'

/**
 * Generates a short uppercase ticket code (12-char hex-like string).
 * Uses two UUID v4 segments joined and uppercased for uniqueness.
 */
function generateTicketCode(): string {
  return uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase()
}

/**
 * Idempotently creates a Ticket record for a given registration.
 * If a ticket already exists for this registration, returns the existing one.
 */
export async function generateTicketForRegistration(registrationId: string) {
  const existing = await prisma.ticket.findUnique({ where: { registrationId } })
  if (existing) return existing

  return prisma.ticket.create({
    data: {
      registrationId,
      code: generateTicketCode(),
    },
  })
}

/**
 * Backfills Ticket records for all confirmed registrations that have none.
 * Returns the number of tickets created.
 */
export async function backfillTickets(): Promise<number> {
  const registrations = await prisma.registration.findMany({
    where: { ticket: null, status: 'confirmed' },
    select: { id: true },
  })

  for (const r of registrations) {
    await generateTicketForRegistration(r.id)
  }

  return registrations.length
}
