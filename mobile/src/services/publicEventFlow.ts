import { apiBaseUrl } from "../api/client";
import { NativePublicRegistrationAnswer } from "../domain/publicRegistrations";

type RegisterAttendeePayload = {
  answers: Array<{ questionId: string; value: string }>;
  baseEmail?: string;
};

type RegisterSuccessResult = {
  status: "confirmed" | "waitlist";
  waitlistPosition?: number;
  registrationId: string;
  registrationNumber?: number;
  confirmationCode?: string;
};

type RegisterResponse =
  | {
      success: true;
      results: RegisterSuccessResult[];
      eventTitle: string;
    }
  | {
      success: false;
      error?: string;
      duplicate?: boolean;
      attendeeIndex?: number;
      questionId?: string;
      option?: string;
    };

type PaidCheckoutResponse =
  | {
      success: true;
      orderId: string;
      checkoutRequestId: string;
      url?: string;
      customerMessage: string;
      amountKes: number;
      eventTitle: string;
      ticketTierName: string;
      paymentMethod: "mpesa" | "paystack";
    }
  | {
      success: true;
      results: RegisterSuccessResult[];
      eventTitle: string;
    }
  | {
      success: false;
      error?: string;
    };

type PaidOrderStatusResponse =
  | {
      success: true;
      status: string;
      confirmationCode: string | null;
      registrationId: string | null;
      eventTitle: string;
      eventSlug: string;
      ticketTierName: string;
      amountKes: number;
      attendeeEmail: string | null;
      holdExpiresAt: string;
    }
  | {
      success: false;
      error?: string;
    };

export type SubmitPublicRegistrationInput = {
  eventSlug: string;
  attendeeEmail: string;
  answers: NativePublicRegistrationAnswer[];
  consentDataProcessing: boolean;
  source?: string;
};

export type SubmitPublicRegistrationResult =
  | {
      kind: "confirmed" | "waitlist";
      registrationId: string;
      confirmationCode?: string;
      waitlistPosition?: number;
    }
  | {
      kind: "duplicate";
      error: string;
    };

export type StartPaidCheckoutInput = SubmitPublicRegistrationInput & {
  ticketTierId: string;
  attendeePhone: string;
};

export type StartPaidCheckoutResult =
  | {
      kind: "checkout";
      orderId: string;
      checkoutRequestId: string;
      customerMessage: string;
    }
  | {
      kind: "waitlist";
      registrationId: string;
      waitlistPosition?: number;
    }
  | {
      kind: "unavailable";
      error: string;
    };

export async function submitPublicRegistration(input: SubmitPublicRegistrationInput): Promise<SubmitPublicRegistrationResult> {
  const attendee = buildBackendAttendeePayload(input.answers, input.attendeeEmail);
  const response = await fetchJson<RegisterResponse>("/api/register", {
    method: "POST",
    body: {
      eventSlug: input.eventSlug,
      attendees: [attendee],
      consentDataProcessing: input.consentDataProcessing,
      consentTransactional: true,
      consentMarketing: false,
      sendResponseCopy: false,
      source: input.source ?? "mobile-app"
    }
  });

  if (!response.success) {
    if (response.duplicate) {
      return {
        kind: "duplicate",
        error: "This attendee appears to be registered already."
      };
    }

    throw new Error(response.error ?? "Registration failed.");
  }

  const result = response.results[0];
  return {
    kind: result.status,
    registrationId: result.registrationId,
    confirmationCode: result.confirmationCode,
    waitlistPosition: result.waitlistPosition
  };
}

export async function startPaidCheckout(input: StartPaidCheckoutInput): Promise<StartPaidCheckoutResult> {
  const attendee = buildBackendAttendeePayload(input.answers, input.attendeeEmail);
  const response = await fetchJson<PaidCheckoutResponse>("/api/paid-events/checkout", {
    method: "POST",
    body: {
      eventSlug: input.eventSlug,
      ticketTierId: input.ticketTierId,
      attendee,
      consentDataProcessing: input.consentDataProcessing,
      consentTransactional: true,
      consentMarketing: false,
      sendResponseCopy: false,
      paymentMethod: "mpesa",
      mpesaPhone: input.attendeePhone,
      source: input.source ?? "mobile-app"
    }
  });

  if (!response.success) {
    return {
      kind: "unavailable",
      error: response.error ?? "Paid checkout is unavailable right now."
    };
  }

  if ("results" in response) {
    const result = response.results[0];
    return {
      kind: "waitlist",
      registrationId: result.registrationId,
      waitlistPosition: result.waitlistPosition
    };
  }

  return {
    kind: "checkout",
    orderId: response.orderId,
    checkoutRequestId: response.checkoutRequestId,
    customerMessage: response.customerMessage
  };
}

export async function pollPaidOrderStatus(orderId: string): Promise<PaidOrderStatusResponse> {
  return fetchJson<PaidOrderStatusResponse>(`/api/paid-events/orders/${encodeURIComponent(orderId)}`, {
    method: "GET"
  });
}

function buildBackendAttendeePayload(answers: NativePublicRegistrationAnswer[], attendeeEmail: string): RegisterAttendeePayload {
  const normalizedAnswers = answers.map((answer) => ({
    questionId: answer.questionId,
    value: answer.value
  }));

  const hasEmailQuestion = normalizedAnswers.some((answer) => answer.questionId.toLowerCase().includes("email"));
  return {
    answers: normalizedAnswers,
    ...(hasEmailQuestion ? {} : { baseEmail: attendeeEmail })
  };
}

async function fetchJson<T>(
  path: string,
  options: {
    method: "GET" | "POST";
    body?: unknown;
  }
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  const parsed = text ? safeJsonParse<T>(text) : null;

  if (!response.ok) {
    if (parsed && typeof parsed === "object" && parsed !== null && "error" in (parsed as Record<string, unknown>)) {
      throw new Error(String((parsed as Record<string, unknown>).error ?? `EventSlot request failed with ${response.status}`));
    }

    throw new Error(text || `EventSlot request failed with ${response.status}`);
  }

  if (parsed == null) {
    throw new Error("EventSlot returned an empty response.");
  }

  return parsed;
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
