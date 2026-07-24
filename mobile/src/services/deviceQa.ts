import { apiBaseUrl } from "../api/client";
import { AppSession } from "../session";
import { NativeConnectivityProbeResult, NativeDeviceQaItem } from "../domain/deviceQa";
import { NativeReadinessItem } from "../domain/settings";
import { NativeRuntimeInfoItem } from "../domain/runtimeInfo";

export function buildNativeDeviceQaChecklist(session: AppSession, eventsCount: number): NativeDeviceQaItem[] {
  return [
    {
      key: "launch",
      title: "App launch",
      expected: "Open the native app from the launcher and confirm it reaches the EventSlot shell without a blank screen.",
      status: "pending"
    },
    {
      key: "auth",
      title: "Native sign-in",
      expected: session.authMode === "live"
        ? `Confirm ${session.email} signs in, restores after app restart, and logs out cleanly.`
        : "Switch to live mode before final auth QA; demo mode only proves the shell.",
      status: session.authMode === "live" ? "needs-review" : "blocked"
    },
    {
      key: "events",
      title: "Event workspace",
      expected: `Confirm dashboard and events load correctly. Current native event count: ${eventsCount}.`,
      status: session.authMode === "live" && eventsCount > 0 ? "needs-review" : "pending"
    },
    {
      key: "scanner",
      title: "Ticket scanner",
      expected: "Grant camera permission, scan a real EventSlot ticket QR, reject duplicates, and confirm manual lookup still works.",
      status: "needs-review"
    },
    {
      key: "offline-drafts",
      title: "Offline draft restore",
      expected: "Create an event draft, close the app, reopen it, and confirm the draft plus last-saved time are restored.",
      status: "needs-review"
    },
    {
      key: "uploads",
      title: "File picker and uploads",
      expected: "Pick image/document files, confirm validation messages, and keep bucket writes blocked until upload targets are approved.",
      status: "blocked"
    },
    {
      key: "push",
      title: "Push token",
      expected: "On a physical device, request notification permission and confirm Expo token capture before backend registration is enabled.",
      status: "blocked"
    },
    {
      key: "policy-links",
      title: "Policy and account links",
      expected: "Open Privacy, Terms, Account deletion policy, support email, and deletion request email from Profile.",
      status: "needs-review"
    }
  ];
}

export async function runNativeConnectivityProbe(timeoutMs = 8000): Promise<NativeConnectivityProbeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const checkedAt = new Date().toISOString();

  try {
    const response = await fetch(apiBaseUrl, {
      headers: { Accept: "text/html,application/xhtml+xml" },
      method: "GET",
      signal: controller.signal
    });

    if (!response.ok) {
      return {
        status: "error",
        checkedAt,
        message: `EventSlot responded with HTTP ${response.status}.`
      };
    }

    return {
      status: "pass",
      checkedAt,
      message: `Connected to ${apiBaseUrl}.`
    };
  } catch (error) {
    return {
      status: "error",
      checkedAt,
      message: error instanceof Error ? error.message : "Could not reach EventSlot from this device."
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function formatConnectivityCheckedAt(checkedAt: string | null): string {
  if (!checkedAt) {
    return "not checked yet";
  }

  const date = new Date(checkedAt);
  if (Number.isNaN(date.getTime())) {
    return "checked on this device";
  }

  return date.toLocaleString(undefined, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  });
}

export function buildNativeQaEvidenceReport(params: {
  checklist: NativeDeviceQaItem[];
  connectivityProbe: NativeConnectivityProbeResult | null;
  eventsCount: number;
  releaseGates: NativeReadinessItem[];
  runtimeInfo: NativeRuntimeInfoItem[];
  session: AppSession;
}): string {
  const runtimeLines = params.runtimeInfo.map((item) => `- ${item.label}: ${item.value} (${item.tone})`);
  const checklistLines = params.checklist.map((item) => `- ${item.title}: ${item.status} - ${item.expected}`);
  const gateLines = params.releaseGates.map((item) => `- ${item.title}: ${item.status} - ${item.caption}`);
  const connectivity = params.connectivityProbe
    ? `${params.connectivityProbe.status} - ${params.connectivityProbe.message} (${formatConnectivityCheckedAt(params.connectivityProbe.checkedAt)})`
    : "not checked yet";

  return [
    "EventSlot Native QA Evidence",
    "",
    `Tester account: ${params.session.email}`,
    `Session mode: ${params.session.authMode}`,
    `Native event count: ${params.eventsCount}`,
    `Connectivity: ${connectivity}`,
    "",
    "Runtime",
    ...runtimeLines,
    "",
    "Device QA Checklist",
    ...checklistLines,
    "",
    "Release Gates",
    ...gateLines,
    "",
    "Note: This evidence is generated from the native app Profile screen. Physical device behavior still needs manual confirmation before public release."
  ].join("\n");
}
