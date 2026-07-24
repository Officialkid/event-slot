export type NativeDashboardInsightTone = "ready" | "attention" | "blocked";

export type NativeDashboardInsight = {
  key: string;
  title: string;
  caption: string;
  actionLabel: string;
  target: "events" | "verify" | "createEvent";
  tone: NativeDashboardInsightTone;
};
