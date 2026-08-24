import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { calculatePaidEventCommission } from "@/lib/paidEventCommission";
import { normalizeMpesaPhone, startIntaSendStkPush } from "@/lib/intasend";
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
  mpesaPhone: string;
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
      eventTitle: string;
      ticketTierName: string;
      amountKes: number;
      paymentMethod: "mpesa";
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

export async function beginPaidEventCheckout(input: BuildPaidOrderInput): Promise<PaidCheckoutResult> {
  const normalizedSource = typeof input.source === "string" && input.source.trim() ? input.source.trim().toLowerCase() : "paid-checkout";
  const normalizedRefCode = typeof input.refCode === "string" && input.refCode.trim() ? input.refCode.trim() : null;
  const normalizedUtmSource = typeof input.utmSource === "string" && input.utmSource.trim() ? input.utmSource.trim() : null;
  const attendeeAnswers = Array.isArray(input.attendee?.answers) ? input.attendee.answers : [];

  if (!input.eventSlug.trim() || !input.ticketTierId.trim() || attendeeAnswers.length === 0) {
    throw new PaidCheckoutError("Event, ticket tier, and attendee answers are required.", 400);
  }

  if (!input.consentDataProcessing) {
    throw new PaidCheckoutError("You must consent to data processing before checking out.", 400);
  }

  const event = await prisma.event.findUnique({
    where: { slug: input.eventSlug },
    include: {
      organizer: { select: { plan: true } },
      ticketTiers: {
        where: { id: input.ticketTierId, status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          priceKes: true,
          capacity: true,
          soldCount: true,
          waitlistCount: true,
        },
        take: 1,
      },
    },
  });

  if (!event || !event.isPaid) {
    throw new PaidCheckoutError("Paid event not found.", 404);
  }

  if (event.status === "closed" || event.status === "COMPLETED") {
    throw new PaidCheckoutError("Registration is closed.", 400);
  }

  const effectiveCloseAt = event.deadline ?? event.eventEndAt ?? null;
  if (effectiveCloseAt && new Date(effectiveCloseAt).getTime() < Date.now()) {
    throw new PaidCheckoutError("Registration is closed.", 400);
  }

  const ticketTier = event.ticketTiers[0];
  if (!ticketTier) {
    throw new PaidCheckoutError("Ticket tier not found.", 404);
  }

  const questions = (event.questions as EventQuestion[] | null) ?? [];
  validateRequiredAnswers(questions, attendeeAnswers);
  await validateLimitedOptions(event.id, questions, attendeeAnswers);

  const attendeeEmail = extractAttendeeEmail(questions, attendeeAnswers) ?? input.attendee.baseEmail?.trim() ?? null;
  const attendeeName = extractAttendeeName(questions, attendeeAnswers) ?? "Attendee";
  const attendeePhone = extractAttendeePhone(questions, attendeeAnswers) ?? input.mpesaPhone.trim();

  const pendingCount = await prisma.paidEventOrder.count({
    where: {
      ticketTierId: ticketTier.id,
      status: { in: ["PENDING", "PAYMENT_PENDING"] },
      holdExpiresAt: { gt: new Date() },
    },
  });

  const available = Math.max(0, ticketTier.capacity - ticketTier.soldCount - pendingCount);
  if (available <= 0) {
    const countryCode = await detectCountry(input.request as Request).catch(() => null);
    const waitlistRegistration = await joinPaidEventWaitlist({
      eventId: event.id,
      eventSlug: event.slug,
      eventTitle: event.title,
      ticketTierId: ticketTier.id,
      ticketTierWaitlistCount: ticketTier.waitlistCount,
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
      eventTitle: event.title,
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

  const holdExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const normalizedMpesaPhone = normalizeMpesaPhone(input.mpesaPhone);
  const order = await prisma.paidEventOrder.create({
    data: {
      eventId: event.id,
      ticketTierId: ticketTier.id,
      status: "PENDING",
      paymentMethod: "MPESA",
      attendeePayload: attendeeAnswers as Prisma.InputJsonValue,
      attendeeEmail,
      attendeeName,
      attendeePhone,
      amountKes: ticketTier.priceKes,
      holdExpiresAt,
      mpesaPhone: normalizedMpesaPhone,
    },
    select: { id: true },
  });

  const commission = calculatePaidEventCommission(ticketTier.priceKes, event.organizer?.plan);
  await prisma.payment.create({
    data: {
      eventId: event.id,
      paidEventOrderId: order.id,
      ticketTierId: ticketTier.id,
      amount: ticketTier.priceKes,
      commissionAmount: commission.commissionAmount,
      organizerAmount: commission.organizerAmount,
      commissionRate: commission.commissionRate,
      method: "MPESA",
      status: "PENDING",
    },
  });

  try {
    const apiRef = `paid_event_${event.slug}_${order.id}`;
    const stk = await startIntaSendStkPush({
      apiRef,
      phone: normalizedMpesaPhone,
      amountKes: ticketTier.priceKes,
      email: attendeeEmail ?? `paid-order-${order.id}@eventslot.local`,
      name: attendeeName,
    });

    await prisma.$transaction([
      prisma.paidEventOrder.update({
        where: { id: order.id },
        data: {
          status: "PAYMENT_PENDING",
          checkoutRequestId: stk.invoiceId,
          providerReference: apiRef,
          mpesaPhone: stk.normalizedPhone,
        },
      }),
      prisma.payment.updateMany({
        where: { paidEventOrderId: order.id },
        data: { status: "PENDING" },
      }),
    ]);

    return {
      kind: "checkout",
      orderId: order.id,
      checkoutRequestId: stk.invoiceId,
      eventTitle: event.title,
      ticketTierName: ticketTier.name,
      amountKes: ticketTier.priceKes,
      paymentMethod: "mpesa",
      customerMessage: "Check your phone and approve the M-Pesa prompt to complete payment.",
    };
  } catch (error) {
    await prisma.$transaction([
      prisma.paidEventOrder.update({
        where: { id: order.id },
        data: { status: "FAILED" },
      }),
      prisma.payment.updateMany({
        where: { paidEventOrderId: order.id },
        data: { status: "FAILED" },
      }),
    ]).catch(() => {});

    throw error instanceof Error ? error : new PaidCheckoutError("Payment initiation failed.", 502);
  }
}

export async function startPaidEventOrderPayment(orderId: string, mpesaPhone: string) {
  const order = await prisma.paidEventOrder.findUnique({
    where: { id: orderId },
    include: {
      event: {
        select: {
          slug: true,
          title: true,
        },
      },
      ticketTier: {
        select: {
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

  const normalizedPhone = normalizeMpesaPhone(mpesaPhone);
  const attendeeName = order.attendeeName?.trim() || "Attendee";
  const attendeeEmail = order.attendeeEmail?.trim() || `paid-order-${order.id}@eventslot.local`;
  const apiRef = order.providerReference?.trim() || `paid_event_${order.event.slug}_${order.id}`;
  const stk = await startIntaSendStkPush({
    apiRef,
    phone: normalizedPhone,
    amountKes: order.amountKes,
    email: attendeeEmail,
    name: attendeeName,
  });

  await prisma.$transaction([
    prisma.paidEventOrder.update({
      where: { id: order.id },
      data: {
        status: "PAYMENT_PENDING",
        checkoutRequestId: stk.invoiceId,
        providerReference: apiRef,
        mpesaPhone: stk.normalizedPhone,
      },
    }),
    prisma.payment.updateMany({
      where: { paidEventOrderId: order.id },
      data: { status: "PENDING" },
    }),
  ]);

  return {
    orderId: order.id,
    checkoutRequestId: stk.invoiceId,
    customerMessage: `An M-Pesa prompt has been sent for ${order.ticketTier.name}. Approve it on your phone to finish payment.`,
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

  const existingRegistrations = await prisma.registration.findMany({
    where: {
      eventId,
      status: { in: ["confirmed", "waitlist"] },
    },
    select: { answers: true },
  });

  const queuedRegistrations = existingRegistrations.map((registration) => ({
    answers: registration.answers as Array<{ questionId: string; value: string }>,
  }));

  for (const question of limitedQuestions) {
    const fullOptions = new Set(getFullOptions(question, queuedRegistrations));
    if (fullOptions.size === 0) {
      continue;
    }

    const rawAnswer = answers.find((answer) => answer.questionId === question.id)?.value ?? "";
    const selectedValues = question.type === "checkbox" ? parseCheckboxValue(rawAnswer) : [rawAnswer];
    const blockedOption = selectedValues.find((value) => fullOptions.has(value));
    if (blockedOption) {
      throw new PaidCheckoutError(`"${blockedOption}" is already full for ${question.label}. Please choose another option.`, 409);
    }
  }
}

function parseCheckboxValue(raw: string): string[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    }
  } catch {
    return raw.split("|").map((value) => value.trim()).filter(Boolean);
  }

  return [];
}

function extractAttendeeEmail(questions: EventQuestion[], answers: AttendeeAnswer[]) {
  const emailQuestion = questions.find((question) => question.type === "email");
  return emailQuestion ? answers.find((answer) => answer.questionId === emailQuestion.id)?.value?.trim() : undefined;
}

function extractAttendeeName(questions: EventQuestion[], answers: AttendeeAnswer[]) {
  const nameQuestion = questions.find((question) => question.type === "text" && question.label.toLowerCase().includes("name"));
  return nameQuestion ? answers.find((answer) => answer.questionId === nameQuestion.id)?.value?.trim() : undefined;
}

function extractAttendeePhone(questions: EventQuestion[], answers: AttendeeAnswer[]) {
  const phoneQuestion = questions.find(
    (question) => question.type === "tel" || question.type === "phone" || question.label.toLowerCase().includes("phone")
  );
  return phoneQuestion ? answers.find((answer) => answer.questionId === phoneQuestion.id)?.value?.trim() : undefined;
}
