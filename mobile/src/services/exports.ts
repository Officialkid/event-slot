import { NativeEvent } from "../domain/events";
import { NativeExportAction, NativeExportKind } from "../domain/exports";
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
