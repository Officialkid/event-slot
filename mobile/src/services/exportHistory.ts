import { NativeEvent } from "../domain/events";
import { NativeExportHistoryEntry, NativePreparedExport } from "../domain/exports";
import { loadNativeStorageValue, removeNativeStorageValue, saveNativeStorageValue } from "./nativeStorage";

const exportHistoryStorageKey = "eventslot.native.export-history";
const exportHistoryLimit = 10;

export async function loadNativeExportHistory(eventSlug?: string): Promise<NativeExportHistoryEntry[]> {
  const history = await loadNativeStorageValue<NativeExportHistoryEntry[]>(exportHistoryStorageKey);
  const entries = history ?? [];

  if (!eventSlug) {
    return entries;
  }

  return entries.filter((entry) => entry.eventSlug === eventSlug);
}

export async function saveNativeExportHistoryEntry(
  currentHistory: NativeExportHistoryEntry[],
  event: NativeEvent,
  preparedExport: NativePreparedExport
): Promise<NativeExportHistoryEntry[]> {
  const preparedAt = new Date().toISOString();
  const nextEntry: NativeExportHistoryEntry = {
    ...preparedExport,
    eventSlug: event.slug,
    eventTitle: event.title,
    id: `${preparedAt}-${event.slug}-${preparedExport.kind}`,
    preparedAt
  };
  const allHistory = await loadNativeExportHistory();
  const unrelatedHistory = allHistory.filter((entry) => entry.eventSlug !== event.slug);
  const nextEventHistory = [nextEntry, ...currentHistory].slice(0, exportHistoryLimit);
  const nextHistory = [...nextEventHistory, ...unrelatedHistory].slice(0, exportHistoryLimit * 4);

  await saveNativeStorageValue(exportHistoryStorageKey, nextHistory);
  return nextEventHistory;
}

export async function clearNativeExportHistory(eventSlug?: string): Promise<NativeExportHistoryEntry[]> {
  if (!eventSlug) {
    await removeNativeStorageValue(exportHistoryStorageKey);
    return [];
  }

  const allHistory = await loadNativeExportHistory();
  const remainingHistory = allHistory.filter((entry) => entry.eventSlug !== eventSlug);
  await saveNativeStorageValue(exportHistoryStorageKey, remainingHistory);
  return [];
}

export function getNativeExportHistoryReadinessMessage(): string {
  return "Recent prepared exports are saved on this device so organizers can review CSV, PDF, and AI report handoffs during native QA.";
}
