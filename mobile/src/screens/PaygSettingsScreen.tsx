import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { EventSlotField } from "../components/EventSlotField";
import { EventSlotMessageCard } from "../components/EventSlotMessageCard";
import { EventSlotPageHeader } from "../components/EventSlotPageHeader";
import { EventSlotPanel } from "../components/EventSlotPanel";
import { NativeBillingSnapshot } from "../domain/billing";
import { loadNativeBillingSnapshot, saveNativeBillingSnapshot } from "../services/billing";
import { fontFamily, typeScale } from "../typography";
import { NativeScreenProps } from "./types";

export function PaygSettingsScreen({ navigate, session, theme }: NativeScreenProps) {
  const [snapshot, setSnapshot] = useState<NativeBillingSnapshot | null>(null);
  const [capLabel, setCapLabel] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadNativeBillingSnapshot(session)
      .then((nextSnapshot) => {
        setSnapshot(nextSnapshot);
        setCapLabel(nextSnapshot.paygCapLabel);
      })
      .catch(() => {
        setMessage("PAYG settings could not be loaded right now.");
      });
  }, [session]);

  const saveSettings = () => {
    if (!snapshot) {
      return;
    }

    const nextSnapshot: NativeBillingSnapshot = {
      ...snapshot,
      paygCapLabel: capLabel || snapshot.paygCapLabel
    };

    saveNativeBillingSnapshot(nextSnapshot)
      .then((saved) => {
        setSnapshot(saved);
        setMessage("PAYG settings saved to local mobile preview storage.");
      })
      .catch(() => {
        setMessage("PAYG settings could not be saved.");
      });
  };

  const toggleEnabled = () => {
    if (!snapshot) {
      return;
    }

    const nextSnapshot: NativeBillingSnapshot = {
      ...snapshot,
      paygEnabled: !snapshot.paygEnabled
    };

    saveNativeBillingSnapshot(nextSnapshot)
      .then(setSnapshot)
      .catch(() => setMessage("PAYG state could not be updated."));
  };

  const toggleAutoPause = () => {
    if (!snapshot) {
      return;
    }

    const nextSnapshot: NativeBillingSnapshot = {
      ...snapshot,
      paygAutoPause: !snapshot.paygAutoPause
    };

    saveNativeBillingSnapshot(nextSnapshot)
      .then(setSnapshot)
      .catch(() => setMessage("Auto-pause setting could not be updated."));
  };

  const updateThreshold = (threshold: number) => {
    if (!snapshot) {
      return;
    }

    const nextSnapshot: NativeBillingSnapshot = {
      ...snapshot,
      paygWarningThreshold: threshold
    };

    saveNativeBillingSnapshot(nextSnapshot)
      .then(setSnapshot)
      .catch(() => setMessage("Warning threshold could not be updated."));
  };

  if (!snapshot) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.page, padding: 16 }}>
        <EventSlotMessageCard
          title="Loading PAYG settings"
          caption="Preparing your cap, warning threshold, and billing controls."
          theme={theme}
        />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
      <EventSlotPageHeader
        theme={theme}
        title="PAYG settings"
        caption="Control cap alerts and payout guardrails for paid EventSlot activity."
        backLabel="Back to billing"
        onBackPress={() => navigate({ name: "billing" })}
      />

      <EventSlotPanel theme={theme} tone="hero" style={styles.panel}>
        <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>PAYG STATUS</Text>
        <Text style={[styles.title, { color: theme.colors.text }]}>{snapshot.paygEnabled ? "Enabled" : "Disabled"}</Text>
        <Text style={[styles.body, { color: theme.colors.secondary }]}>
          {snapshot.paygUsageLabel} | Warning at {snapshot.paygWarningThreshold}%
        </Text>
        <Text style={[styles.body, { color: theme.colors.secondary }]}>Wallet balance: {session.tokenBalance.toLocaleString()} tokens</Text>
      </EventSlotPanel>

      <EventSlotPanel theme={theme} style={styles.panel}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Monthly cap</Text>
        <EventSlotField
          label="Spending cap"
          value={capLabel}
          onChangeText={setCapLabel}
          placeholder="KES 35,000"
          theme={theme}
          helperText="This mirrors the PAYG controls linked from the profile billing area."
        />
        <Pressable accessibilityRole="button" onPress={saveSettings} style={[styles.primaryButton, { backgroundColor: theme.colors.accent }]}>
          <Text style={styles.primaryButtonText}>Save cap</Text>
        </Pressable>
      </EventSlotPanel>

      <EventSlotPanel theme={theme} style={styles.panel}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Protection toggles</Text>
        <ToggleRow
          title="PAYG enabled"
          caption="Allow metered paid-event charges when your current plan includes them."
          value={snapshot.paygEnabled}
          onPress={toggleEnabled}
          theme={theme}
        />
        <ToggleRow
          title="Auto-pause at cap"
          caption="Stop new charges once the monthly cap is reached."
          value={snapshot.paygAutoPause}
          onPress={toggleAutoPause}
          theme={theme}
        />
      </EventSlotPanel>

      <EventSlotPanel theme={theme} style={styles.panel}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Warning threshold</Text>
        <View style={styles.thresholdRow}>
          {[60, 80, 90].map((threshold) => {
            const active = snapshot.paygWarningThreshold === threshold;
            return (
              <Pressable
                key={threshold}
                accessibilityRole="button"
                onPress={() => updateThreshold(threshold)}
                style={[
                  styles.thresholdChip,
                  {
                    backgroundColor: active ? theme.colors.accent : theme.colors.input,
                    borderColor: active ? theme.colors.accent : theme.colors.border
                  }
                ]}
              >
                <Text style={[styles.thresholdText, { color: active ? "#0A0A0A" : theme.colors.text }]}>{threshold}%</Text>
              </Pressable>
            );
          })}
        </View>
      </EventSlotPanel>

      {message ? <EventSlotMessageCard title="PAYG update" caption={message} theme={theme} /> : null}
    </ScrollView>
  );
}

function ToggleRow({
  title,
  caption,
  value,
  onPress,
  theme
}: {
  title: string;
  caption: string;
  value: boolean;
  onPress: () => void;
  theme: NativeScreenProps["theme"];
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={onPress}
      style={[styles.toggleRow, { backgroundColor: theme.colors.input, borderColor: theme.colors.border }]}
    >
      <View style={styles.toggleCopy}>
        <Text style={[styles.toggleTitle, { color: theme.colors.text }]}>{title}</Text>
        <Text style={[styles.body, { color: theme.colors.secondary }]}>{caption}</Text>
      </View>
      <Text style={[styles.toggleValue, { color: value ? theme.colors.success : theme.colors.muted }]}>{value ? "ON" : "OFF"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: 16,
    padding: 16,
    paddingBottom: 40
  },
  panel: {
    gap: 14
  },
  eyebrow: {
    ...typeScale.label
  },
  title: {
    ...typeScale.pageTitle
  },
  sectionTitle: {
    ...typeScale.sectionTitle
  },
  body: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 20
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 18,
    paddingVertical: 15
  },
  primaryButtonText: {
    color: "#0A0A0A",
    fontFamily: fontFamily.medium,
    fontSize: 14,
    fontWeight: "900"
  },
  toggleRow: {
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    padding: 16
  },
  toggleCopy: {
    flex: 1,
    gap: 4
  },
  toggleTitle: {
    ...typeScale.bodyStrong
  },
  toggleValue: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2
  },
  thresholdRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  thresholdChip: {
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 72,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  thresholdText: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center"
  }
});
