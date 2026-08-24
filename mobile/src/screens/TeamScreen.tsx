import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { EventSlotPageHeader } from "../components/EventSlotPageHeader";
import { EventSlotPanel } from "../components/EventSlotPanel";
import { typeScale } from "../typography";
import { NativeScreenProps } from "./types";

const pendingInvites = [
  "kido@example.com",
  "daniel@example.com",
  "kiongozi@example.com"
];

export function TeamScreen({ theme, navigate }: NativeScreenProps) {
  const teamSeatLimit = 10;
  const activeMembers = 3;
  const seatUsageWidth: `${number}%` = `${Math.round((activeMembers / teamSeatLimit) * 100)}%`;

  return (
    <View style={styles.stack}>
      <EventSlotPageHeader theme={theme} title="Your team" caption={`${activeMembers} of ${teamSeatLimit} team members`} />

      <View style={[styles.progressTrack, { backgroundColor: theme.colors.elevated }]}>
        <View style={[styles.progressFill, { backgroundColor: theme.colors.accent, width: seatUsageWidth }]} />
      </View>

      <EventSlotPanel theme={theme} tone="hero">
        <Text style={[styles.infoTitle, { color: theme.colors.text }]}>Team workspace capacity</Text>
        <Text style={[styles.infoText, { color: theme.colors.secondary }]}>
          Team workspaces support up to {teamSeatLimit} members. Invite organisers, verifiers, or support leads without giving away full owner access.
        </Text>
      </EventSlotPanel>

      <Text style={[styles.sectionLabel, { color: theme.colors.muted }]}>PENDING INVITES</Text>
      {pendingInvites.map((email) => (
        <EventSlotPanel key={email} theme={theme} style={styles.inviteRow}>
          <View style={styles.inviteHeader}>
            <Text style={[styles.email, { color: theme.colors.text }]} numberOfLines={1}>
              {email}
            </Text>
            <Text style={[styles.statusPill, { backgroundColor: theme.colors.activeTab, color: "#D68A00" }]}>Pending</Text>
          </View>
          <View style={styles.actionRow}>
            <Pressable style={[styles.smallButton, { borderColor: theme.colors.border }]}>
              <Text style={[styles.smallButtonText, { color: theme.colors.text }]}>Resend invite</Text>
            </Pressable>
            <Pressable style={[styles.smallButton, { borderColor: theme.colors.border }]}>
              <Text style={[styles.smallButtonText, { color: theme.colors.error }]}>Cancel</Text>
            </Pressable>
          </View>
        </EventSlotPanel>
      ))}

      <Text style={[styles.sectionLabel, { color: theme.colors.muted }]}>INVITE A TEAM MEMBER</Text>
      <EventSlotPanel theme={theme} style={styles.formCard}>
        <TextInput
          placeholder="teammate@example.com"
          placeholderTextColor={theme.colors.muted}
          style={[styles.input, { backgroundColor: theme.colors.input, borderColor: theme.colors.border, color: theme.colors.text }]}
        />
        <TextInput
          placeholder="second@example.com (optional)"
          placeholderTextColor={theme.colors.muted}
          style={[styles.input, { backgroundColor: theme.colors.input, borderColor: theme.colors.border, color: theme.colors.text }]}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => navigate({ name: "profile" })}
          style={[styles.primaryButton, { backgroundColor: theme.colors.accent }]}
        >
          <Text style={styles.primaryButtonText}>Send invites</Text>
        </Pressable>
      </EventSlotPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 14
  },
  progressTrack: {
    borderRadius: 999,
    height: 6,
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    width: "30%"
  },
  infoText: {
    ...typeScale.body
  },
  infoTitle: {
    ...typeScale.bodyStrong,
    marginBottom: 6
  },
  sectionLabel: {
    ...typeScale.label
  },
  inviteRow: {
    gap: 10
  },
  inviteHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  email: {
    ...typeScale.bodyStrong,
    flex: 1
  },
  statusPill: {
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  actionRow: {
    flexDirection: "row",
    gap: 10
  },
  smallButton: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10
  },
  smallButtonText: {
    ...typeScale.bodyStrong
  },
  formCard: {
    gap: 12
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 999,
    paddingVertical: 16
  },
  primaryButtonText: {
    color: "#0A0A0A",
    fontSize: 15,
    fontWeight: "900"
  }
});
