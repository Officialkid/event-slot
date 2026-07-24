import { NativeDeviceQaItem, NativeDeviceQaProgress, NativeDeviceQaStatus } from "../domain/deviceQa";
import { loadNativeStorageValue, removeNativeStorageValue, saveNativeStorageValue } from "./nativeStorage";

const deviceQaProgressStorageKey = "eventslot.native.device-qa-progress";

export async function loadNativeDeviceQaProgress(): Promise<NativeDeviceQaProgress> {
  return (await loadNativeStorageValue<NativeDeviceQaProgress>(deviceQaProgressStorageKey)) ?? {};
}

export async function saveNativeDeviceQaProgress(
  progress: NativeDeviceQaProgress
): Promise<NativeDeviceQaProgress> {
  await saveNativeStorageValue(deviceQaProgressStorageKey, progress);
  return progress;
}

export async function saveNativeDeviceQaItemStatus(
  currentProgress: NativeDeviceQaProgress,
  key: string,
  status: NativeDeviceQaStatus
): Promise<NativeDeviceQaProgress> {
  return saveNativeDeviceQaProgress({
    ...currentProgress,
    [key]: status
  });
}

export async function resetNativeDeviceQaItemStatus(
  currentProgress: NativeDeviceQaProgress,
  key: string
): Promise<NativeDeviceQaProgress> {
  const nextProgress = { ...currentProgress };
  delete nextProgress[key];
  return saveNativeDeviceQaProgress(nextProgress);
}

export async function clearNativeDeviceQaProgress(): Promise<void> {
  await removeNativeStorageValue(deviceQaProgressStorageKey);
}

export function applyNativeDeviceQaProgress(
  checklist: NativeDeviceQaItem[],
  progress: NativeDeviceQaProgress
): NativeDeviceQaItem[] {
  return checklist.map((item) => ({
    ...item,
    status: progress[item.key] ?? item.status
  }));
}

export function getDeviceQaProgressReadinessMessage(): string {
  return "Native device QA checklist statuses now persist locally, so Android testers can mark pass/needs-review/reset and share stronger evidence.";
}
