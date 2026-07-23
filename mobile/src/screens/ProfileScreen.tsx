import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { nativeConfig } from "../config";
import { NativeNotificationPreference } from "../domain/notifications";
import { NativePreferences } from "../domain/preferences";
import { NativePermissionItem, NativeReadinessItem } from "../domain/settings";
import { buildNotificationPreferences, getPushReadinessMessage } from "../services/notifications";
import { defaultNativePreferences, loadNativePreferences, saveNotificationPreference } from "../services/preferences";
import { nativePermissionItems, nativeReadinessItems } from "../services/settings";
import { getSessionStorageReadinessMessage } from "../services/sessionStore";
import { getNativeStorageReadinessMessage } from "../services/nativeStorage";
import { getAccountDeletionReadinessMessage, openSupportLink, supportLinks } from "../services/support";
import { NativeScreenProps } from "./types";

type AccountSetting = {
  title: string;
  caption: string;
  actionLabel: string;
  onPress?: () => void;
};

export function ProfileScreen({ theme, session, events, onSignOut }: NativeScreenProps) {
  const [preferences, setPreferences] = useState<NativePreferences>(defaultNativePreferences);
  const pushReadiness = getPushReadinessMessage();
  const nativeStorageReadiness = getNativeStorageReadinessMessage();
  const sessionStorageReadiness = getSessionStorageReadinessMessage();
  const notificationPreferences = useMemo(() => buildNotificationPreferences(preferences), [preferences]);
  const accountSettings: AccountSetting[] = [
    {
      title: "Profile",
      caption: "Account editing will connect after live native auth is ready.",
      actionLabel: "SOON"
    },
    {
      title: "Appearance",
      caption: "Theme switching is available from the top native app controls.",
      actionLabel: preferences.themeName.toUpperCase()
    },
    {
      title: "Privacy policy",
      caption: "Open the hosted EventSlot privacy policy.",
      actionLabel: "OPEN",
      onPress: () => {
        openSupportLink(supportLinks.privacyPolicy).catch(() => {});
      }
    },
    {
      title: "Terms of service",
      caption: "Open the hosted EventSlot terms for organizers and attendees.",
      actionLabel: "OPEN",
      onPress: () => {
        openSupportLink(supportLinks.terms).catch(() => {});
      }
    },
    {
      title: "Support",
      caption: "Email EventSlot support for app testing feedback or account help.",
      actionLabel: "EMAIL",
      onPress: () => {
        openSupportLink(supportLinks.testerSupport).catch(() => {});
      }
    },
    {
      title: "Website",
      caption: "Open the live EventSlot web app while native features are being completed.",
      actionLabel: "OPEN",
      onPress: () => {
        openSupportLink(supportLinks.website).catch(() => {});
      }
    },
    {
      title: "Account deletion",
      caption: getAccountDeletionReadinessMessage(),
      actionLabel: "GATED"
    }
  ];

  useEffect(() => {
    loadNativePreferences()
      .then(setPreferences)
      .catch(() => setPreferences(defaultNativePreferences));
  }, []);

  const toggleNotificationPreference = (preference: NativeNotificationPreference) => {
    saveNotificationPreference(preference.channel, !preference.enabled)
      .then(setPreferences)
      .catch(() => {});
  };

  return (
    <View style={styles.stack}>
      <View style={[styles.profileHero, { backgroundColor: theme.colors.greenPanel }]}>
        <View style={[styles.avatar, { backgroundColor: theme.colors.avatar }]}>
          <Text style={[styles.avatarText, { color: theme.colors.text }]}>{session.displayName.slice(0, 1)}</Text>
        </View>
        <View style={styles.profileCopy}>
          <Text style={[styles.name, { color: theme.colors.text }]}>{session.displayName}</Text>
          <Text style={[styles.email, { color: theme.colors.secondary }]}>{session.email}</Text>
          <Text style={[styles.role, { color: theme.colors.accent }]}>
            {session.role.toUpperCase()} | {session.plan.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={[styles.modeCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View>
          <Text style={[styles.rowTitle, { color: theme.colors.text }]}>Native app mode</Text>
          <Text style={[styles.rowCaption, { color: theme.colors.secondary }]}>
            {nativeConfig.authMode === "demo"
              ? "Safe demo mode is active until real native auth is ready."
              : "Live API mode is enabled for native integration testing."}
          </Text>
        </View>
        <Text style={[styles.statusPill, { backgroundColor: theme.colors.activeTab, color: theme.colors.accent }]}>
          {nativeConfig.authMode.toUpperCase()}
        </Text>
      </View>

      <View style={[styles.summaryCard, { backgroundColor: theme.colors.hero, borderColor: theme.colors.border }]}>
        <Text style={[styles.rowTitle, { color: theme.colors.text }]}>Native storage</Text>
        <Text style={[styles.rowCaption, { color: theme.colors.secondary }]}>{nativeStorageReadiness}</Text>
      </View>

      <View style={[styles.summaryCard, { backgroundColor: theme.colors.hero, borderColor: theme.colors.border }]}>
        <Text style={[styles.rowTitle, { color: theme.colors.text }]}>Session storage</Text>
        <Text style={[styles.rowCaption, { color: theme.colors.secondary }]}>{sessionStorageReadiness}</Text>
      </View>

      <Text style={[styles.sectionTitle, { color: theme.colors.muted }]}>ACCOUNT</Text>
      {accountSettings.map((item) => (
        <SettingRow key={item.title} item={item} theme={theme} />
      ))}

      <Text style={[styles.sectionTitle, { color: theme.colors.muted }]}>NATIVE READINESS</Text>
      {nativeReadinessItems.map((item) => (
        <ReadinessRow key={item.key} item={item} theme={theme} />
      ))}

      <Text style={[styles.sectionTitle, { color: theme.colors.muted }]}>PERMISSIONS</Text>
      {nativePermissionItems.map((item) => (
        <PermissionRow key={item.key} item={item} theme={theme} />
      ))}

      <Text style={[styles.sectionTitle, { color: theme.colors.muted }]}>NOTIFICATION CHANNELS</Text>
      <View style={[styles.summaryCard, { backgroundColor: theme.colors.hero, borderColor: theme.colors.border }]}>
        <Text style={[styles.rowTitle, { color: theme.colors.text }]}>Push readiness</Text>
        <Text style={[styles.rowCaption, { color: theme.colors.secondary }]}>{pushReadiness}</Text>
      </View>
      {notificationPreferences.map((preference) => (
        <NotificationRow
          key={preference.channel}
          preference={preference}
          onToggle={() => toggleNotificationPreference(preference)}
          theme={theme}
        />
      ))}

      <View style={[styles.summaryCard, { backgroundColor: theme.colors.hero, borderColor: theme.colors.border }]}>
        <Text style={[styles.rowTitle, { color: theme.colors.text }]}>Workspace summary</Text>
        <Text style={[styles.rowCaption, { color: theme.colors.secondary }]}>
          {events.length} native events are available in this preview. Live owned and invited events will replace demo data after the native session API is complete.
        </Text>
      </View>

      <Pressable accessibilityRole="button" onPress={onSignOut} style={[styles.signOutButton, { borderColor: theme.colors.border }]}>
        <Text style={[styles.signOut, { color: theme.colors.error }]}>Sign out of native demo</Text>
      </Pressable>
    </View>
  );
}

type SettingRowProps = {
  item: AccountSetting;
  theme: NativeScreenProps["theme"];
};

function SettingRow({ item, theme }: SettingRowProps) {
  return (
    <Pressable
      accessibilityRole={item.onPress ? "button" : "text"}
      disabled={!item.onPress}
      onPress={item.onPress}
      style={[styles.row, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
    >
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: theme.colors.text }]}>{item.title}</Text>
        <Text style={[styles.rowCaption, { color: theme.colors.secondary }]}>{item.caption}</Text>
      </View>
      <Text style={[styles.statusPill, { backgroundColor: theme.colors.activeTab, color: item.onPress ? theme.colors.accent : theme.colors.muted }]}>
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

type ReadinessRowProps = {
  item: NativeReadinessItem;
  theme: NativeScreenProps["theme"];
};

function ReadinessRow({ item, theme }: ReadinessRowProps) {
  const statusColor =
    item.status === "ready" ? theme.colors.success : item.status === "in-progress" ? theme.colors.accent : theme.colors.error;

  return (
    <View style={[styles.row, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: theme.colors.text }]}>{item.title}</Text>
        <Text style={[styles.rowCaption, { color: theme.colors.secondary }]}>{item.caption}</Text>
      </View>
      <Text style={[styles.statusPill, { backgroundColor: theme.colors.activeTab, color: statusColor }]}>
        {item.status.toUpperCase()}
      </Text>
    </View>
  );
}

type PermissionRowProps = {
  item: NativePermissionItem;
  theme: NativeScreenProps["theme"];
};

function PermissionRow({ item, theme }: PermissionRowProps) {
  return (
    <View style={[styles.row, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: theme.colors.text }]}>{item.title}</Text>
        <Text style={[styles.rowCaption, { color: theme.colors.secondary }]}>{item.caption}</Text>
      </View>
      <Text style={[styles.statusPill, { backgroundColor: theme.colors.activeTab, color: item.enabled ? theme.colors.success : theme.colors.muted }]}>
        {item.enabled ? "ON" : "OFF"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 14
  },
  profileHero: {
    alignItems: "center",
    borderRadius: 30,
    flexDirection: "row",
    gap: 18,
    padding: 22
  },
  profileCopy: {
    flex: 1
  },
  avatar: {
    alignItems: "center",
    borderRadius: 28,
    height: 56,
    justifyContent: "center",
    width: 56
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "900"
  },
  name: {
    fontSize: 24,
    fontWeight: "900"
  },
  role: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.4,
    marginTop: 4
  },
  email: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 3
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2.4,
    marginTop: 8
  },
  modeCard: {
    alignItems: "center",
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    padding: 18
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
    fontSize: 18,
    fontWeight: "800"
  },
  rowCaption: {
    fontSize: 14,
    lineHeight: 20
  },
  chevron: {
    fontSize: 22,
    fontWeight: "900"
  },
  statusPill: {
    borderRadius: 999,
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
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 14
  },
  signOut: {
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center"
  }
});
