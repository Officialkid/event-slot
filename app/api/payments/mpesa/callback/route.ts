import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateConfirmationCode } from '@/lib/confirmationCode';
import { generateTicketForRegistration } from '@/lib/tickets';
import { sendConfirmationEmail } from '@/lib/email';

// Safaricom posts to this URL after the user completes (or cancels) the STK push.
// This route MUST be publicly accessible — no auth middleware.
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }

  const stkCallback = body?.Body?.stkCallback;
  if (!stkCallback) {
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }

  const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;

  const eventOrder = await prisma.paidEventOrder.findFirst({
    where: { checkoutRequestId: CheckoutRequestID },
    include: {
      event: {
        select: {
          id: true,
          title: true,
          slug: true,
          eventDate: true,
          location: true,
          questions: true,
        },
      },
      ticketTier: {
        select: {
          id: true,
          name: true,
          priceKes: true,
        },
      },
    },
  });

  if (eventOrder) {
    if (ResultCode !== 0) {
      await prisma.paidEventOrder.update({
        where: { id: eventOrder.id },
        data: {
          status: ResultCode === 1032 ? 'CANCELLED' : 'FAILED',
        },
      });
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const items: any[] = CallbackMetadata?.Item ?? [];
    const receiptNumber = items.find((i: any) => i.Name === 'MpesaReceiptNumber')?.Value ?? null;
    const paidAt = new Date();
    const existingRegistration = await prisma.registration.findFirst({
      where: { paidOrderId: eventOrder.id },
      select: { id: true, confirmationCode: true },
    });

    let confirmationCode = existingRegistration?.confirmationCode ?? null;
    let registrationId = existingRegistration?.id ?? null;

    if (!existingRegistration) {
      const registrationNumber = (await prisma.registration.count({ where: { eventId: eventOrder.eventId } })) + 1;
      confirmationCode = generateConfirmationCode();

      const registration = await prisma.$transaction(async (tx) => {
        const created = await tx.registration.create({
          data: {
            eventId: eventOrder.eventId,
            ticketTierId: eventOrder.ticketTierId,
            paidOrderId: eventOrder.id,
            answers: eventOrder.attendeePayload,
            status: 'confirmed',
            registrationNumber,
            submittedAt: paidAt,
            notified: false,
            attendeeEmail: eventOrder.attendeeEmail,
            consentTransactional: true,
            consentMarketing: false,
            confirmationCode,
            qrCode: crypto.randomUUID(),
            source: 'paid-checkout',
          },
          select: { id: true, confirmationCode: true },
        });

        await tx.event.update({
          where: { id: eventOrder.eventId },
          data: { confirmedCount: { increment: 1 } },
        });

        await tx.ticketTier.update({
          where: { id: eventOrder.ticketTierId },
          data: { soldCount: { increment: 1 } },
        });

        await tx.paidEventOrder.update({
          where: { id: eventOrder.id },
          data: {
            status: 'PAID',
            providerReference: receiptNumber,
            mpesaReceiptNumber: receiptNumber,
            paidAt,
          },
        });

        return created;
      });

      registrationId = registration.id;
    } else {
      await prisma.paidEventOrder.update({
        where: { id: eventOrder.id },
        data: {
          status: 'PAID',
          providerReference: receiptNumber,
          mpesaReceiptNumber: receiptNumber,
          paidAt,
        },
      });
    }

    if (registrationId) {
      const ticket = await generateTicketForRegistration(registrationId);
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          ticketTierId: eventOrder.ticketTierId,
          ticketTierName: eventOrder.ticketTier.name,
          amountPaidKes: eventOrder.amountKes,
        },
      }).catch(() => {});
    }

    if (eventOrder.attendeeEmail && confirmationCode) {
      sendConfirmationEmail({
        to: eventOrder.attendeeEmail,
        name: eventOrder.attendeeName || 'there',
        eventTitle: eventOrder.event.title,
        confirmationNumber: confirmationCode,
        userId: null,
        eventDate: eventOrder.event.eventDate,
        eventSlug: eventOrder.event.slug,
        eventLocation: eventOrder.event.location,
      }).catch(() => {});
    }

    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }

  // Find the pending payment by CheckoutRequestID
  const payment = await prisma.subscriptionPayment.findFirst({
    where: { checkoutRequestId: CheckoutRequestID },
  });

  if (!payment) {
    console.error('Callback: no payment found for', CheckoutRequestID);
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }

  if (ResultCode !== 0) {
    // Payment failed or was cancelled by user
    await prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: {
        status: ResultCode === 1032 ? 'CANCELLED' : 'FAILED',
      },
    });
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }

  // Extract M-Pesa receipt number from metadata
  const items: any[] = CallbackMetadata?.Item ?? [];
  const receiptNumber = items.find((i: any) => i.Name === 'MpesaReceiptNumber')?.Value ?? null;
  const mpesaAmount = items.find((i: any) => i.Name === 'Amount')?.Value ?? payment.amountKes;

  // Parse the intent stored in payment.description
  let intent: any = {};
  try {
    intent = JSON.parse(payment.description ?? '{}');
  } catch {
    console.error('Callback: could not parse intent for payment', payment.id);
  }

  const { userId, planId, billingCycle, priceUsd, kesRate } = intent;

  if (!userId || !planId) {
    console.error('Callback: missing userId or planId in intent');
    await prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: { status: 'FAILED' },
    });
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }

  // Calculate subscription period
  const now = new Date();
  const isAnnual = billingCycle === 'ANNUAL';
  const periodEnd = new Date(now);
  if (isAnnual) {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  // Upsert subscription — upgrade or create
  const existingSub = await prisma.subscription.findFirst({
    where: { userId },
  });

  if (existingSub) {
    await prisma.subscription.update({
      where: { id: existingSub.id },
      data: {
        planId,
        billingCycle: isAnnual ? 'ANNUAL' : 'MONTHLY',
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        paymentProvider: 'mpesa',
        mpesaPhone: intent.phone,
        lastPaymentRef: receiptNumber,
        lastPaymentAmount: priceUsd,
        lastPaymentAt: now,
      },
    });
  } else {
    const newSub = await prisma.subscription.create({
      data: {
        userId,
        planId,
        billingCycle: isAnnual ? 'ANNUAL' : 'MONTHLY',
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        paymentProvider: 'mpesa',
        mpesaPhone: intent.phone,
        lastPaymentRef: receiptNumber,
        lastPaymentAmount: priceUsd,
        lastPaymentAt: now,
      },
    });

    // Update the payment record with the new subscription ID
    await prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: { subscriptionId: newSub.id },
    });
  }

  // Mark payment as successful
  await prisma.subscriptionPayment.update({
    where: { id: payment.id },
    data: {
      status: 'SUCCESS',
      providerRef: receiptNumber,
      paidAt: now,
    },
  });

  console.log(`✓ Subscription activated: user ${userId} → plan ${planId} (${billingCycle})`);
  return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
}
