import { useMemo, useState } from "react";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";

import { EventSlotMessageCard } from "../components/EventSlotMessageCard";
import { EventSlotPageHeader } from "../components/EventSlotPageHeader";
import { EventSlotPanel } from "../components/EventSlotPanel";
import { EventSlotPill } from "../components/EventSlotPill";
import { EventSlotTabs } from "../components/EventSlotTabs";
import { NativeCommunityRange } from "../domain/community";
import { copyTextToClipboard } from "../services/clipboard";
import { buildNativeCommunitySnapshot } from "../services/community";
import { fontFamily, typeScale } from "../typography";
import { NativeScreenProps } from "./types";

export function CommunityScreen({ theme, navigate, session, events }: NativeScreenProps) {
  const [activeRange, setActiveRange] = useState<NativeCommunityRange>("week");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const snapshot = useMemo(() => buildNativeCommunitySnapshot(session, events), [events, session]);
  const visibleLeaderboard = snapshot.ranges[activeRange];
  const visibleRank = visibleLeaderboard.findIndex((entry) => entry.highlight) + 1 || snapshot.currentRank;

  const handleShare = () => {
    Share.share({
      message: `Join my EventSlot community link: ${snapshot.referralLink}`
    })
      .then(() => {
        setActionMessage("Referral link is ready to share from your device.");
      })
      .catch(() => {
        setActionMessage("Share was not completed, but your referral link is available below.");
      });
  };

  const handleCopyReferralLink = () => {
    copyTextToClipboard(snapshot.referralLink)
      .then((copied) => {
        setActionMessage(copied ? "Referral link copied to your clipboard." : "Could not copy the referral link right now.");
      })
      .catch(() => {
        setActionMessage("Could not copy the referral link right now.");
      });
  };

  return (
    <View style={styles.screen}>
      <EventSlotPageHeader
        theme={theme}
        title="Community"
        caption="Referral momentum, leaderboard standing, badge progress, and EventSlot coin balance."
      />

      <EventSlotPanel theme={theme} tone="hero" style={styles.panel}>
        <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>REFERRAL LINK</Text>
        <Text style={[styles.title, { color: theme.colors.text }]}>Grow your EventSlot community reach.</Text>
        <Text style={[styles.body, { color: theme.colors.secondary }]}>
          Share your profile link, watch your rank move, and unlock badges as your events attract more attendees.
        </Text>

        <View style={[styles.linkCard, { backgroundColor: theme.colors.input, borderColor: theme.colors.border }]}>
          <Text style={[styles.linkValue, { color: theme.colors.text }]}>{snapshot.referralLink}</Text>
          <Text style={[styles.linkMeta, { color: theme.colors.secondary }]}>Referral code {snapshot.referralCode}</Text>
        </View>

        <View style={styles.actionRow}>
          <Pressable accessibilityRole="button" onPress={handleShare} style={[styles.primaryButton, { backgroundColor: theme.colors.accent }]}>
            <Text style={styles.primaryButtonText}>Share referral link</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={handleCopyReferralLink} style={[styles.secondaryButton, { borderColor: theme.colors.border }]}>
            <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>Copy referral link</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => navigate({ name: "profile" })} style={[styles.secondaryButton, { borderColor: theme.colors.border }]}>
            <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>Open profile</Text>
          </Pressable>
        </View>
      </EventSlotPanel>

      <View style={styles.metricsRow}>
        <EventSlotPanel theme={theme} style={styles.metricCard}>
          <Text style={[styles.metricLabel, { color: theme.colors.muted }]}>COIN BALANCE</Text>
          <Text style={[styles.metricValue, { color: theme.colors.text }]}>{snapshot.coinBalance}</Text>
        </EventSlotPanel>
        <EventSlotPanel theme={theme} style={styles.metricCard}>
          <Text style={[styles.metricLabel, { color: theme.colors.muted }]}>YOUR RANK</Text>
          <Text style={[styles.metricValue, { color: theme.colors.text }]}>#{visibleRank}</Text>
        </EventSlotPanel>
      </View>

      <EventSlotPanel theme={theme} style={styles.panel}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Leaderboard</Text>
        <Text style={[styles.body, { color: theme.colors.secondary }]}>
          Track your performance across this week, this month, and all-time community activity.
        </Text>
        <EventSlotTabs
          items={[
            { key: "week", label: "This Week" },
            { key: "month", label: "This Month" },
            { key: "all", label: "All Time" }
          ]}
          activeKey={activeRange}
          onSelect={setActiveRange}
          theme={theme}
        />

        <View style={styles.leaderboardList}>
          {visibleLeaderboard.map((entry, index) => (
            <View
              key={entry.id}
              style={[
                styles.leaderboardRow,
                {
                  backgroundColor: entry.highlight ? theme.colors.hero : theme.colors.input,
                  borderColor: entry.highlight ? theme.colors.accent : theme.colors.border
                }
              ]}
            >
              <View style={styles.rankBadge}>
                <Text style={[styles.rankValue, { color: theme.colors.text }]}>#{index + 1}</Text>
              </View>
              <View style={styles.leaderboardCopy}>
                <Text style={[styles.entryName, { color: theme.colors.text }]}>{entry.name}</Text>
                <Text style={[styles.entryMeta, { color: theme.colors.secondary }]}>{entry.points} points</Text>
              </View>
              <EventSlotPill
                label={entry.badge}
                theme={theme}
                tone={entry.highlight ? "accent" : "muted"}
                background={entry.highlight ? "active" : "elevated"}
              />
            </View>
          ))}
        </View>
      </EventSlotPanel>

      <EventSlotPanel theme={theme} style={styles.panel}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Badge collection</Text>
        <View style={styles.badgeGrid}>
          {snapshot.badges.map((badge) => (
            <View
              key={badge.id}
              style={[
                styles.badgeCard,
                {
                  backgroundColor: badge.unlocked ? theme.colors.hero : theme.colors.input,
                  borderColor: badge.unlocked ? theme.colors.accent : theme.colors.border
                }
              ]}
            >
              <View style={styles.badgeHeader}>
                <Text style={[styles.badgeTitle, { color: theme.colors.text }]}>{badge.title}</Text>
                <EventSlotPill label={badge.unlocked ? "UNLOCKED" : "LOCKED"} theme={theme} tone={badge.unlocked ? "success" : "muted"} />
              </View>
              <Text style={[styles.badgeBody, { color: theme.colors.secondary }]}>{badge.description}</Text>
            </View>
          ))}
        </View>
      </EventSlotPanel>

      {actionMessage ? <EventSlotMessageCard title="Community action" caption={actionMessage} theme={theme} /> : null}

      {events.length === 0 ? (
        <EventSlotMessageCard
          title="No events yet"
          caption="Create your first event to start climbing the leaderboard and unlock your first community badges."
          theme={theme}
          actionLabel="Create event"
          onActionPress={() => navigate({ name: "createEvent" })}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: 16
  },
  panel: {
    gap: 14
  },
  eyebrow: {
    ...typeScale.label
  },
  title: {
    ...typeScale.sectionTitle
  },
  body: {
    ...typeScale.body
  },
  linkCard: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    padding: 16
  },
  linkValue: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    lineHeight: 20
  },
  linkMeta: {
    fontSize: 13,
    lineHeight: 18
  },
  actionRow: {
    gap: 10
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 18,
    paddingVertical: 15
  },
  primaryButtonText: {
    color: "#0A0A0A",
    fontSize: 14,
    fontWeight: "900"
  },
  secondaryButton: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 15
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "900"
  },
  metricsRow: {
    gap: 12
  },
  metricCard: {
    gap: 8
  },
  metricLabel: {
    ...typeScale.label
  },
  metricValue: {
    ...typeScale.pageTitle
  },
  sectionTitle: {
    ...typeScale.sectionTitle
  },
  leaderboardList: {
    gap: 10
  },
  leaderboardRow: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14
  },
  rankBadge: {
    alignItems: "center",
    justifyContent: "center",
    width: 34
  },
  rankValue: {
    fontFamily: fontFamily.medium,
    fontSize: 16,
    fontWeight: "900"
  },
  leaderboardCopy: {
    flex: 1,
    gap: 4
  },
  entryName: {
    ...typeScale.bodyStrong
  },
  entryMeta: {
    fontSize: 13,
    lineHeight: 18
  },
  badgeGrid: {
    gap: 12
  },
  badgeCard: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    padding: 16
  },
  badgeHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between"
  },
  badgeTitle: {
    ...typeScale.bodyStrong,
    flex: 1
  },
  badgeBody: {
    fontSize: 14,
    lineHeight: 20
  }
});
