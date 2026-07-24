import { nativeConfig } from "../config";
import { NativeConnectivityProbeResult, NativeDeviceQaItem } from "../domain/deviceQa";
import { NativePermissionItem, NativeReadinessItem } from "../domain/settings";

export const nativeReadinessItems: NativeReadinessItem[] = [
  {
    key: "shell",
    title: "Native shell",
    caption: "Dashboard, events, create draft, event detail, verifier, profile, build info, tab bar, FAB quick actions, bottom sheet, dark mode, and light mode are in place.",
    status: "ready"
  },
  {
    key: "auth",
    title: "Live auth",
    caption: "Bearer login, refresh, logout, and SecureStore session restore are wired; Android device QA must prove real account sessions.",
    status: nativeConfig.authMode === "live" ? "in-progress" : "blocked"
  },
  {
    key: "events",
    title: "Live event data",
    caption: "Dashboard stats, owned/invited events, event detail, and workspace registration data now load through native bearer APIs.",
    status: nativeConfig.authMode === "live" ? "in-progress" : "blocked"
  },
  {
    key: "offline-drafts",
    title: "Offline drafts",
    caption: "Native event creation now auto-saves locally, restores saved work after restart, and records the last saved time on device.",
    status: "in-progress"
  },
  {
    key: "scanner",
    title: "Camera scanner",
    caption: "Manual lookup, CameraView permissions, QR parsing, and the native verify endpoint are wired; real Android scan QA remains.",
    status: "in-progress"
  },
  {
    key: "uploads",
    title: "File uploads",
    caption: "Attachment questions, document picker, type checks, size validation, and multipart upload client are wired; bucket writes remain gated.",
    status: nativeConfig.uploadsEnabled ? "in-progress" : "blocked"
  },
  {
    key: "push",
    title: "Push notifications",
    caption: "Notification channels, permission prompts, Expo token capture, and backend registration client are wired; server writes are still gated.",
    status: "in-progress"
  }
];

export const nativeReleaseGateItems: NativeReadinessItem[] = [
  {
    key: "android-device-qa",
    title: "Android device QA",
    caption: "Install an internal native build, run the in-app connectivity probe, complete the Profile device QA checklist, and share the QA evidence report from a physical Android phone.",
    status: "blocked"
  },
  {
    key: "uploads-backend",
    title: "Bucket upload enablement",
    caption: "Keep upload writes blocked until live event file-question targets, storage rules, file size limits, and failure handling are reviewed end to end.",
    status: nativeConfig.uploadsEnabled ? "in-progress" : "blocked"
  },
  {
    key: "push-backend",
    title: "Push backend registration",
    caption: "Native client registration is ready, but the live token storage API, opt-out handling, and delivery jobs still need final server wiring.",
    status: nativeConfig.pushEnabled ? "in-progress" : "blocked"
  },
  {
    key: "account-compliance",
    title: "Account and privacy compliance",
    caption: "Privacy, terms, deletion policy, and email deletion request are present; direct authenticated in-app deletion remains gated before public release.",
    status: "blocked"
  },
  {
    key: "store-data-safety",
    title: "Play data safety proof",
    caption: "Store declarations must match the native app permissions, analytics, account data, uploads, emails, and push notification behavior.",
    status: "blocked"
  }
];

export function buildNativeReleaseGateItems(input: {
  connectivityProbe: NativeConnectivityProbeResult | null;
  deviceQaChecklist: NativeDeviceQaItem[];
}): NativeReadinessItem[] {
  const checkedItems = input.deviceQaChecklist.filter((item) => item.status !== "blocked");
  const passedItems = checkedItems.filter((item) => item.status === "pass");
  const qaHasStarted = Boolean(input.connectivityProbe) || passedItems.length > 0;
  const connectivityPassed = input.connectivityProbe?.status === "pass";
  const deviceQaReady = connectivityPassed && checkedItems.length > 0 && passedItems.length === checkedItems.length;
  const androidQaStatus = deviceQaReady ? "ready" : qaHasStarted ? "in-progress" : "blocked";
  const androidQaCaption = deviceQaReady
    ? "Connectivity passed and all non-blocked device QA items are marked pass on this device."
    : qaHasStarted
      ? `Connectivity ${connectivityPassed ? "passed" : "still needs proof"}; ${passedItems.length}/${checkedItems.length} non-blocked QA item${checkedItems.length === 1 ? "" : "s"} marked pass.`
      : "Install an internal native build, run the connectivity probe, complete the Profile device QA checklist, and share the QA evidence report from a physical Android phone.";

  return nativeReleaseGateItems.map((item) =>
    item.key === "android-device-qa"
      ? {
          ...item,
          caption: androidQaCaption,
          status: androidQaStatus
        }
      : item
  );
}

export const nativePermissionItems: NativePermissionItem[] = [
  {
    key: "camera",
    title: "Camera",
    caption: "Required for QR ticket scanning.",
    enabled: true
  },
  {
    key: "files",
    title: "Files",
    caption: "Document picker is wired for attendee document/image uploads; storage writes are separately gated.",
    enabled: true
  },
  {
    key: "notifications",
    title: "Notifications",
    caption: "Required for reminders, invites, and waitlist promotion alerts.",
    enabled: true
  },
  {
    key: "maps",
    title: "Maps",
    caption: "Uses the device browser/maps app for organiser-provided directions links without requesting GPS permission.",
    enabled: true
  }
];
