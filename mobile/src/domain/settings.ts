export type NativeReadinessStatus = "ready" | "in-progress" | "blocked";

export type NativeReadinessItem = {
  key: string;
  title: string;
  caption: string;
  status: NativeReadinessStatus;
};

export type NativePermissionItem = {
  key: string;
  title: string;
  caption: string;
  enabled: boolean;
};
