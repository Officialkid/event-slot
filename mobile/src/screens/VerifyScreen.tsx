import { useEffect, useMemo, useState } from "react";
import { BarcodeScanningResult, CameraView } from "expo-camera";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { NativeScanMode, NativeScannerState } from "../domain/scanner";
import { NativeVerificationHistoryEntry, NativeVerificationHistoryMethod, VerificationResult, VerifierAccessResult } from "../domain/verification";
import {
  buildDemoScanPayload,
  buildNativeScanPayload,
  getCameraPermissionLabel,
  getScannerReadinessMessage,
  initialScannerState,
  requestCameraScannerAccess
} from "../services/scanner";
import { requestNativeVerifierAccess, verifyNativeTicket } from "../services/verification";
import {
  clearNativeVerificationHistory,
  getVerificationHistoryReadinessMessage,
  loadNativeVerificationHistory,
  saveNativeVerificationHistoryEntry
} from "../services/verificationHistory";
import { NativeScreenProps } from "./types";

export function VerifyScreen({ theme, session, events, eventsLoading, eventsError }: NativeScreenProps) {
  const verifierEvents = useMemo(
    () => events.filter((event) => event.status !== "Draft"),
    [events]
  );
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [lookup, setLookup] = useState("");
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifierCode, setVerifierCode] = useState("");
  const [verifierAccess, setVerifierAccess] = useState<VerifierAccessResult | null>(null);
  const [verifierAccessStatus, setVerifierAccessStatus] = useState("Enter an organiser verifier code to unlock event-day check-in access.");
  const [verifierAccessLoading, setVerifierAccessLoading] = useState(false);
  const [scanLocked, setScanLocked] = useState(false);
  const [scannerState, setScannerState] = useState<NativeScannerState>(initialScannerState);
  const [verificationHistory, setVerificationHistory] = useState<NativeVerificationHistoryEntry[]>([]);

  const selectedEvent =
    verifierEvents.find((event) => event.id === selectedEventId) ?? verifierEvents[0];

  useEffect(() => {
    let mounted = true;

    loadNativeVerificationHistory()
      .then((history) => {
        if (mounted) {
          setVerificationHistory(history);
        }
      })
      .catch(() => {
        if (mounted) {
          setVerificationHistory([]);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const runVerification = async (
    input: { ticketCode?: string; qrPayload?: string },
    method: NativeVerificationHistoryMethod
  ) => {
    if (!selectedEvent) {
      setResult({
        status: "error",
        message: "No active event is available for native verification yet."
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const verification = await verifyNativeTicket(session, selectedEvent, input);
      setResult(verification);
      const nextHistory = await saveNativeVerificationHistoryEntry(verificationHistory, {
        event: selectedEvent,
        lookupValue: input.ticketCode ?? input.qrPayload ?? "",
        method,
        result: verification
      });
      setVerificationHistory(nextHistory);
    } catch (error) {
      const errorResult: VerificationResult = {
        status: "error",
        message: error instanceof Error ? error.message : "Could not verify this ticket right now."
      };
      setResult(errorResult);
      const nextHistory = await saveNativeVerificationHistoryEntry(verificationHistory, {
        event: selectedEvent,
        lookupValue: input.ticketCode ?? input.qrPayload ?? "",
        method,
        result: errorResult
      });
      setVerificationHistory(nextHistory);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    await runVerification({ ticketCode: lookup }, "manual");
  };

  const handleRequestVerifierAccess = async () => {
    setVerifierAccessLoading(true);
    setVerifierAccess(null);
    setVerifierAccessStatus("Checking verifier code...");

    try {
      const access = await requestNativeVerifierAccess({ verifierCode }, verifierEvents);
      const matchedEvent = verifierEvents.find((event) => event.slug === access.slug || event.id === access.eventId);

      setVerifierAccess(access);
      setVerifierAccessStatus(`Verifier access ready for ${access.title}.`);
      if (matchedEvent) {
        setSelectedEventId(matchedEvent.id);
      }
      setResult(null);
    } catch (error) {
      setVerifierAccessStatus(error instanceof Error ? error.message : "Could not activate verifier access.");
    } finally {
      setVerifierAccessLoading(false);
    }
  };

  const handleModeChange = async (mode: NativeScanMode) => {
    if (mode === "camera") {
      const nextScannerState = await requestCameraScannerAccess();
      setScannerState(nextScannerState);
    } else {
      setScannerState((current) => ({ ...current, activeMode: "manual" }));
    }
    setResult(null);
  };

  const handleDemoScan = async () => {
    const payload = buildDemoScanPayload(lookup);
    setScannerState((current) => ({
      ...current,
      activeMode: "camera",
      lastPayload: payload
    }));
    await runVerification({ qrPayload: payload.rawValue }, "preview");
  };

  const handleBarcodeScanned = async (scanResult: BarcodeScanningResult) => {
    if (loading || scanLocked || !scanResult.data) {
      return;
    }

    const payload = buildNativeScanPayload(scanResult);
    setScanLocked(true);
    setScannerState((current) => ({
      ...current,
      activeMode: "camera",
      lastPayload: payload
    }));

    await runVerification({ qrPayload: payload.rawValue }, "camera");
    setTimeout(() => setScanLocked(false), 1800);
  };

  const handleClearHistory = async () => {
    await clearNativeVerificationHistory();
    setVerificationHistory([]);
  };

  return (
    <View style={styles.stack}>
      <Text style={[styles.heading, { color: theme.colors.text }]}>Verify Tickets</Text>
      <Text style={[styles.subcopy, { color: theme.colors.secondary }]}>
        Native verification will support camera scanning, manual ticket lookup, and verifier access codes.
      </Text>

      <View style={[styles.lookupCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.label, { color: theme.colors.muted }]}>VERIFIER ACCESS</Text>
        <Text style={[styles.helper, { color: theme.colors.secondary }]}>
          Use the code shared by an organiser to select the event and prepare this device for check-in.
        </Text>
        <TextInput
          autoCapitalize="characters"
          onChangeText={(value) => {
            setVerifierCode(value);
            setVerifierAccess(null);
            setVerifierAccessStatus("Verifier code entered. Tap activate when ready.");
          }}
          placeholder="Enter verifier code"
          placeholderTextColor={theme.colors.muted}
          style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.input }]}
          value={verifierCode}
        />
        <Pressable
          accessibilityRole="button"
          disabled={verifierAccessLoading}
          onPress={handleRequestVerifierAccess}
          style={[styles.verifyButton, { backgroundColor: theme.colors.accent, opacity: verifierAccessLoading ? 0.62 : 1 }]}
        >
          <Text style={styles.verifyButtonText}>{verifierAccessLoading ? "Activating..." : "Activate verifier access"}</Text>
        </Pressable>
        <Text style={[styles.helper, { color: verifierAccess ? theme.colors.success : theme.colors.secondary }]}>
          {verifierAccessStatus}
        </Text>
        {verifierAccess ? (
          <Text style={[styles.helper, { color: theme.colors.muted }]}>
            Token ready for {verifierAccess.slug}. Tickets enabled: {verifierAccess.ticketsEnabled ? "yes" : "no"}.
          </Text>
        ) : null}
      </View>

      <View style={[styles.scanCard, { backgroundColor: theme.colors.hero, borderColor: theme.colors.border }]}>
        <Text style={[styles.scanIcon, { color: theme.colors.accent }]}>SCAN</Text>
        <Text style={[styles.scanTitle, { color: theme.colors.text }]}>Native camera scanner</Text>
        <Text style={[styles.scanText, { color: theme.colors.secondary }]}>
          {getScannerReadinessMessage()}
        </Text>
        <View style={styles.modeRow}>
          <ModeButton label="Manual" mode="manual" activeMode={scannerState.activeMode} onPress={() => handleModeChange("manual")} theme={theme} />
          <ModeButton label="Camera" mode="camera" activeMode={scannerState.activeMode} onPress={() => handleModeChange("camera")} theme={theme} />
        </View>
        <Text style={[styles.scanText, { color: theme.colors.secondary }]}>
          Camera permission: {getCameraPermissionLabel(scannerState)}
        </Text>
        {scannerState.cameraReady ? (
          <Text style={[styles.scanText, { color: theme.colors.accent }]}>
            Camera access is ready for Android QR scan QA.
          </Text>
        ) : null}
        {scannerState.activeMode === "camera" && scannerState.cameraReady ? (
          <View style={[styles.cameraFrame, { borderColor: theme.colors.accent }]}>
            <CameraView
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              facing="back"
              onBarcodeScanned={scanLocked ? undefined : handleBarcodeScanned}
              style={styles.cameraView}
            />
            <View style={styles.scanGuide}>
              <Text style={styles.scanGuideText}>{scanLocked ? "Checking ticket..." : "Place QR inside the frame"}</Text>
            </View>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={loading}
          onPress={handleDemoScan}
          style={[styles.scanButton, { borderColor: theme.colors.border, opacity: loading ? 0.62 : 1 }]}
        >
          <Text style={[styles.scanButtonText, { color: theme.colors.accent }]}>Preview scan payload</Text>
        </Pressable>
        {scannerState.lastPayload ? (
          <Text style={[styles.scanText, { color: theme.colors.secondary }]}>
            Last scan: {scannerState.lastPayload.rawValue}
          </Text>
        ) : null}
      </View>

      <View style={[styles.lookupCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.label, { color: theme.colors.muted }]}>ACTIVE EVENT</Text>
        {eventsLoading ? (
          <Text style={[styles.helper, { color: theme.colors.secondary }]}>Loading verifier events...</Text>
        ) : null}
        {eventsError ? (
          <Text style={[styles.helper, { color: theme.colors.error }]}>{eventsError}</Text>
        ) : null}
        <View style={styles.eventChips}>
          {verifierEvents.map((event) => {
            const active = event.id === selectedEvent?.id;
            return (
              <Pressable
                accessibilityRole="button"
                key={event.id}
                onPress={() => {
                  setSelectedEventId(event.id);
                  setResult(null);
                }}
                style={[
                  styles.eventChip,
                  {
                    backgroundColor: active ? theme.colors.activeTab : theme.colors.input,
                    borderColor: active ? theme.colors.accent : theme.colors.border
                  }
                ]}
              >
                <Text style={[styles.eventChipText, { color: active ? theme.colors.accent : theme.colors.secondary }]}>
                  {event.title}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, { color: theme.colors.muted }]}>MANUAL LOOKUP</Text>
        <TextInput
          autoCapitalize="characters"
          onChangeText={(value) => {
            setLookup(value);
            setResult(null);
          }}
          placeholder="Enter ticket code, name, or email"
          placeholderTextColor={theme.colors.muted}
          style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.input }]}
          value={lookup}
        />
        <Pressable
          accessibilityRole="button"
          disabled={loading}
          onPress={handleVerify}
          style={[styles.verifyButton, { backgroundColor: theme.colors.accent, opacity: loading ? 0.62 : 1 }]}
        >
          <Text style={styles.verifyButtonText}>{loading ? "Checking..." : "Verify ticket"}</Text>
        </Pressable>
      </View>

      {result ? (
        <View
          style={[
            styles.resultCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: result.status === "verified" ? theme.colors.success : theme.colors.border
            }
          ]}
        >
          <Text
            style={[
              styles.resultTitle,
              {
                color:
                  result.status === "verified"
                    ? theme.colors.success
                    : result.status === "error" || result.status === "not-found"
                      ? theme.colors.error
                      : theme.colors.accent
              }
            ]}
          >
            {result.status.replace("-", " ").toUpperCase()}
          </Text>
          <Text style={[styles.resultMessage, { color: theme.colors.text }]}>{result.message}</Text>
          {result.ticket ? (
            <View style={[styles.ticketSummary, { borderColor: theme.colors.border }]}>
              <Text style={[styles.ticketName, { color: theme.colors.text }]}>{result.ticket.attendeeName}</Text>
              <Text style={[styles.helper, { color: theme.colors.secondary }]}>
                Ticket {result.ticket.ticketCode} | Remaining {result.ticket.admissionsRemaining}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.lookupCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={styles.historyHeader}>
          <Text style={[styles.label, { color: theme.colors.muted }]}>RECENT CHECKS</Text>
          <Pressable accessibilityRole="button" onPress={handleClearHistory}>
            <Text style={[styles.clearHistoryText, { color: theme.colors.accent }]}>Clear</Text>
          </Pressable>
        </View>
        <Text style={[styles.helper, { color: theme.colors.secondary }]}>
          {getVerificationHistoryReadinessMessage()}
        </Text>
        {verificationHistory.length === 0 ? (
          <Text style={[styles.helper, { color: theme.colors.muted }]}>
            No native verification attempts saved on this device yet.
          </Text>
        ) : (
          verificationHistory.slice(0, 5).map((entry) => (
            <View key={entry.id} style={[styles.historyItem, { borderColor: theme.colors.border }]}>
              <Text style={[styles.historyTitle, { color: theme.colors.text }]}>
                {entry.status.replace("-", " ").toUpperCase()} - {entry.method.toUpperCase()}
              </Text>
              <Text style={[styles.helper, { color: theme.colors.secondary }]}>
                {entry.eventTitle} - {entry.ticketCode ?? entry.lookupValue}
              </Text>
              <Text style={[styles.helper, { color: theme.colors.muted }]}>
                {formatHistoryTime(entry.checkedAt)}
                {entry.attendeeName ? ` - ${entry.attendeeName}` : ""}
              </Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

function formatHistoryTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

type ModeButtonProps = {
  label: string;
  mode: NativeScanMode;
  activeMode: NativeScanMode;
  onPress: () => void;
  theme: NativeScreenProps["theme"];
};

function ModeButton({ label, mode, activeMode, onPress, theme }: ModeButtonProps) {
  const active = mode === activeMode;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.modeButton,
        {
          backgroundColor: active ? theme.colors.activeTab : theme.colors.input,
          borderColor: active ? theme.colors.accent : theme.colors.border
        }
      ]}
    >
      <Text style={[styles.modeButtonText, { color: active ? theme.colors.accent : theme.colors.secondary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 14
  },
  heading: {
    fontSize: 32,
    fontWeight: "900"
  },
  subcopy: {
    fontSize: 15,
    lineHeight: 23
  },
  scanCard: {
    alignItems: "center",
    borderRadius: 28,
    borderWidth: 1,
    gap: 12,
    padding: 26
  },
  scanIcon: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 2.4
  },
  scanTitle: {
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center"
  },
  scanText: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center"
  },
  modeRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%"
  },
  modeButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12
  },
  modeButtonText: {
    fontSize: 13,
    fontWeight: "900"
  },
  scanButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  scanButtonText: {
    fontSize: 13,
    fontWeight: "900"
  },
  cameraFrame: {
    borderRadius: 24,
    borderWidth: 2,
    height: 260,
    overflow: "hidden",
    width: "100%"
  },
  cameraView: {
    flex: 1
  },
  scanGuide: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.62)",
    bottom: 0,
    left: 0,
    paddingVertical: 10,
    position: "absolute",
    right: 0
  },
  scanGuideText: {
    color: "#F8FAFC",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.5
  },
  lookupCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 18
  },
  eventChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  eventChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  eventChipText: {
    fontSize: 12,
    fontWeight: "900"
  },
  historyHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  clearHistoryText: {
    fontSize: 12,
    fontWeight: "900"
  },
  historyItem: {
    borderTopWidth: 1,
    gap: 4,
    paddingTop: 12
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: "900"
  },
  label: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2
  },
  input: {
    borderRadius: 18,
    borderWidth: 1,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  verifyButton: {
    alignItems: "center",
    borderRadius: 999,
    paddingVertical: 16
  },
  verifyButtonText: {
    color: "#0A0A0A",
    fontSize: 15,
    fontWeight: "900"
  },
  resultCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    padding: 18
  },
  resultTitle: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2
  },
  resultMessage: {
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 25
  },
  ticketSummary: {
    borderTopWidth: 1,
    gap: 4,
    paddingTop: 12
  },
  ticketName: {
    fontSize: 15,
    fontWeight: "900"
  },
  helper: {
    fontSize: 13,
    lineHeight: 20
  }
});
