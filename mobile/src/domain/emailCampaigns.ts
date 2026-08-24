export type EmailRecipientFilter = "all" | "confirmed" | "waitlist";

export type NativeEmailTemplate = {
  id: string;
  label: string;
  subject: string;
  message: string;
  recipientFilter: EmailRecipientFilter;
};

export type NativeEmailCampaignHistoryEntry = {
  id: string;
  eventSlug: string;
  subject: string;
  message: string;
  recipientFilter: EmailRecipientFilter;
  recipientCount: number;
  sentAt: string;
  templateLabel?: string;
};
