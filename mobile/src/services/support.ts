import { Linking } from "react-native";
import { AppSession } from "../session";

export const supportLinks = {
  privacyPolicy: "https://www.eventsslot.com/privacy",
  terms: "https://www.eventsslot.com/terms",
  accountDeletion: "https://www.eventsslot.com/account-deletion",
  website: "https://www.eventsslot.com",
  testerSupport: "mailto:eventslot.co@gmail.com?subject=EventSlot%20native%20app%20support"
} as const;

export async function openSupportLink(url: string): Promise<boolean> {
  if (!url) {
    return false;
  }

  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

export function getAccountDeletionReadinessMessage() {
  return "Native account deletion now opens the hosted deletion policy and can prepare an email request. A direct authenticated in-app deletion API remains gated before public release.";
}

export function buildAccountDeletionRequestUrl(session: AppSession): string {
  const subject = "Delete my EventSlot account";
  const body = [
    "Hello EventSlot team,",
    "",
    "I am requesting deletion of my EventSlot account and associated personal data where legally and operationally allowed.",
    "",
    `Account email: ${session.email}`,
    `Display name: ${session.displayName}`,
    "App: EventSlot native mobile app",
    "",
    "Please confirm any verification steps needed to process this request.",
    "",
    "Thank you."
  ].join("\n");

  return `mailto:info@eventsslot.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export async function openAccountDeletionPolicy(): Promise<boolean> {
  return openSupportLink(supportLinks.accountDeletion);
}

export async function requestAccountDeletionByEmail(session: AppSession): Promise<boolean> {
  return openSupportLink(buildAccountDeletionRequestUrl(session));
}
