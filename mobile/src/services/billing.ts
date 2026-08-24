import { NativeBillingPlan, NativeBillingSnapshot, NativePaymentRecord, NativePlanOption } from "../domain/billing";
import { AppSession } from "../session";
import { loadNativeStorageValue, saveNativeStorageValue } from "./nativeStorage";

const STORAGE_KEY = "eventslot-native-billing";

const nativePlanCatalog: NativePlanOption[] = [
  {
    id: "free",
    name: "Free",
    priceLabel: "KES 0",
    priceValue: 0,
    cycle: "Monthly",
    insightQuotaLabel: "3 AI insights",
    attendeeCapLabel: "1 live event",
    payoutWindowLabel: "Standard settlement"
  },
  {
    id: "standard",
    name: "Standard",
    priceLabel: "KES 2,500",
    priceValue: 2500,
    cycle: "Monthly",
    insightQuotaLabel: "15 AI insights",
    attendeeCapLabel: "Unlimited free events",
    payoutWindowLabel: "48-hour settlement",
    featured: true
  },
  {
    id: "pro",
    name: "Pro",
    priceLabel: "KES 6,500",
    priceValue: 6500,
    cycle: "Monthly",
    insightQuotaLabel: "50 AI insights",
    attendeeCapLabel: "Unlimited paid tiers",
    payoutWindowLabel: "24-hour settlement"
  },
  {
    id: "business",
    name: "Business",
    priceLabel: "KES 15,000",
    priceValue: 15000,
    cycle: "Monthly",
    insightQuotaLabel: "Unlimited AI insights",
    attendeeCapLabel: "Team-wide workspace",
    payoutWindowLabel: "Priority settlement"
  }
];

export async function loadNativeBillingSnapshot(session: AppSession): Promise<NativeBillingSnapshot> {
  const stored = await loadNativeStorageValue<NativeBillingSnapshot>(STORAGE_KEY);
  if (stored) {
    return {
      ...stored,
      currentPlan: normalizePlanName(stored.currentPlan),
      availablePlans: nativePlanCatalog
    };
  }

  const initialSnapshot = buildDefaultBillingSnapshot(session);
  await saveNativeBillingSnapshot(initialSnapshot);
  return initialSnapshot;
}

export async function saveNativeBillingSnapshot(snapshot: NativeBillingSnapshot) {
  await saveNativeStorageValue(STORAGE_KEY, snapshot);
  return snapshot;
}

export async function startNativePlanUpgrade(
  snapshot: NativeBillingSnapshot,
  planId: string,
  phone: string
): Promise<NativeBillingSnapshot> {
  const plan = nativePlanCatalog.find((option) => option.id === planId);
  if (!plan) {
    throw new Error("Choose a valid billing plan.");
  }

  if (!phone.trim()) {
    throw new Error("Enter an M-Pesa phone number to continue.");
  }

  const nextSnapshot: NativeBillingSnapshot = {
    ...snapshot,
    lastPayment:
      plan.priceValue === 0
        ? snapshot.lastPayment
        : buildPaymentRecord(plan.name, plan.priceLabel, phone, "pending")
  };

  await saveNativeBillingSnapshot(nextSnapshot);
  return nextSnapshot;
}

export async function pollNativePlanUpgradeStatus(
  snapshot: NativeBillingSnapshot,
  paymentId: string
): Promise<NativeBillingSnapshot> {
  const lastPayment = snapshot.lastPayment;

  if (!lastPayment || lastPayment.id !== paymentId) {
    throw new Error("The current payment preview could not be found.");
  }

  if (lastPayment.status === "completed") {
    return snapshot;
  }

  const nextPollCount = (lastPayment.pollCount ?? 0) + 1;
  const shouldComplete = nextPollCount >= 2;
  const completedPlan = nativePlanCatalog.find((option) => option.name === lastPayment.planName);

  const nextSnapshot: NativeBillingSnapshot = {
    ...snapshot,
    currentPlan: shouldComplete && completedPlan ? completedPlan.name : snapshot.currentPlan,
    billingCycleLabel: shouldComplete && completedPlan ? `${completedPlan.cycle} billing` : snapshot.billingCycleLabel,
    renewalDateLabel:
      shouldComplete && completedPlan
        ? completedPlan.priceValue === 0
          ? "No renewal"
          : buildRenewalLabel(30)
        : snapshot.renewalDateLabel,
    paygEnabled: shouldComplete && completedPlan ? completedPlan.name !== "Free" : snapshot.paygEnabled,
    lastPayment: {
      ...lastPayment,
      paidAtLabel: shouldComplete
        ? new Date().toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
            year: "numeric"
          })
        : lastPayment.paidAtLabel,
      pollCount: nextPollCount,
      status: shouldComplete ? "completed" : "pending"
    }
  };

  await saveNativeBillingSnapshot(nextSnapshot);
  return nextSnapshot;
}

export function buildDefaultBillingSnapshot(session: AppSession): NativeBillingSnapshot {
  const currentPlan = normalizePlanName(session.plan);

  return {
    currentPlan,
    renewalDateLabel: currentPlan === "Free" ? "No renewal" : buildRenewalLabel(30),
    billingCycleLabel: currentPlan === "Free" ? "Starter access" : "Monthly billing",
    paygEnabled: currentPlan !== "Free",
    paygCapLabel: currentPlan === "Business" ? "KES 250,000" : currentPlan === "Pro" ? "KES 120,000" : "KES 35,000",
    paygUsageLabel:
      currentPlan === "Free"
        ? "KES 0 of KES 35,000"
        : `KES ${Math.min(session.tokenBalance * 25, 14500).toLocaleString()} of ${
            currentPlan === "Business" ? "KES 250,000" : currentPlan === "Pro" ? "KES 120,000" : "KES 35,000"
          }`,
    paygWarningThreshold: 80,
    paygAutoPause: currentPlan !== "Free",
    availablePlans: nativePlanCatalog,
    lastPayment:
      currentPlan === "Free"
        ? undefined
        : {
            id: "seed-payment",
            planName: currentPlan,
            amountLabel:
              currentPlan === "Business" ? "KES 15,000" : currentPlan === "Pro" ? "KES 6,500" : "KES 2,500",
            paidAtLabel: "12 Jul 2026",
            phone: "07xxxxxxx82",
            paymentReference: "MPESA-EVS-SEED",
            status: "completed"
          }
  };
}

function buildPaymentRecord(
  planName: NativeBillingPlan,
  amountLabel: string,
  phone: string,
  status: NativePaymentRecord["status"]
): NativePaymentRecord {
  const dateLabel = new Date().toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });

  return {
    id: `payment-${Date.now()}`,
    planName,
    amountLabel,
    paidAtLabel: status === "completed" ? dateLabel : "Awaiting confirmation",
    phone,
    paymentReference: `MPESA-EVS-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    pollCount: status === "pending" ? 0 : undefined,
    status
  };
}

function buildRenewalLabel(daysFromNow: number) {
  const renewal = new Date();
  renewal.setDate(renewal.getDate() + daysFromNow);
  return renewal.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function normalizePlanName(plan: string): NativeBillingPlan {
  const normalized = plan.trim().toLowerCase();
  if (normalized === "standard") return "Standard";
  if (normalized === "pro") return "Pro";
  if (normalized === "business") return "Business";
  return "Free";
}
