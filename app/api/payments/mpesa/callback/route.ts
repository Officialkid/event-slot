import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { generateConfirmationCode } from '@/lib/confirmationCode';
import { generateTicketForRegistration } from '@/lib/tickets';
import { sendConfirmationEmail } from '@/lib/email';
import { calculatePaidEventCommission } from '@/lib/paidEventCommission';
import { offerNextPaidWaitlistSpot } from '@/lib/paidEventWaitlist';

type MpesaCallbackItem = {
  Name?: string;
  Value?: string | number | null;
};

type MpesaStkCallback = {
  CheckoutRequestID?: string;
  ResultCode?: number;
  ResultDesc?: string;
  CallbackMetadata?: {
    Item?: MpesaCallbackItem[];
  };
};

type MpesaCallbackBody = {
  Body?: {
    stkCallback?: MpesaStkCallback;
  };
};

type SubscriptionIntent = {
  userId?: string;
  planId?: string;
  billingCycle?: 'MONTHLY' | 'ANNUAL' | string;
  priceUsd?: number;
  amountKes?: number;
  phone?: string;
};

function getCallbackItems(metadata?: { Item?: MpesaCallbackItem[] }) {
  return Array.isArray(metadata?.Item) ? metadata.Item : [];
}

function getItemValue(items: MpesaCallbackItem[], name: string) {
  return items.find((item) => item.Name === name)?.Value;
}

// Safaricom posts to this URL after the user completes (or cancels) the STK push.
// This route MUST be publicly accessible — no auth middleware.
export async function POST(req: NextRequest) {
  let body: MpesaCallbackBody | null = null;
  try {
    body = (await req.json()) as MpesaCallbackBody;
  } catch {
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }

  const stkCallback = body?.Body?.stkCallback;
  if (!stkCallback) {
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }

  const checkoutRequestId = typeof stkCallback.CheckoutRequestID === 'string' ? stkCallback.CheckoutRequestID : '';
  const resultCode = typeof stkCallback.ResultCode === 'number' ? stkCallback.ResultCode : -1;
  const callbackItems = getCallbackItems(stkCallback.CallbackMetadata);

  const eventOrder = await prisma.paidEventOrder.findFirst({
    where: { checkoutRequestId },
    include: {
      event: {
        select: {
          id: true,
          title: true,
          slug: true,
          eventDate: true,
          location: true,
          questions: true,
          organizer: { select: { plan: true } },
        },
      },
      ticketTier: {
        select: {
          id: true,
          name: true,
          priceKes: true,
          bundleSize: true,
        },
      },
    },
  });

  if (eventOrder) {
    if (resultCode !== 0) {
      await prisma.paidEventOrder.update({
        where: { id: eventOrder.id },
        data: {
          status: resultCode === 1032 ? 'CANCELLED' : 'FAILED',
        },
      });
      await prisma.payment.updateMany({
        where: { paidEventOrderId: eventOrder.id },
        data: { status: resultCode === 1032 ? 'CANCELLED' : 'FAILED' },
      });
      await offerNextPaidWaitlistSpot(eventOrder.eventId, eventOrder.ticketTierId).catch(() => {});
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const receiptValue = getItemValue(callbackItems, 'MpesaReceiptNumber');
    const receiptNumber = receiptValue == null ? null : String(receiptValue);
    const paidAt = new Date();
    const existingRegistration = await prisma.registration.findFirst({
      where: { paidOrderId: eventOrder.id },
      select: { id: true, confirmationCode: true },
    });

    let confirmationCode = existingRegistration?.confirmationCode ?? null;
    let registrationId = existingRegistration?.id ?? null;
    let ticketId: string | null = null;

    if (eventOrder.promotionRegistrationId) {
      const promoted = await prisma.$transaction(async (tx) => {
        const updatedRegistration = await tx.registration.update({
          where: { id: eventOrder.promotionRegistrationId! },
          data: {
            status: 'confirmed',
            paidOrderId: eventOrder.id,
            confirmationCode: confirmationCode ?? generateConfirmationCode(),
            submittedAt: paidAt,
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

        return updatedRegistration;
      });
      confirmationCode = promoted.confirmationCode;
      registrationId = promoted.id;
    } else if (!existingRegistration) {
      const registrationNumber = (await prisma.registration.count({ where: { eventId: eventOrder.eventId } })) + 1;
      confirmationCode = generateConfirmationCode();

      const registration = await prisma.$transaction(async (tx) => {
        const created = await tx.registration.create({
          data: {
            eventId: eventOrder.eventId,
            ticketTierId: eventOrder.ticketTierId,
            paidOrderId: eventOrder.id,
            answers: eventOrder.attendeePayload as Prisma.InputJsonValue,
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
      ticketId = ticket.id;
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          ticketTierId: eventOrder.ticketTierId,
          ticketTierName: eventOrder.ticketTier.name,
          amountPaidKes: eventOrder.amountKes,
          admissionsTotal: Math.max(1, eventOrder.ticketTier.bundleSize ?? 1),
          admissionsUsed: 0,
          verifiedEntries: [],
        },
      }).catch(() => {});
    }

    const commission = calculatePaidEventCommission(eventOrder.amountKes, eventOrder.event.organizer?.plan ?? 'free');
    await prisma.payment.updateMany({
      where: { paidEventOrderId: eventOrder.id },
      data: {
        registrationId,
        ticketId,
        amount: eventOrder.amountKes,
        commissionAmount: commission.commissionAmount,
        organizerAmount: commission.organizerAmount,
        commissionRate: commission.commissionRate,
        mpesaRef: receiptNumber,
        status: 'SUCCESS',
        paidAt,
      },
    });

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
    where: { checkoutRequestId },
  });

  if (!payment) {
    console.error('Callback: no payment found for', checkoutRequestId);
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }

  if (resultCode !== 0) {
    // Payment failed or was cancelled by user
    await prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: {
        status: resultCode === 1032 ? 'CANCELLED' : 'FAILED',
      },
    });
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }

  // Extract M-Pesa receipt number from metadata
  const receiptValue = getItemValue(callbackItems, 'MpesaReceiptNumber');
  const receiptNumber = receiptValue == null ? null : String(receiptValue);

  // Parse the intent stored in payment.description
  let intent: SubscriptionIntent = {};
  try {
    const parsed = JSON.parse(payment.description ?? '{}') as unknown;
    if (parsed && typeof parsed === 'object') {
      intent = parsed as SubscriptionIntent;
    }
  } catch {
    console.error('Callback: could not parse intent for payment', payment.id);
  }

  const { userId, planId, billingCycle, priceUsd, phone } = intent;

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
        mpesaPhone: phone,
        lastPaymentRef: receiptNumber,
        lastPaymentAmount: priceUsd ?? payment.amountUsd,
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
        mpesaPhone: phone,
        lastPaymentRef: receiptNumber,
        lastPaymentAmount: priceUsd ?? payment.amountUsd,
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
