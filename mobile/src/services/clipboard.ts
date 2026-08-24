import * as Clipboard from "expo-clipboard";

export async function copyTextToClipboard(value: string): Promise<boolean> {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  try {
    await Clipboard.setStringAsync(trimmed);
    return true;
  } catch {
    return false;
  }
}
