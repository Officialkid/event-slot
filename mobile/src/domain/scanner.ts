export type NativeCameraPermissionStatus = "unknown" | "granted" | "denied" | "unavailable";

export type NativeScanMode = "manual" | "camera";

export type NativeScanPayload = {
  rawValue: string;
  source: "qr" | "manual";
  scannedAt: string;
  format?: string;
};

export type NativeScannerState = {
  permissionStatus: NativeCameraPermissionStatus;
  activeMode: NativeScanMode;
  cameraReady: boolean;
  lastPayload?: NativeScanPayload;
};
