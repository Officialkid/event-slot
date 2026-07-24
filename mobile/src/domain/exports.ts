export type NativeExportKind = "confirmed-csv" | "responses-pdf" | "ai-report";

export type NativeExportState = "ready" | "needs-live-api" | "preparing";

export type NativeExportAction = {
  kind: NativeExportKind;
  title: string;
  caption: string;
  state: NativeExportState;
  endpoint: string;
};

export type NativePreparedExport = {
  kind: NativeExportKind;
  title: string;
  message: string;
  status: "ready" | "preparing";
  downloadUrl?: string;
  expiresAt?: string;
  jobId?: string;
};

export type NativeExportHistoryEntry = NativePreparedExport & {
  id: string;
  eventSlug: string;
  eventTitle: string;
  preparedAt: string;
};
