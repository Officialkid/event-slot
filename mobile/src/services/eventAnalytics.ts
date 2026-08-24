import { NativeEventWorkspaceResponse } from "../api/contracts";
import { NativeEvent } from "../domain/events";

export type AnalyticsRange = "7d" | "30d" | "all";

export type NativeAnalyticsPoint = {
  label: string;
  value: number;
};

export type NativeAnalyticsSource = {
  label: string;
  count: number;
};

export type NativeEventAnalytics = {
  attendanceRate: number;
  fillRate: number;
  waitlistConversionRate: number;
  averageRegistrationsPerBucket: number;
  registrationsSeries: NativeAnalyticsPoint[];
  sourceBreakdown: NativeAnalyticsSource[];
  strongestSource?: string;
  grossRevenueLabel: string;
};

export function buildEventAnalytics(
  event: NativeEvent,
  workspace: NativeEventWorkspaceResponse | null,
  range: AnalyticsRange
): NativeEventAnalytics {
  const registrations: Array<{ submittedAt: string; source?: string | null }> = workspace
    ? [...workspace.confirmed, ...workspace.waitlist]
    : buildFallbackRegistrations(event);
  const filteredRegistrations = filterRegistrationsByRange(registrations, range);
  const totalRegistrations = Math.max(1, event.attendees + event.waitlist);
  const fillRate = event.capacity > 0 ? Math.min(100, Math.round((event.attendees / event.capacity) * 100)) : 100;
  const attendanceRate = event.capacity > 0 ? fillRate : event.attendees > 0 ? 100 : 0;
  const waitlistConversionRate = Math.round((event.attendees / totalRegistrations) * 100);
  const registrationsSeries = buildRegistrationSeries(filteredRegistrations, range);
  const sourceBreakdown = buildSourceBreakdown(filteredRegistrations);
  const averageRegistrationsPerBucket =
    registrationsSeries.length > 0
      ? Math.round((registrationsSeries.reduce((sum, point) => sum + point.value, 0) / registrationsSeries.length) * 10) / 10
      : 0;

  return {
    attendanceRate,
    fillRate,
    waitlistConversionRate,
    averageRegistrationsPerBucket,
    registrationsSeries,
    sourceBreakdown,
    strongestSource: sourceBreakdown[0]?.label,
    grossRevenueLabel: buildRevenueLabel(event)
  };
}

function filterRegistrationsByRange<
  T extends {
    submittedAt: string;
  }
>(registrations: T[], range: AnalyticsRange): T[] {
  if (range === "all") {
    return registrations;
  }

  const days = range === "7d" ? 7 : 30;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  return registrations.filter((registration) => {
    const timestamp = Date.parse(registration.submittedAt);
    return Number.isNaN(timestamp) ? false : timestamp >= cutoff;
  });
}

function buildRegistrationSeries<
  T extends {
    submittedAt: string;
  }
>(registrations: T[], range: AnalyticsRange): NativeAnalyticsPoint[] {
  const bucketCount = range === "7d" ? 7 : range === "30d" ? 6 : 5;
  const buckets = new Map<string, number>();

  if (registrations.length === 0) {
    return Array.from({ length: bucketCount }, (_, index) => ({
      label: range === "7d" ? `D${index + 1}` : range === "30d" ? `W${index + 1}` : `P${index + 1}`,
      value: 0
    }));
  }

  for (const registration of registrations) {
    const date = new Date(registration.submittedAt);
    if (Number.isNaN(date.getTime())) {
      continue;
    }

    const label =
      range === "7d"
        ? date.toLocaleDateString(undefined, { weekday: "short" })
        : range === "30d"
          ? `Week ${Math.max(1, Math.ceil(date.getDate() / 7))}`
          : date.toLocaleDateString(undefined, { month: "short" });

    buckets.set(label, (buckets.get(label) ?? 0) + 1);
  }

  return Array.from(buckets.entries())
    .slice(-bucketCount)
    .map(([label, value]) => ({ label, value }));
}

function buildSourceBreakdown<
  T extends {
    source?: string | null;
  }
>(registrations: T[]): NativeAnalyticsSource[] {
  const counts = new Map<string, number>();

  for (const registration of registrations) {
    const label = normalizeSourceLabel(registration.source);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));
}

function normalizeSourceLabel(value: string | null | undefined): string {
  const raw = value?.trim().toLowerCase();
  if (!raw) return "Direct";
  if (raw.includes("instagram")) return "Instagram";
  if (raw.includes("tiktok")) return "TikTok";
  if (raw.includes("word")) return "Word of Mouth";
  if (raw.includes("whatsapp")) return "WhatsApp";
  if (raw.includes("email")) return "Email";
  return raw
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildRevenueLabel(event: NativeEvent): string {
  if (event.monetization !== "paid" && event.paymentMode === "Registration only") {
    return "Free event";
  }

  if (event.standardPrice) {
    const parsed = Number.parseFloat(event.standardPrice.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(parsed) && parsed > 0) {
      return `KES ${(parsed * event.attendees).toLocaleString()}`;
    }
  }

  return event.entryFeeLabel ?? "Paid event";
}

function buildFallbackRegistrations(event: NativeEvent) {
  const total = Math.max(event.attendees + event.waitlist, 1);

  return Array.from({ length: total }, (_, index) => {
    const daysAgo = total - index;
    const submittedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
    const sources = ["Instagram", "WhatsApp", "Word of Mouth", "Direct"];

    return {
      submittedAt,
      source: sources[index % sources.length]
    };
  });
}
