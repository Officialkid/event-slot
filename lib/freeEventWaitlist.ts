import { v4 as uuidv4 } from 'uuid'
import prisma from '@/lib/prisma'
import { generateConfirmationCode } from '@/lib/confirmationCode'

export async function promoteNextFreeWaitlistSpot(eventId: string) {
  const nextWaitlisted = await prisma.registration.findFirst({
    where: {
      eventId,
      status: 'waitlist',
      ticketTierId: null,
    },
    orderBy: { waitlistPosition: 'asc' },
    select: {
      id: true,
      attendeeEmail: true,
      waitlistPosition: true,
      confirmationCode: true,
      qrCode: true,
      consentTransactional: true,
    },
  })

  if (!nextWaitlisted) return null

  return prisma.$transaction(async (tx) => {
    const promoted = await tx.registration.update({
      where: { id: nextWaitlisted.id },
      data: {
        status: 'confirmed',
        waitlistPosition: null,
        submittedAt: new Date(),
        confirmationCode: nextWaitlisted.confirmationCode ?? generateConfirmationCode(),
        qrCode: nextWaitlisted.qrCode ?? uuidv4(),
      },
      select: {
        id: true,
        attendeeEmail: true,
        consentTransactional: true,
        confirmationCode: true,
      },
    })

    await tx.registration.updateMany({
      where: {
        eventId,
        status: 'waitlist',
        ticketTierId: null,
        waitlistPosition: { gt: nextWaitlisted.waitlistPosition ?? 0 },
      },
      data: {
        waitlistPosition: { decrement: 1 },
      },
    })

    await tx.event.update({
      where: { id: eventId },
      data: {
        confirmedCount: { increment: 1 },
        waitlistCount: { decrement: 1 },
      },
    })

    return promoted
  })
}
