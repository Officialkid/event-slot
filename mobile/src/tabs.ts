export type TabKey = "home" | "events" | "verify" | "profile";

export const tabs: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: "home", label: "Home", icon: "grid" },
  { key: "events", label: "Events", icon: "calendar" },
  { key: "verify", label: "Verify", icon: "scan" },
  { key: "profile", label: "Profile", icon: "user" }
];

