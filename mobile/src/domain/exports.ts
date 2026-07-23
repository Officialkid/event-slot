export type NativeExportKind = "confirmed-csv" | "responses-pdf" | "ai-report";

export type NativeExportState = "ready" | "needs-live-api" | "preparing";

export type NativeExportAction = {
  kind: NativeExportKind;
  title: string;
  caption: string;
  state: NativeExportState;
  endpoint: string;
};
