import { Linking } from "react-native";

import { NativeEvent } from "../domain/events";
import { NativeExportAction, NativeExportKind, NativePreparedExport } from "../domain/exports";
import { NativeExportPrepareResponse } from "../api/contracts";
import { eventslotRequest } from "../api/client";
import { AppSession } from "../session";

const exportCopy: Record<NativeExportKind, Pick<NativeExportAction, "title" | "caption">> = {
  "confirmed-csv": {
    title: "Export confirmed CSV",
    caption: "Download confirmed registrations for follow-up or spreadsheet review."
  },
  "responses-pdf": {
    title: "Export all responses PDF",
    caption: "Prepare readable individual response PDFs for printing or sharing."
  },
  "ai-report": {
    title: "Prepare AI report",
    caption: "Generate event intelligence with attendee trends, risks, and recommendations."
  }
};

export function buildExportActions(event: NativeEvent): NativeExportAction[] {
  return (Object.keys(exportCopy) as NativeExportKind[]).map((kind) => ({
    kind,
    ...exportCopy[kind],
    endpoint: buildExportEndpoint(event.slug, kind),
    state: event.exportsReady ? "ready" : "needs-live-api"
  }));
}

export function getExportReadinessMessage(event: NativeEvent) {
  if (event.exportsReady) {
    return "Export actions are ready in demo mode. Live native downloads will use authenticated API endpoints.";
  }

  return "Exports need the live native event workspace API before downloads can run on-device.";
}

export async function prepareNativeExport(
  session: AppSession,
  event: NativeEvent,
  action: NativeExportAction
): Promise<NativeExportPrepareResponse> {
  if (session.authMode === "demo") {
    return {
      success: true,
      kind: action.kind,
      status: "ready",
      downloadUrl: `eventslot://demo-export/${event.slug}/${action.kind}`,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    };
  }

  if (!session.accessToken) {
    throw new Error("Live native exports need an authenticated native session.");
  }

  const method = action.kind === "ai-report" ? "POST" : "GET";

  return eventslotRequest<NativeExportPrepareResponse>(action.endpoint, {
    method,
    token: session.accessToken
  });
}

export function buildPreparedNativeExport(
  action: NativeExportAction,
  result: NativeExportPrepareResponse
): NativePreparedExport {
  const message =
    result.status === "preparing"
      ? `${action.title} is preparing. Job: ${result.jobId ?? "pending"}`
      : `${action.title} is ready${result.expiresAt ? ` until ${new Date(result.expiresAt).toLocaleTimeString()}` : ""}.`;

  return {
    kind: action.kind,
    title: action.title,
    message,
    status: result.status,
    downloadUrl: result.downloadUrl,
    expiresAt: result.expiresAt,
    jobId: result.jobId
  };
}

export async function openPreparedNativeExport(preparedExport: NativePreparedExport): Promise<{
  opened: boolean;
  message: string;
}> {
  if (!preparedExport.downloadUrl) {
    return {
      opened: false,
      message: "This export does not have a downloadable link yet."
    };
  }

  try {
    const canOpen = await Linking.canOpenURL(preparedExport.downloadUrl);
    if (!canOpen) {
      return {
        opened: false,
        message: "This device could not open the prepared export link."
      };
    }

    await Linking.openURL(preparedExport.downloadUrl);
    return {
      opened: true,
      message: "Opened the prepared export link."
    };
  } catch (error) {
    return {
      opened: false,
      message: error instanceof Error ? error.message : "Could not open the prepared export link."
    };
  }
}

function buildExportEndpoint(slug: string, kind: NativeExportKind) {
  const encodedSlug = encodeURIComponent(slug);

  if (kind === "confirmed-csv") {
    return `/api/native/events/${encodedSlug}/exports/confirmed.csv`;
  }

  if (kind === "responses-pdf") {
    return `/api/native/events/${encodedSlug}/exports/responses.pdf`;
  }

  return `/api/native/events/${encodedSlug}/exports/ai-report`;
}
