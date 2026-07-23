import { nativeConfig } from "../config";
import { NativePermissionItem, NativeReadinessItem } from "../domain/settings";

export const nativeReadinessItems: NativeReadinessItem[] = [
  {
    key: "shell",
    title: "Native shell",
    caption: "Dashboard, events, create draft, verifier, and profile screens are in place.",
    status: "ready"
  },
  {
    key: "auth",
    title: "Live auth",
    caption: "Needs native token endpoints before real organizer sessions are enabled.",
    status: nativeConfig.authMode === "live" ? "in-progress" : "blocked"
  },
  {
    key: "events",
    title: "Live event data",
    caption: "Waiting for bearer-auth event list and event workspace APIs.",
    status: "blocked"
  },
  {
    key: "scanner",
    title: "Camera scanner",
    caption: "Manual verification is scaffolded; camera permissions and QR parsing come next.",
    status: "in-progress"
  },
  {
    key: "uploads",
    title: "File uploads",
    caption: "Attachment questions are scaffolded; native picker and bucket upload are still gated.",
    status: nativeConfig.uploadsEnabled ? "in-progress" : "blocked"
  }
];

export const nativePermissionItems: NativePermissionItem[] = [
  {
    key: "camera",
    title: "Camera",
    caption: "Required for QR ticket scanning.",
    enabled: false
  },
  {
    key: "files",
    title: "Files",
    caption: "Required for attendee document/image uploads.",
    enabled: nativeConfig.uploadsEnabled
  },
  {
    key: "notifications",
    title: "Notifications",
    caption: "Required for reminders, invites, and waitlist promotion alerts.",
    enabled: false
  },
  {
    key: "maps",
    title: "Maps",
    caption: "Required for native directions handoff.",
    enabled: false
  }
];
