import { Linking } from "react-native";

const SUPPORTED_MAP_HOSTS = [
  "maps.app.goo.gl",
  "google.com",
  "www.google.com",
  "maps.google.com"
];

export type NativeMapAction = {
  label: string;
  url?: string;
  source: "organiser-link" | "venue-search" | "missing";
  ready: boolean;
};

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

export function buildGoogleMapsSearchUrl(venue: string | undefined): string | undefined {
  const query = venue?.trim();
  if (!query) {
    return undefined;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function buildNativeMapAction(input: {
  mapDirectionsUrl?: string;
  venue?: string;
}): NativeMapAction {
  if (isSupportedMapUrl(input.mapDirectionsUrl)) {
    return {
      label: "Open organiser directions",
      ready: true,
      source: "organiser-link",
      url: input.mapDirectionsUrl
    };
  }

  const searchUrl = buildGoogleMapsSearchUrl(input.venue);
  if (searchUrl) {
    return {
      label: "Search venue on Maps",
      ready: true,
      source: "venue-search",
      url: searchUrl
    };
  }

  return {
    label: "Add venue for Maps",
    ready: false,
    source: "missing"
  };
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
