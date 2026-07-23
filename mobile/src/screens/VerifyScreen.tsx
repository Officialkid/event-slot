import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { VerificationResult } from "../domain/verification";
import { verifyNativeTicket } from "../services/verification";
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

  const selectedEvent =
    verifierEvents.find((event) => event.id === selectedEventId) ?? verifierEvents[0];

  const handleVerify = async () => {
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
      const verification = await verifyNativeTicket(session, selectedEvent, {
        ticketCode: lookup
      });
      setResult(verification);
    } catch (error) {
      setResult({
        status: "error",
        message: error instanceof Error ? error.message : "Could not verify this ticket right now."
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.stack}>
      <Text style={[styles.heading, { color: theme.colors.text }]}>Verify Tickets</Text>
      <Text style={[styles.subcopy, { color: theme.colors.secondary }]}>
        Native verification will support camera scanning, manual ticket lookup, and verifier access codes.
      </Text>

      <View style={[styles.scanCard, { backgroundColor: theme.colors.hero, borderColor: theme.colors.border }]}>
        <Text style={[styles.scanIcon, { color: theme.colors.accent }]}>SCAN</Text>
        <Text style={[styles.scanTitle, { color: theme.colors.text }]}>Camera scanner coming next</Text>
        <Text style={[styles.scanText, { color: theme.colors.secondary }]}>
          Manual lookup is functional in the native shell now. The next milestone adds camera permissions and QR parsing.
        </Text>
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
    </View>
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
