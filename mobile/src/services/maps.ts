import { Linking } from "react-native";

const SUPPORTED_MAP_HOSTS = [
  "maps.app.goo.gl",
  "google.com",
  "www.google.com",
  "maps.google.com"
];

export function isSupportedMapUrl(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && SUPPORTED_MAP_HOSTS.some((host) => url.hostname.endsWith(host));
  } catch {
    return false;
  }
}

export async function openMapUrl(value: string | undefined): Promise<boolean> {
  if (!isSupportedMapUrl(value)) {
    return false;
  }

  const supported = await Linking.canOpenURL(value!);

  if (!supported) {
    return false;
  }

  await Linking.openURL(value!);
  return true;
}
