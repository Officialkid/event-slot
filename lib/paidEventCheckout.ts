import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { calculatePaidEventCommission } from "@/lib/paidEventCommission";
import { toMinorUnits } from "@/lib/financialLedger";
import {
  initializePaystackTransaction,
  PaystackTimeoutError,
} from "@/lib/paystack";
import { normalizeMpesaPhone } from "@/lib/intasend";
import { detectCountry } from "@/lib/geoip";
import { joinPaidEventWaitlist } from "@/lib/paymentFinalizers";
import { getFullOptions } from "@/lib/registrationQuestionOptions";

type AttendeeAnswer = { questionId: string; value: string };
type AttendeePayload = { answers: AttendeeAnswer[]; baseEmail?: string };
type EventQuestion = {
  id: string;
  type: string;
  label: string;
  required?: boolean;
  options?: string[];
  optionLimits?: Record<string, number | null | undefined>;
  allowMultiple?: boolean;
};

type BuildPaidOrderInput = {
  eventSlug: string;
  ticketTierId: string;
  attendee: AttendeePayload;
  mpesaPhone?: string;
  consentDataProcessing?: boolean;
  consentTransactional?: boolean;
  consentMarketing?: boolean;
  source?: string;
  refCode?: string;
  utmSource?: string;
  request: Request;
};

export type PaidCheckoutResult =
  | {
      kind: "checkout";
      orderId: string;
      checkoutRequestId: string;
      authorizationUrl?: string;
      eventTitle: string;
      ticketTierName: string;
      amountKes: number;
      paymentMethod: string;
      customerMessage: string;
    }
  | {
      kind: "waitlist";
      eventTitle: string;
      results: Array<{
        status: "waitlist";
        waitlistPosition?: number;
        registrationId: string;
        registrationNumber?: number;
      }>;
    };

export class PaidCheckoutError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PaidCheckoutError";
    this.status = status;
  }
}

/**
 * Initiates paid ticket checkout with concurrency-safe capacity reservation
 * and Paystack hosted checkout initialization.
 */
export async function beginPaidEventCheckout(input: BuildPaidOrderInput): Promise<PaidCheckoutResult> {
  const normalizedSource = typeof input.source === "string" && input.source.trim() ? input.source.trim().toLowerCase() : "paid-checkout";
  const normalizedRefCode = typeof input.refCode === "string" && input.refCode.trim() ? input.refCode.trim() : null;
  const normalizedUtmSource = typeof input.utmSource === "string" && input.utmSource.trim() ? input.utmSource.trim() : null;
  const attendeeAnswers = Array.isArray(input.attendee?.answers) ? input.attendee.answers : [];

  if (!input.eventSlug?.trim() || !input.ticketTierId?.trim() || attendeeAnswers.length === 0) {
    throw new PaidCheckoutError("Event, ticket tier, and attendee answers are required.", 400);
  }

  if (!input.consentDataProcessing) {
    throw new PaidCheckoutError("You must consent to data processing before checking out.", 400);
  }

  // Pre-load event for question validation
  const precheckEvent = await prisma.event.findUnique({
    where: { slug: input.eventSlug },
    select: { id: true, isPaid: true, status: true, deadline: true, eventEndAt: true, questions: true },
  });

  if (!precheckEvent || !precheckEvent.isPaid) {
    throw new PaidCheckoutError("Paid event not found.", 404);
  }

  if (precheckEvent.status === "closed" || precheckEvent.status === "COMPLETED") {
    throw new PaidCheckoutError("Registration is closed.", 400);
  }

  const effectiveCloseAt = precheckEvent.deadline ?? precheckEvent.eventEndAt ?? null;
  if (effectiveCloseAt && new Date(effectiveCloseAt).getTime() < Date.now()) {
    throw new PaidCheckoutError("Registration is closed.", 400);
  }

  const questions = (precheckEvent.questions as EventQuestion[] | null) ?? [];
  validateRequiredAnswers(questions, attendeeAnswers);
  await validateLimitedOptions(precheckEvent.id, questions, attendeeAnswers);

  const attendeeEmail = extractAttendeeEmail(questions, attendeeAnswers) ?? input.attendee.baseEmail?.trim() ?? null;
  const attendeeName = extractAttendeeName(questions, attendeeAnswers) ?? "Attendee";
  const attendeePhone = extractAttendeePhone(questions, attendeeAnswers) ?? (input.mpesaPhone ? input.mpesaPhone.trim() : null);

  if (!attendeeEmail || !attendeeEmail.includes("@")) {
    throw new PaidCheckoutError("A valid attendee email address is required for checkout.", 400);
  }

  // -------------------------------------------------------------------------
  // Concurrency-Safe Capacity Reservation (Atomic Transaction)
  // -------------------------------------------------------------------------
  const reservation = await prisma.$transaction(async (tx) => {
    const event = await tx.event.findUnique({
      where: { slug: input.eventSlug },
      include: {
        organizer: { select: { plan: true } },
        ticketTiers: {
          where: { id: input.ticketTierId, status: "ACTIVE" },
          take: 1,
        },
      },
    });

    if (!event || !event.isPaid) {
      throw new PaidCheckoutError("Paid event not found.", 404);
    }

    const ticketTier = event.ticketTiers[0];
    if (!ticketTier) {
      throw new PaidCheckoutError("Ticket tier not found.", 404);
    }

    // Count currently active holds within the transaction lock
    const pendingCount = await tx.paidEventOrder.count({
      where: {
        ticketTierId: ticketTier.id,
        status: { in: ["PENDING", "PAYMENT_PENDING"] },
        holdExpiresAt: { gt: new Date() },
      },
    });

    const available = Math.max(0, ticketTier.capacity - ticketTier.soldCount - pendingCount);
    if (available <= 0) {
      return { kind: "exhausted" as const, event, ticketTier };
    }

    // Reserve 15-minute hold window and commit order atomically
    const holdExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const normalizedPhone = input.mpesaPhone ? normalizeMpesaPhone(input.mpesaPhone) : null;
    const commission = calculatePaidEventCommission(ticketTier.priceKes, event.organizer?.plan);

    const order = await tx.paidEventOrder.create({
      data: {
        eventId: event.id,
        ticketTierId: ticketTier.id,
        status: "PENDING",
        paymentMethod: "CARD",
        attendeePayload: attendeeAnswers as Prisma.InputJsonValue,
        attendeeEmail,
        attendeeName,
        attendeePhone,
        amountKes: ticketTier.priceKes, // Authoritative server price
        currency: "KES",
        holdExpiresAt,
        mpesaPhone: normalizedPhone,
      },
      select: { id: true, amountKes: true, currency: true },
    });

    await tx.payment.create({
      data: {
        eventId: event.id,
        paidEventOrderId: order.id,
        ticketTierId: ticketTier.id,
        amount: ticketTier.priceKes,
        commissionAmount: commission.commissionAmount,
        organizerAmount: commission.organizerAmount,
        commissionRate: commission.commissionRate,
        method: "CARD",
        status: "PENDING",
      },
    });

    return {
      kind: "reserved" as const,
      event,
      ticketTier,
      order,
    };
  });

  // Handle sold out / waitlist
  if (reservation.kind === "exhausted") {
    const countryCode = await detectCountry(input.request as Request).catch(() => null);
    const waitlistRegistration = await joinPaidEventWaitlist({
      eventId: reservation.event.id,
      eventSlug: reservation.event.slug,
      eventTitle: reservation.event.title,
      ticketTierId: reservation.ticketTier.id,
      ticketTierWaitlistCount: reservation.ticketTier.waitlistCount,
      attendeeEmail,
      attendeeAnswers,
      consentTransactional: input.consentTransactional ?? true,
      consentMarketing: input.consentMarketing ?? false,
      source: normalizedSource,
      refCode: normalizedRefCode,
      utmSource: normalizedUtmSource,
      countryCode,
    });

    return {
      kind: "waitlist",
      eventTitle: reservation.event.title,
      results: [
        {
          status: "waitlist",
          waitlistPosition: waitlistRegistration.waitlistPosition ?? undefined,
          registrationId: waitlistRegistration.id,
          registrationNumber: waitlistRegistration.registrationNumber ?? undefined,
        },
      ],
    };
  }

  // -------------------------------------------------------------------------
  // Paystack Transaction Initialization (External Network Call)
  // -------------------------------------------------------------------------
  const orderId = reservation.order.id;
  const reference = `pes_${orderId}_${Date.now().toString(36)}`;
  const baseUrl = process.env.NEXTAUTH_URL || "https://www.eventsslot.com";
  const callbackUrl = `${baseUrl}/events/${reservation.event.slug}/order/${orderId}`;

  try {
    const paystack = await initializePaystackTransaction({
      email: attendeeEmail,
      amountMinorUnits: toMinorUnits(reservation.order.amountKes, "KES"),
      currency: "KES",
      reference,
      callbackUrl,
      channels: ["card", "mobile_money"],
      metadata: {
        orderId,
        eventId: reservation.event.id,
        eventSlug: reservation.event.slug,
        ticketTierId: reservation.ticketTier.id,
        attendeeName,
        type: "paid_event_checkout",
      },
    });

    await prisma.$transaction([
      prisma.paidEventOrder.update({
        where: { id: orderId },
        data: {
          status: "PAYMENT_PENDING",
          checkoutRequestId: paystack.accessCode,
          providerReference: `paystack:${paystack.reference}`,
        },
      }),
      prisma.payment.updateMany({
        where: { paidEventOrderId: orderId },
        data: { status: "PENDING" },
      }),
    ]);

    return {
      kind: "checkout",
      orderId,
      checkoutRequestId: paystack.accessCode,
      authorizationUrl: paystack.authorizationUrl,
      eventTitle: reservation.event.title,
      ticketTierName: reservation.ticketTier.name,
      amountKes: reservation.order.amountKes,
      paymentMethod: "card",
      customerMessage: "Proceed to secure Paystack checkout to complete payment.",
    };
  } catch (error) {
    if (error instanceof PaystackTimeoutError) {
      // INVARIANT: Never assume timeout means payment did not initiate!
      // Keep order PENDING with reference so reconciliation can recover it.
      await prisma.paidEventOrder.update({
        where: { id: orderId },
        data: {
          providerReference: `paystack:${reference}`,
        },
      }).catch(() => {});

      throw new PaidCheckoutError("Payment gateway timed out. Please check your order status to retry.", 504);
    }

    // On non-timeout failure, fail order and release reservation
    await prisma.$transaction([
      prisma.paidEventOrder.update({
        where: { id: orderId },
        data: { status: "FAILED", holdExpiresAt: new Date(0) },
      }),
      prisma.payment.updateMany({
        where: { paidEventOrderId: orderId },
        data: { status: "FAILED" },
      }),
    ]).catch(() => {});

    throw error instanceof Error ? error : new PaidCheckoutError("Payment initiation failed.", 502);
  }
}

/**
 * Re-initiates or continues payment for an existing pending order.
 */
export async function startPaidEventOrderPayment(orderId: string, _mpesaPhone?: string) {
  const order = await prisma.paidEventOrder.findUnique({
    where: { id: orderId },
    include: {
      event: {
        select: {
          id: true,
          slug: true,
          title: true,
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

  if (!order) {
    throw new PaidCheckoutError("Order not found.", 404);
  }

  if (order.status === "PAID") {
    return {
      orderId: order.id,
      checkoutRequestId: order.checkoutRequestId ?? "",
      customerMessage: "Payment has already been completed for this order.",
    };
  }

  if (order.status === "EXPIRED" || order.status === "FAILED" || order.status === "CANCELLED") {
    throw new PaidCheckoutError("This payment offer is no longer available.", 409);
  }

  if (order.holdExpiresAt.getTime() <= Date.now()) {
    throw new PaidCheckoutError("This payment offer has expired.", 409);
  }

  const attendeeEmail = order.attendeeEmail?.trim() || `paid-order-${order.id}@eventslot.local`;
  const reference = `pes_${order.id}_${Date.now().toString(36)}`;
  const baseUrl = process.env.NEXTAUTH_URL || "https://www.eventsslot.com";
  const callbackUrl = `${baseUrl}/events/${order.event.slug}/order/${order.id}`;

  const paystack = await initializePaystackTransaction({
    email: attendeeEmail,
    amountMinorUnits: toMinorUnits(order.amountKes, "KES"),
    currency: "KES",
    reference,
    callbackUrl,
    channels: ["card", "mobile_money"],
    metadata: {
      orderId: order.id,
      eventId: order.event.id,
      eventSlug: order.event.slug,
      ticketTierId: order.ticketTier.id,
      type: "paid_event_checkout",
    },
  });

  await prisma.$transaction([
    prisma.paidEventOrder.update({
      where: { id: order.id },
      data: {
        status: "PAYMENT_PENDING",
        checkoutRequestId: paystack.accessCode,
        providerReference: `paystack:${paystack.reference}`,
      },
    }),
    prisma.payment.updateMany({
      where: { paidEventOrderId: order.id },
      data: { status: "PENDING" },
    }),
  ]);

  return {
    orderId: order.id,
    checkoutRequestId: paystack.accessCode,
    authorizationUrl: paystack.authorizationUrl,
    customerMessage: `Proceed to Paystack checkout for ${order.ticketTier.name} to finish payment.`,
  };
}

function validateRequiredAnswers(questions: EventQuestion[], answers: AttendeeAnswer[]) {
  for (const question of questions) {
    if (!question.required) {
      continue;
    }

    const answer = answers.find((item) => item.questionId === question.id)?.value ?? "";
    const hasValue = question.type === "checkbox" ? parseCheckboxValue(answer).length > 0 : answer.trim().length > 0;
    if (!hasValue) {
      throw new PaidCheckoutError(`Please fill in "${question.label}".`, 400);
    }
  }
}

async function validateLimitedOptions(eventId: string, questions: EventQuestion[], answers: AttendeeAnswer[]) {
  const limitedQuestions = questions.filter((question) => {
    const limits = question.optionLimits ?? {};
    return (question.type === "select" || question.type === "checkbox") && Object.keys(limits).length > 0;
  });

  if (limitedQuestions.length === 0) {
    return;
  }

  const registrations = await prisma.registration.findMany({
    where: {
      eventId,
      status: { in: ["confirmed", "attended"] },
    },
    select: { answers: true },
  });

  const questionMap = new Map(questions.map((question) => [question.id, question]));
  const optionCounts: Record<string, Record<string, number>> = {};

  for (const registration of registrations) {
    const regAnswers = Array.isArray(registration.answers) ? (registration.answers as AttendeeAnswer[]) : [];
    for (const answer of regAnswers) {
      const question = questionMap.get(answer.questionId);
      if (!question || (question.type !== "select" && question.type !== "checkbox")) {
        continue;
      }

      const selectedOptions = question.type === "checkbox" ? parseCheckboxValue(answer.value) : [answer.value.trim()].filter(Boolean);
      for (const option of selectedOptions) {
        optionCounts[answer.questionId] = optionCounts[answer.questionId] ?? {};
        optionCounts[answer.questionId][option] = (optionCounts[answer.questionId][option] ?? 0) + 1;
      }
    }
  }

  const registrationRecords = registrations.map((r) => ({
    answers: Array.isArray(r.answers) ? (r.answers as AttendeeAnswer[]) : [],
  }));

  for (const question of limitedQuestions) {
    const answer = answers.find((item) => item.questionId === question.id)?.value ?? "";
    const selectedOptions = question.type === "checkbox" ? parseCheckboxValue(answer) : [answer.trim()].filter(Boolean);
    const fullOptions = new Set(getFullOptions(question, registrationRecords));

    for (const option of selectedOptions) {
      if (fullOptions.has(option)) {
        throw new PaidCheckoutError(`Option "${option}" for "${question.label}" is full. Please choose another option.`, 400);
      }
    }
  }
}

function extractAttendeeEmail(questions: EventQuestion[], answers: AttendeeAnswer[]) {
  const emailQuestion = questions.find((item) => item.type === "email" || item.id === "email" || /email/i.test(item.label));
  if (emailQuestion) {
    const value = answers.find((item) => item.questionId === emailQuestion.id)?.value.trim();
    if (value) return value;
  }
  return answers.find((item) => item.value.includes("@"))?.value.trim() ?? null;
}

function extractAttendeeName(questions: EventQuestion[], answers: AttendeeAnswer[]) {
  const nameQuestion = questions.find((item) => item.type === "name" || item.id === "name" || /name/i.test(item.label));
  if (nameQuestion) {
    const value = answers.find((item) => item.questionId === nameQuestion.id)?.value.trim();
    if (value) return value;
  }
  return null;
}

function extractAttendeePhone(questions: EventQuestion[], answers: AttendeeAnswer[]) {
  const phoneQuestion = questions.find((item) => item.type === "phone" || item.id === "phone" || /phone|mobile/i.test(item.label));
  if (phoneQuestion) {
    const value = answers.find((item) => item.questionId === phoneQuestion.id)?.value.trim();
    if (value) return value;
  }
  return null;
}

function parseCheckboxValue(value: string) {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
  } catch {}

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
