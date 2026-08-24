export type NativeBillingPlan = "Free" | "Standard" | "Pro" | "Business";

export type NativePlanCycle = "Monthly" | "Annual";

export type NativePlanOption = {
  id: string;
  name: NativeBillingPlan;
  priceLabel: string;
  priceValue: number;
  cycle: NativePlanCycle;
  insightQuotaLabel: string;
  attendeeCapLabel: string;
  payoutWindowLabel: string;
  featured?: boolean;
};

export type NativePaymentRecord = {
  id: string;
  planName: NativeBillingPlan;
  amountLabel: string;
  paidAtLabel: string;
  phone: string;
  paymentReference: string;
  pollCount?: number;
  status: "pending" | "completed";
};

export type NativeBillingSnapshot = {
  currentPlan: NativeBillingPlan;
  renewalDateLabel: string;
  billingCycleLabel: string;
  paygEnabled: boolean;
  paygCapLabel: string;
  paygUsageLabel: string;
  paygWarningThreshold: number;
  paygAutoPause: boolean;
  availablePlans: NativePlanOption[];
  lastPayment?: NativePaymentRecord;
};
