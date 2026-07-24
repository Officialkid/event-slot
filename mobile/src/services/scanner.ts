import { BarcodeScanningResult, Camera } from "expo-camera";
import { NativeScanPayload, NativeScannerState } from "../domain/scanner";

export const initialScannerState: NativeScannerState = {
  permissionStatus: "unknown",
  activeMode: "manual",
  cameraReady: false
};

export function getScannerReadinessMessage(): string {
  return "Camera scanning now uses Expo Camera permissions and QR payload parsing. Android device QA still needs to prove live scan behavior, duplicate-scan handling, and permission denial states.";
}

export async function requestCameraScannerAccess(): Promise<NativeScannerState> {
  const permission = await Camera.requestCameraPermissionsAsync();

  return {
    permissionStatus: permission.granted ? "granted" : permission.canAskAgain ? "denied" : "unavailable",
    activeMode: "camera",
    cameraReady: permission.granted
  };
}

export function buildDemoScanPayload(ticketCode: string): NativeScanPayload {
  const normalizedCode = ticketCode.trim().toUpperCase() || "DEMO-SCAN-001";

  return {
    rawValue: normalizedCode,
    source: "qr",
    scannedAt: new Date().toISOString(),
    format: "demo"
  };
}

export function buildNativeScanPayload(result: BarcodeScanningResult): NativeScanPayload {
  return {
    rawValue: result.data,
    source: "qr",
    scannedAt: new Date().toISOString(),
    format: result.type
  };
}

export function getCameraPermissionLabel(state: NativeScannerState): string {
  if (state.permissionStatus === "granted") {
    return "Granted";
  }

  if (state.permissionStatus === "denied") {
    return "Denied. You can still use manual lookup.";
  }

  if (state.permissionStatus === "unavailable") {
    return "Unavailable on this device or preview runtime.";
  }

  return "Not requested yet.";
}
