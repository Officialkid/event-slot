import { Share } from "react-native";

export type NativeSharePayload = {
  title: string;
  message: string;
  url?: string;
};

export async function shareNativePayload(payload: NativeSharePayload): Promise<boolean> {
  const result = await Share.share({
    title: payload.title,
    message: payload.url ? `${payload.message}\n${payload.url}` : payload.message,
    url: payload.url
  });

  return result.action === Share.sharedAction;
}
