import { nativeConfig } from "../config";
import { NativePermissionItem, NativeReadinessItem } from "../domain/settings";

export const nativeReadinessItems: NativeReadinessItem[] = [
  {
    key: "shell",
    title: "Native shell",
    caption: "Dashboard, events, create draft, event detail, verifier, profile, tab bar, FAB, dark mode, and light mode are in place.",
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
    key: "scanner",
    title: "Camera scanner",
    caption: "Manual lookup, CameraView permissions, QR parsing, and the native verify endpoint are wired; real Android scan QA remains.",
    status: "in-progress"
  },
  {
    key: "uploads",
    title: "File uploads",
    caption: "Attachment questions, document picker, type checks, and size validation are wired; bucket upload writes remain gated.",
    status: nativeConfig.uploadsEnabled ? "in-progress" : "blocked"
  },
  {
    key: "push",
    title: "Push notifications",
    caption: "Notification channels, permission prompts, and Expo token capture are wired; backend token registration is still gated.",
    status: "in-progress"
  }
];

export const nativeReleaseGateItems: NativeReadinessItem[] = [
  {
    key: "android-device-qa",
    title: "Android device QA",
    caption: "Install an internal native build and prove launch, login, session restore, event loading, ticket scan, and logout on a physical Android phone.",
    status: "blocked"
  },
  {
    key: "uploads-backend",
    title: "Bucket upload enablement",
    caption: "Keep upload writes blocked until storage rules, file size limits, signed URLs, and failure handling are reviewed end to end.",
    status: nativeConfig.uploadsEnabled ? "in-progress" : "blocked"
  },
  {
    key: "push-backend",
    title: "Push backend registration",
    caption: "Expo push token capture is local-ready; the live token registration API, opt-out, and delivery jobs still need final wiring.",
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
