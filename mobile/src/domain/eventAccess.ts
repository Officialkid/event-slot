export type NativeEventAccessRole = "owner" | "team" | "verifier";

export type NativeEventAccessCapability =
  | "view-event"
  | "manage-registrations"
  | "verify-tickets"
  | "export-data"
  | "invite-verifiers"
  | "edit-event";

export type NativeEventAccessSummary = {
  role: NativeEventAccessRole;
  title: string;
  caption: string;
  capabilities: NativeEventAccessCapability[];
};

export type NativeVerifierInviteAction = {
  title: string;
  caption: string;
  shareLabel: string;
  verifierCode: string;
};
