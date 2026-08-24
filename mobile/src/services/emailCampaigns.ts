import { EmailRecipientFilter, NativeEmailCampaignHistoryEntry, NativeEmailTemplate } from "../domain/emailCampaigns";
import { NativeRegistrationWorkspace } from "../domain/registrations";
import { loadNativeStorageValue, removeNativeStorageValue, saveNativeStorageValue } from "./nativeStorage";

const emailCampaignHistoryStorageKey = "eventslot.native.email-campaign-history";
const emailCampaignHistoryLimit = 16;

export const nativeEmailTemplates: NativeEmailTemplate[] = [
  {
    id: "event-reminder",
    label: "Event reminder",
    subject: "Reminder: your event is coming up",
    message: "Hi there,\n\nWe are looking forward to seeing you soon. Please keep your confirmation details ready and arrive on time.\n\nEventSlot",
    recipientFilter: "confirmed"
  },
  {
    id: "waitlist-update",
    label: "Waitlist update",
    subject: "Update on your waitlist status",
    message: "Hi there,\n\nThank you for joining the waitlist. We will notify you if a spot opens up.\n\nEventSlot",
    recipientFilter: "waitlist"
  },
  {
    id: "general-announcement",
    label: "General announcement",
    subject: "Important event update",
    message: "Hi there,\n\nWe have an important update for this event. Please review the latest details before attending.\n\nEventSlot",
    recipientFilter: "all"
  }
];

export async function loadNativeEmailCampaignHistory(eventSlug: string): Promise<NativeEmailCampaignHistoryEntry[]> {
  const history = await loadNativeStorageValue<NativeEmailCampaignHistoryEntry[]>(emailCampaignHistoryStorageKey);
  return (history ?? []).filter((entry) => entry.eventSlug === eventSlug);
}

export async function saveNativeEmailCampaignHistoryEntry(
  currentHistory: NativeEmailCampaignHistoryEntry[],
  input: {
    eventSlug: string;
    subject: string;
    message: string;
    recipientFilter: EmailRecipientFilter;
    recipientCount: number;
    templateLabel?: string;
  }
): Promise<NativeEmailCampaignHistoryEntry[]> {
  const allHistory = (await loadNativeStorageValue<NativeEmailCampaignHistoryEntry[]>(emailCampaignHistoryStorageKey)) ?? [];
  const nextEntry: NativeEmailCampaignHistoryEntry = {
    id: `${new Date().toISOString()}-${input.eventSlug}-${input.recipientFilter}`,
    eventSlug: input.eventSlug,
    subject: input.subject.trim(),
    message: input.message.trim(),
    recipientFilter: input.recipientFilter,
    recipientCount: input.recipientCount,
    sentAt: new Date().toISOString(),
    templateLabel: input.templateLabel
  };
  const nextHistory = [nextEntry, ...allHistory].slice(0, emailCampaignHistoryLimit);
  await saveNativeStorageValue(emailCampaignHistoryStorageKey, nextHistory);
  return nextHistory.filter((entry) => entry.eventSlug === input.eventSlug);
}

export async function clearNativeEmailCampaignHistory(): Promise<void> {
  await removeNativeStorageValue(emailCampaignHistoryStorageKey);
}

export function getNativeEmailCampaignReadinessMessage(): string {
  return "Email campaign drafts and send history can now be reviewed on this device per event while backend delivery wiring is still pending.";
}

export function getRecipientCount(workspace: NativeRegistrationWorkspace, filter: EmailRecipientFilter): number {
  if (filter === "confirmed") {
    return workspace.confirmed.length;
  }

  if (filter === "waitlist") {
    return workspace.waitlist.length;
  }

  return workspace.confirmed.length + workspace.waitlist.length;
}
