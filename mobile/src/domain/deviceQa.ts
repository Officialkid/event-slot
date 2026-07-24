export type NativeDeviceQaStatus = "pending" | "pass" | "needs-review" | "blocked";

export type NativeDeviceQaItem = {
  key: string;
  title: string;
  expected: string;
  status: NativeDeviceQaStatus;
};

export type NativeConnectivityProbeResult = {
  status: "pass" | "error";
  message: string;
  checkedAt: string;
};
