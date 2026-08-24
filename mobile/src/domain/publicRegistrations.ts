export type NativePublicRegistrationState = "draft" | "waitlist" | "payment-pending" | "confirmed";

export type NativePublicRegistrationAnswer = {
  questionId: string;
  label: string;
  value: string;
  displayValue?: string;
};

export type NativePublicRegistrationRecord = {
  id: string;
  eventSlug: string;
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone: string;
  backendRegistrationId?: string;
  ticketTierName?: string;
  ticketPriceLabel?: string;
  state: NativePublicRegistrationState;
  submittedAt: string;
  confirmationCode: string;
  paymentOrderId?: string;
  checkoutRequestId?: string;
  paymentReference?: string;
  paymentConfirmedAt?: string;
  answers?: NativePublicRegistrationAnswer[];
};
