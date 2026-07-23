import { Linking } from "react-native";

export const supportLinks = {
  privacyPolicy: "https://www.eventsslot.com/privacy",
  terms: "https://www.eventsslot.com/terms",
  website: "https://www.eventsslot.com",
  testerSupport: "mailto:eventslot.co@gmail.com?subject=EventSlot%20native%20app%20support"
} as const;

export async function openSupportLink(url: string): Promise<boolean> {
  if (!url) {
    return false;
  }

  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) {
    return false;
  }

  await Linking.openURL(url);
  return true;
}

export function getAccountDeletionReadinessMessage() {
  return "Account deletion must open a hosted policy and call the live authenticated deletion API before native release.";
}
