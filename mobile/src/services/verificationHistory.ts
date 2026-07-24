import { NativeEvent } from "../domain/events";
import {
  NativeVerificationHistoryEntry,
  NativeVerificationHistoryMethod,
  VerificationResult
} from "../domain/verification";
import { loadNativeStorageValue, removeNativeStorageValue, saveNativeStorageValue } from "./nativeStorage";

const verificationHistoryStorageKey = "eventslot.native.verification-history";
const verificationHistoryLimit = 12;

export async function loadNativeVerificationHistory(): Promise<NativeVerificationHistoryEntry[]> {
  const history = await loadNativeStorageValue<NativeVerificationHistoryEntry[]>(verificationHistoryStorageKey);
  return history ?? [];
}

export async function saveNativeVerificationHistoryEntry(
  currentHistory: NativeVerificationHistoryEntry[],
  input: {
    event: NativeEvent;
    lookupValue: string;
    method: NativeVerificationHistoryMethod;
    result: VerificationResult;
  }
): Promise<NativeVerificationHistoryEntry[]> {
  const nextEntry = buildNativeVerificationHistoryEntry(input);
  const nextHistory = [nextEntry, ...currentHistory].slice(0, verificationHistoryLimit);
  await saveNativeStorageValue(verificationHistoryStorageKey, nextHistory);
  return nextHistory;
}

export async function clearNativeVerificationHistory(): Promise<void> {
  await removeNativeStorageValue(verificationHistoryStorageKey);
}

export function getVerificationHistoryReadinessMessage(): string {
  return "Recent native verification attempts are saved on this device so door teams can review the latest manual and camera checks during Android QA.";
}

function buildNativeVerificationHistoryEntry(input: {
  event: NativeEvent;
  lookupValue: string;
  method: NativeVerificationHistoryMethod;
  result: VerificationResult;
}): NativeVerificationHistoryEntry {
  const checkedAt = new Date().toISOString();

  return {
    attendeeName: input.result.ticket?.attendeeName,
    checkedAt,
    eventSlug: input.event.slug,
    eventTitle: input.event.title,
    id: `${checkedAt}-${input.event.slug}-${input.method}`,
    lookupValue: input.lookupValue.trim() || "No lookup value",
    message: input.result.message,
    method: input.method,
    status: input.result.status,
    ticketCode: input.result.ticket?.ticketCode
  };
}
