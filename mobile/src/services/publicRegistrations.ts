import { NativeEvent } from "../domain/events";
import { NativeRegistrationPreview, NativeRegistrationWorkspace } from "../domain/registrations";
import { NativePublicRegistrationRecord } from "../domain/publicRegistrations";
import { loadNativeStorageValue, saveNativeStorageValue } from "./nativeStorage";

const publicRegistrationStorageKey = "eventslot.native.public-registrations";

export type SavePublicRegistrationRecordInput = Omit<NativePublicRegistrationRecord, "id" | "submittedAt" | "confirmationCode"> & {
  confirmationCode?: string;
  submittedAt?: string;
};

export async function loadPublicRegistrationRecords(eventSlug: string): Promise<NativePublicRegistrationRecord[]> {
  const records = (await loadNativeStorageValue<NativePublicRegistrationRecord[]>(publicRegistrationStorageKey)) ?? [];
  return records.filter((record) => record.eventSlug === eventSlug);
}

export async function savePublicRegistrationRecord(
  input: SavePublicRegistrationRecordInput
): Promise<NativePublicRegistrationRecord[]> {
  const records = (await loadNativeStorageValue<NativePublicRegistrationRecord[]>(publicRegistrationStorageKey)) ?? [];
  const nextRecord: NativePublicRegistrationRecord = {
    ...input,
    id: `${new Date().toISOString()}-${input.eventSlug}`,
    submittedAt: input.submittedAt ?? new Date().toISOString(),
    confirmationCode: input.confirmationCode ?? buildConfirmationCode(input.eventSlug)
  };
  const nextRecords = [nextRecord, ...records];
  await saveNativeStorageValue(publicRegistrationStorageKey, nextRecords);
  return nextRecords.filter((record) => record.eventSlug === input.eventSlug);
}

export async function updatePublicRegistrationRecord(
  eventSlug: string,
  registrationId: string,
  update: Partial<Omit<NativePublicRegistrationRecord, "id" | "eventSlug" | "submittedAt">>
): Promise<NativePublicRegistrationRecord[]> {
  const records = (await loadNativeStorageValue<NativePublicRegistrationRecord[]>(publicRegistrationStorageKey)) ?? [];
  const nextRecords = records.map((record) =>
    record.id === registrationId && record.eventSlug === eventSlug
      ? {
          ...record,
          ...update
        }
      : record
  );
  await saveNativeStorageValue(publicRegistrationStorageKey, nextRecords);
  return nextRecords.filter((record) => record.eventSlug === eventSlug);
}

export function getPublicRegistrationReadinessMessage(event: NativeEvent): string {
  if (event.monetization === "paid" || event.paymentMode !== "Registration only") {
    return "Paid registration now tries the live EventSlot checkout flow first, with local fallback only while the mobile payment route is still unavailable.";
  }

  return "Free registration now submits through the live EventSlot registration API and mirrors the result locally on this device.";
}

export function mapPublicRegistrationsToWorkspace(records: NativePublicRegistrationRecord[]): NativeRegistrationWorkspace {
  const confirmed: NativeRegistrationPreview[] = [];
  const waitlist: NativeRegistrationPreview[] = [];

  for (const record of records) {
    const preview: NativeRegistrationPreview = {
      id: record.id,
      attendeeName: record.attendeeName,
      attendeeEmail: record.attendeeEmail,
      attendeePhone: record.attendeePhone,
      status: record.state === "waitlist" ? "waitlist" : "confirmed",
      submittedAtLabel: new Date(record.submittedAt).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short"
      }),
      source: "Mobile registration",
      ticketCode: record.confirmationCode,
      confirmationCode: record.confirmationCode,
      tierLabel: record.ticketTierName
        ? `${record.ticketTierName}${record.ticketPriceLabel ? ` | ${record.ticketPriceLabel}` : ""}`
        : record.ticketPriceLabel,
      answers: record.answers?.map((answer) => ({
        label: answer.label,
        value: answer.displayValue?.trim() || answer.value
      }))
    };

    if (record.state === "waitlist") {
      waitlist.push({
        ...preview,
        waitlistPosition: waitlist.length + 1
      });
    } else {
      confirmed.push(preview);
    }
  }

  return { confirmed, waitlist };
}

function buildConfirmationCode(eventSlug: string) {
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${eventSlug.slice(0, 3).toUpperCase()}-${suffix}`;
}
