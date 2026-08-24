export type NativeInsightCardTone = "success" | "warning" | "tip" | "info" | "action";

export type NativeInsightCard = {
  id: string;
  tone: NativeInsightCardTone;
  title: string;
  body: string;
};

export type NativeInsightHistoryEntry = {
  id: string;
  eventSlug: string;
  generatedAt: string;
  cards: NativeInsightCard[];
  quotaUsed: number;
  quotaLimit: number;
};
