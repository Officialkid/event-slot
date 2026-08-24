import { useEffect, useMemo, useState } from "react";
import Constants from "expo-constants";
import { Image, Pressable, Share, StyleSheet, Text, View } from "react-native";

import { eventSlotLogo } from "../brand";
import { NativeNotificationPreference } from "../domain/notifications";
import { NativePreferences } from "../domain/preferences";
import { copyTextToClipboard } from "../services/clipboard";
import { buildOrganizerProfileSlug, buildOrganizerPublicProfileUrl } from "../services/community";
import { buildNotificationPreferences } from "../services/notifications";
import {
  defaultNativePreferences,
  loadNativePreferences,
  saveNotificationPreference,
  savePreferredLanguage
} from "../services/preferences";
import { getNativeUiStatesReadinessMessage } from "../services/uiStates";
import {
  openSupportLink,
  requestAccountDeletionByEmail,
  supportLinks
} from "../services/support";
import { fontFamily, typeScale } from "../typography";
import { NativeScreenProps } from "./types";

type SettingRowItem = {
  title: string;
  caption: string;
  actionLabel: string;
  onPress?: () => void;
  danger?: boolean;
};

export function ProfileScreen({ theme, session, events, navigate, onSignOut }: NativeScreenProps) {
  const [preferences, setPreferences] = useState<NativePreferences>(defaultNativePreferences);
  const [profileLinkStatus, setProfileLinkStatus] = useState<string | null>(null);

  useEffect(() => {
    loadNativePreferences()
      .then(setPreferences)
      .catch(() => setPreferences(defaultNativePreferences));
  }, []);

  const notificationPreferences = useMemo(() => buildNotificationPreferences(preferences), [preferences]);
  const nextLanguage = preferences.preferredLanguage === "English - English" ? "Swahili - Kiswahili" : "English - English";
  const appVersion = Constants.expoConfig?.version ?? "1.0.0";
  const publicProfileSlug = buildOrganizerProfileSlug(session.displayName);
  const publicProfileUrl = buildOrganizerPublicProfileUrl(session.displayName);

  const supportRows: SettingRowItem[] = [
    {
      title: "Privacy policy",
      caption: "Open EventSlot privacy policy.",
      actionLabel: "OPEN",
      onPress: () => {
        openSupportLink(supportLinks.privacyPolicy).catch(() => {});
      }
    },
    {
      title: "Terms of service",
      caption: "Open EventSlot terms for organisers and attendees.",
      actionLabel: "OPEN",
      onPress: () => {
        openSupportLink(supportLinks.terms).catch(() => {});
      }
    },
    {
      title: "Help center",
      caption: "Open documentation, FAQs, and direct support entry points on the EventSlot website.",
      actionLabel: "OPEN",
      onPress: () => {
        openSupportLink(`${supportLinks.website}/help`).catch(() => {});
      }
    },
    {
      title: "Support",
      caption: "Email EventSlot support for help with your account or events.",
      actionLabel: "EMAIL",
      onPress: () => {
        openSupportLink(supportLinks.testerSupport).catch(() => {});
      }
    },
    {
      title: "Website",
      caption: "Open the live EventSlot website.",
      actionLabel: "OPEN",
      onPress: () => {
        openSupportLink(supportLinks.website).catch(() => {});
      }
    }
  ];

  const accountActionRows: SettingRowItem[] = [
    {
      title: "Change password",
      caption: "Send a password reset link without leaving the app.",
      actionLabel: "RESET",
      onPress: () => {
        navigate({ name: "forgotPassword" });
      }
    },
    {
      title: "Request account deletion",
      caption: "Prepare an email request for account deletion from this signed-in account.",
      actionLabel: "EMAIL",
      onPress: () => {
        requestAccountDeletionByEmail(session).catch(() => {});
      },
      danger: true
    }
  ];

  const billingRows: SettingRowItem[] = [
    {
      title: "Billing and plan",
      caption: "Review your current subscription, recent payment state, and mobile upgrade preview.",
      actionLabel: "OPEN",
      onPress: () => navigate({ name: "billing" })
    },
    {
      title: "PAYG settings",
      caption: "Manage cap alerts, auto-pause, and metered spend controls for paid events.",
      actionLabel: "OPEN",
      onPress: () => navigate({ name: "payg" })
    }
  ];

  const toggleNotificationPreference = (preference: NativeNotificationPreference) => {
    saveNotificationPreference(preference.channel, !preference.enabled)
      .then(setPreferences)
      .catch(() => {});
  };

  const toggleLanguage = () => {
    savePreferredLanguage(nextLanguage)
      .then(setPreferences)
      .catch(() => {});
  };

  const openPublicProfile = () => {
    openSupportLink(publicProfileUrl)
      .then((opened) => {
        setProfileLinkStatus(opened ? "Opened your public EventSlot profile preview." : "Could not open your public profile right now.");
      })
      .catch(() => {
        setProfileLinkStatus("Could not open your public profile right now.");
      });
  };

  const sharePublicProfile = () => {
    Share.share({
      message: `Follow my EventSlot profile: ${publicProfileUrl}`
    })
      .then(() => {
        setProfileLinkStatus("Public profile link is ready to share from your device.");
      })
      .catch(() => {
        setProfileLinkStatus("Share was not completed, but your public profile link is shown below.");
      });
  };

  const copyPublicProfile = () => {
    copyTextToClipboard(publicProfileUrl)
      .then((copied) => {
        setProfileLinkStatus(copied ? "Public profile link copied to your clipboard." : "Could not copy your public profile right now.");
      })
      .catch(() => {
        setProfileLinkStatus("Could not copy your public profile right now.");
      });
  };

  return (
    <View style={styles.stack}>
      <Text style={[styles.pageTitle, { color: theme.colors.text }]}>Your profile</Text>

      <View style={styles.heroWrap}>
        <Image source={eventSlotLogo} style={styles.profileImage} resizeMode="contain" />
        <View style={[styles.photoStatusCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.photoStatusTitle, { color: theme.colors.text }]}>Profile photo follows your web account</Text>
          <Text style={[styles.photoStatusText, { color: theme.colors.secondary }]}>
            Native photo upload is not exposed here unless the EventSlot web profile supports it directly.
          </Text>
        </View>
      </View>

      <View style={[styles.detailCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Personal details</Text>

        <Text style={[styles.fieldLabel, { color: theme.colors.muted }]}>DISPLAY NAME</Text>
        <View style={[styles.fieldBox, { backgroundColor: theme.colors.input, borderColor: theme.colors.border }]}>
          <Text style={[styles.fieldValue, { color: theme.colors.text }]}>{session.displayName}</Text>
        </View>

        <Text style={[styles.fieldLabel, { color: theme.colors.muted }]}>EMAIL</Text>
        <View style={[styles.fieldBox, { backgroundColor: theme.colors.input, borderColor: theme.colors.border }]}>
          <Text style={[styles.fieldValue, { color: theme.colors.secondary }]}>{session.email}</Text>
        </View>
        <Text style={[styles.helperText, { color: theme.colors.muted }]}>Email is managed by your Google account.</Text>

        <Text style={[styles.fieldLabel, { color: theme.colors.muted }]}>ROLE</Text>
        <View style={[styles.fieldBox, { backgroundColor: theme.colors.input, borderColor: theme.colors.border }]}>
          <Text style={[styles.fieldValue, { color: theme.colors.text }]}>{session.role}</Text>
        </View>

        <Text style={[styles.fieldLabel, { color: theme.colors.muted }]}>PLAN</Text>
        <View style={[styles.fieldBox, { backgroundColor: theme.colors.input, borderColor: theme.colors.border }]}>
          <Text style={[styles.fieldValue, { color: theme.colors.text }]}>{session.plan}</Text>
        </View>

        <Text style={[styles.fieldLabel, { color: theme.colors.muted }]}>PUBLIC PROFILE</Text>
        <View style={[styles.fieldBox, { backgroundColor: theme.colors.input, borderColor: theme.colors.border }]}>
          <Text style={[styles.fieldValue, { color: theme.colors.text }]}>{publicProfileUrl}</Text>
        </View>
        <Text style={[styles.helperText, { color: theme.colors.muted }]}>
          Public slug `{publicProfileSlug}` routes to your current EventSlot profile preview on the web.
        </Text>
        <View style={styles.inlineActionRow}>
          <Pressable
            accessibilityRole="button"
            onPress={openPublicProfile}
            style={[styles.inlineActionButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
          >
            <Text style={[styles.inlineActionText, { color: theme.colors.text }]}>Open public profile</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={copyPublicProfile}
            style={[styles.inlineActionButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
          >
            <Text style={[styles.inlineActionText, { color: theme.colors.text }]}>Copy profile link</Text>
          </Pressable>
        </View>
        <View style={styles.inlineActionRow}>
          <Pressable
            accessibilityRole="button"
            onPress={sharePublicProfile}
            style={[styles.inlineActionButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
          >
            <Text style={[styles.inlineActionText, { color: theme.colors.text }]}>Share profile link</Text>
          </Pressable>
        </View>
        {profileLinkStatus ? <Text style={[styles.helperText, { color: theme.colors.secondary }]}>{profileLinkStatus}</Text> : null}

        <Text style={[styles.fieldLabel, { color: theme.colors.muted }]}>THEME</Text>
        <View style={[styles.fieldBox, { backgroundColor: theme.colors.input, borderColor: theme.colors.border }]}>
          <Text style={[styles.fieldValue, { color: theme.colors.text }]}>Dark mode only</Text>
        </View>
        <Text style={[styles.helperText, { color: theme.colors.muted }]}>
          EventSlot mobile follows the dark-only design system from the web parity brief.
        </Text>

        <Text style={[styles.fieldLabel, { color: theme.colors.muted }]}>LANGUAGE</Text>
        <Pressable
          accessibilityRole="button"
          onPress={toggleLanguage}
          style={[styles.fieldBox, { backgroundColor: theme.colors.input, borderColor: theme.colors.border }]}
        >
          <Text style={[styles.fieldValue, { color: theme.colors.text }]}>{preferences.preferredLanguage}</Text>
        </Pressable>
        <Text style={[styles.helperText, { color: theme.colors.muted }]}>
          Tap to switch between English and Swahili while the broader multi-language pass continues.
        </Text>
      </View>

      <View style={[styles.summaryCard, { backgroundColor: theme.colors.hero, borderColor: theme.colors.border }]}>
        <Text style={[styles.rowTitle, { color: theme.colors.text }]}>Workspace access</Text>
        <Text style={[styles.rowCaption, { color: theme.colors.secondary }]}>
          {events.length} event{events.length === 1 ? "" : "s"} available on this device from your EventSlot workspace.
        </Text>
      </View>

      <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.rowTitle, { color: theme.colors.text }]}>Subscription snapshot</Text>
        <Text style={[styles.rowCaption, { color: theme.colors.secondary }]}>
          {session.plan} plan active for {session.email}. Open billing to preview native M-Pesa plan upgrades and PAYG controls.
        </Text>
      </View>

      <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.rowTitle, { color: theme.colors.text }]}>About EventSlot</Text>
        <Text style={[styles.rowCaption, { color: theme.colors.secondary }]}>
          Native mobile shell for EventSlot organisers, registration, alerts, verification, exports, settings, and event operations.
        </Text>
        <Text style={[styles.helperText, { color: theme.colors.muted }]}>Version {appVersion}</Text>
      </View>

      <Text style={[styles.sectionTitle, { color: theme.colors.muted }]}>NOTIFICATIONS</Text>
      {notificationPreferences.map((preference) => (
        <NotificationRow
          key={preference.channel}
          preference={preference}
          onToggle={() => toggleNotificationPreference(preference)}
          theme={theme}
        />
      ))}

      <Text style={[styles.sectionTitle, { color: theme.colors.muted }]}>SUPPORT</Text>
      {supportRows.map((item) => (
        <SettingRow key={item.title} item={item} theme={theme} />
      ))}

      <Text style={[styles.sectionTitle, { color: theme.colors.muted }]}>BILLING</Text>
      {billingRows.map((item) => (
        <SettingRow key={item.title} item={item} theme={theme} />
      ))}

      <Text style={[styles.sectionTitle, { color: theme.colors.muted }]}>SETTINGS</Text>
      <SettingRow
        item={{
          title: "APP STATES",
          caption: getNativeUiStatesReadinessMessage(),
          actionLabel: "OPEN",
          onPress: () => navigate({ name: "states" })
        }}
        theme={theme}
      />
      <SettingRow
        item={{
          title: "Language",
          caption: `Currently ${preferences.preferredLanguage}. Tap to switch.`,
          actionLabel: "SWITCH",
          onPress: toggleLanguage
        }}
        theme={theme}
      />

      <Text style={[styles.sectionTitle, { color: theme.colors.muted }]}>ACCOUNT</Text>
      {accountActionRows.map((item) => (
        <SettingRow key={item.title} item={item} theme={theme} />
      ))}

      <Pressable accessibilityRole="button" onPress={onSignOut} style={[styles.signOutButton, { borderColor: theme.colors.border }]}>
        <Text style={[styles.signOut, { color: theme.colors.error }]}>Sign out</Text>
      </Pressable>
    </View>
  );
}

type SettingRowProps = {
  item: SettingRowItem;
  theme: NativeScreenProps["theme"];
};

function SettingRow({ item, theme }: SettingRowProps) {
  return (
    <Pressable
      accessibilityRole={item.onPress ? "button" : "text"}
      disabled={!item.onPress}
      onPress={item.onPress}
      style={[
        styles.row,
        {
          backgroundColor: theme.colors.surface,
          borderColor: item.danger ? "rgba(255, 107, 107, 0.22)" : theme.colors.border
        }
      ]}
    >
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: theme.colors.text }]}>{item.title}</Text>
        <Text style={[styles.rowCaption, { color: theme.colors.secondary }]}>{item.caption}</Text>
      </View>
      <Text
        style={[
          styles.statusPill,
          {
            backgroundColor: theme.colors.activeTab,
            color: item.danger ? theme.colors.error : item.onPress ? theme.colors.accent : theme.colors.muted
          }
        ]}
      >
        {item.actionLabel}
      </Text>
    </Pressable>
  );
}

type NotificationRowProps = {
  preference: NativeNotificationPreference;
  onToggle: () => void;
  theme: NativeScreenProps["theme"];
};

function NotificationRow({ preference, onToggle, theme }: NotificationRowProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: preference.enabled }}
      onPress={onToggle}
      style={[styles.row, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
    >
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: theme.colors.text }]}>{preference.title}</Text>
        <Text style={[styles.rowCaption, { color: theme.colors.secondary }]}>{preference.caption}</Text>
      </View>
      <Text style={[styles.statusPill, { backgroundColor: theme.colors.activeTab, color: preference.enabled ? theme.colors.success : theme.colors.muted }]}>
        {preference.enabled ? "ON" : "OFF"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 14
  },
  pageTitle: {
    ...typeScale.pageTitle
  },
  heroWrap: {
    alignItems: "center",
    gap: 16,
    paddingVertical: 10
  },
  profileImage: {
    borderRadius: 999,
    height: 118,
    width: 118
  },
  photoStatusCard: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: 18,
    paddingVertical: 14
  },
  photoStatusTitle: {
    ...typeScale.bodyStrong,
    textAlign: "center"
  },
  photoStatusText: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center"
  },
  detailCard: {
    borderRadius: 26,
    borderWidth: 1,
    gap: 12,
    padding: 22
  },
  cardTitle: {
    ...typeScale.sectionTitle
  },
  fieldLabel: {
    ...typeScale.label,
    marginTop: 8
  },
  fieldBox: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16
  },
  inlineActionRow: {
    flexDirection: "row",
    gap: 10
  },
  inlineActionButton: {
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  inlineActionText: {
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center"
  },
  fieldValue: {
    ...typeScale.body
  },
  helperText: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 20
  },
  sectionTitle: {
    ...typeScale.label
  },
  row: {
    alignItems: "center",
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    padding: 18
  },
  rowCopy: {
    flex: 1,
    gap: 4
  },
  rowTitle: {
    ...typeScale.bodyStrong
  },
  rowCaption: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 20
  },
  statusPill: {
    borderRadius: 999,
    fontFamily: fontFamily.medium,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 7,
    textAlign: "center"
  },
  summaryCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 8,
    padding: 18
  },
  signOutButton: {
    alignItems: "center",
    borderRadius: 22,
    borderWidth: 1,
    marginTop: 4,
    paddingVertical: 16
  },
  signOut: {
    ...typeScale.bodyStrong
  }
});
