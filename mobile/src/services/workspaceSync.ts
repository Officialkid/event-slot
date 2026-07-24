import { NativeEvent } from "../domain/events";
import { AppSession } from "../session";

export type NativeWorkspaceSyncSummary = {
  caption: string;
  status: "ready" | "loading" | "error" | "demo";
  title: string;
};

export function buildNativeWorkspaceSyncSummary(input: {
  events: NativeEvent[];
  error: string | null;
  lastSyncedAt: string | null;
  loading: boolean;
  session: AppSession;
}): NativeWorkspaceSyncSummary {
  if (input.loading) {
    return {
      caption: "Refreshing native dashboard, events, verifier, and event detail data.",
      status: "loading",
      title: "Syncing workspace"
    };
  }

  if (input.error) {
    return {
      caption: input.error,
      status: "error",
      title: "Workspace sync needs review"
    };
  }

  const syncedAt = formatNativeWorkspaceSyncTime(input.lastSyncedAt);

  if (input.session.authMode === "demo") {
    return {
      caption: `${input.events.length} demo event${input.events.length === 1 ? "" : "s"} loaded. Last refresh: ${syncedAt}.`,
      status: "demo",
      title: "Demo workspace"
    };
  }

  return {
    caption: `${input.events.length} live event${input.events.length === 1 ? "" : "s"} loaded from EventSlot. Last sync: ${syncedAt}.`,
    status: "ready",
    title: "Live workspace synced"
  };
}

export function getNativeWorkspaceSyncReadinessMessage(): string {
  return "Native workspace sync now shows the current data source, event count, last refresh time, and retry action so Android QA can prove live API loading.";
}

function formatNativeWorkspaceSyncTime(value: string | null): string {
  if (!value) {
    return "not synced yet";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "recently";
  }

  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  });
}
