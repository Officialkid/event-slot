import { nativeConfig } from "../config";
import { NativeScanPayload, NativeScannerState } from "../domain/scanner";

export const initialScannerState: NativeScannerState = {
  permissionStatus: "unknown",
  activeMode: "manual"
};

export function getScannerReadinessMessage(): string {
  return "Camera scanning is scaffolded. Expo Camera permission and QR parsing will be enabled after device QA.";
}

export async function requestCameraPermissionPreview(): Promise<NativeScannerState> {
  return {
    permissionStatus: nativeConfig.authMode === "demo" ? "unavailable" : "unknown",
    activeMode: "camera"
  };
}

export function buildDemoScanPayload(ticketCode: string): NativeScanPayload {
  const normalizedCode = ticketCode.trim().toUpperCase() || "DEMO-SCAN-001";

  return {
    rawValue: normalizedCode,
    source: "qr",
    scannedAt: new Date().toISOString()
  };
}
