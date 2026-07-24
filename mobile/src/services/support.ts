import { Linking } from "react-native";

import { NativeConnectivityProbeResult, NativeDeviceQaItem } from "../domain/deviceQa";
import { NativeRuntimeInfoItem } from "../domain/runtimeInfo";
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

export function buildNativeComplianceLinkItems(): Array<{
  key: keyof typeof supportLinks;
  title: string;
  url: string;
}> {
  return [
    {
      key: "privacyPolicy",
      title: "Privacy policy",
      url: supportLinks.privacyPolicy
    },
    {
      key: "terms",
      title: "Terms of service",
      url: supportLinks.terms
    },
    {
      key: "accountDeletion",
      title: "Account deletion",
      url: supportLinks.accountDeletion
    },
    {
      key: "website",
      title: "Website",
      url: supportLinks.website
    },
    {
      key: "testerSupport",
      title: "Tester support",
      url: supportLinks.testerSupport
    }
  ];
}

export function getNativeComplianceLinksReadinessMessage(): string {
  return "Hosted policy, account deletion, website, and support links are grouped here so testers can verify store-required destinations before any native upload.";
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

export function buildNativeTesterFeedbackEmailUrl(params: {
  checklist: NativeDeviceQaItem[];
  connectivityProbe: NativeConnectivityProbeResult | null;
  eventsCount: number;
  runtimeInfo: NativeRuntimeInfoItem[];
  session: AppSession;
}): string {
  const subject = "EventSlot native app tester feedback";
  const runtimeLines = params.runtimeInfo.map((item) => `- ${item.label}: ${item.value}`);
  const checklistLines = params.checklist.map((item) => `- ${item.title}: ${item.status}`);
  const connectivity = params.connectivityProbe
    ? `${params.connectivityProbe.status} - ${params.connectivityProbe.message}`
    : "Not checked yet";
  const body = [
    "Hello EventSlot team,",
    "",
    "I am sharing feedback from the EventSlot native mobile app test.",
    "",
    "Tester details",
    `Account email: ${params.session.email}`,
    `Display name: ${params.session.displayName}`,
    `Session mode: ${params.session.authMode}`,
    `Events visible in app: ${params.eventsCount}`,
    "",
    "Device details",
    "Phone model:",
    "Android/iOS version:",
    "Network used: Wi-Fi / mobile data",
    "",
    "What I tested",
    "- Sign in:",
    "- Dashboard:",
    "- Events:",
    "- Ticket verification:",
    "- Profile/settings:",
    "- Theme switching:",
    "- Maps/files/push, if tested:",
    "",
    "Issue or feedback",
    "What happened:",
    "What I expected:",
    "Steps to repeat:",
    "Screenshot/video attached: Yes / No",
    "",
    "Native runtime",
    ...runtimeLines,
    "",
    "Connectivity",
    connectivity,
    "",
    "QA checklist status",
    ...checklistLines,
    "",
    "Thank you."
  ].join("\n");

  return `mailto:eventslot.co@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export async function openAccountDeletionPolicy(): Promise<boolean> {
  return openSupportLink(supportLinks.accountDeletion);
}

export async function requestAccountDeletionByEmail(session: AppSession): Promise<boolean> {
  return openSupportLink(buildAccountDeletionRequestUrl(session));
}
