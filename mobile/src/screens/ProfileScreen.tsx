import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { nativeConfig } from "../config";
import { NativeConnectivityProbeResult, NativeDeviceQaItem, NativeDeviceQaProgress, NativeDeviceQaStatus } from "../domain/deviceQa";
import { NativeNotificationPreference } from "../domain/notifications";
import { NativePreferences } from "../domain/preferences";
import { NativeRuntimeInfoItem } from "../domain/runtimeInfo";
import { NativePermissionItem, NativeReadinessItem } from "../domain/settings";
import { buildNativeDeviceQaChecklist, buildNativeQaEvidenceReport, formatConnectivityCheckedAt, runNativeConnectivityProbe } from "../services/deviceQa";
import {
  applyNativeDeviceQaProgress,
  getDeviceQaProgressReadinessMessage,
  loadNativeDeviceQaProgress,
  resetNativeDeviceQaItemStatus,
  saveNativeDeviceQaItemStatus
} from "../services/deviceQaProgress";
import { buildNotificationPreferences, getPushReadinessMessage, prepareNativePushRegistration, registerPushToken } from "../services/notifications";
import { defaultNativePreferences, loadNativePreferences, saveNotificationPreference } from "../services/preferences";
import { buildNativeRuntimeInfo, getRuntimeInfoReadinessMessage } from "../services/runtimeInfo";
import { nativePermissionItems, nativeReadinessItems, nativeReleaseGateItems } from "../services/settings";
import { shareNativePayload } from "../services/share";
import { getNativeLogoutCleanupReadinessMessage } from "../services/sessionCleanup";
import { getSessionStorageReadinessMessage } from "../services/sessionStore";
import { getNativeStorageReadinessMessage } from "../services/nativeStorage";
import {
  getAccountDeletionReadinessMessage,
  buildNativeTesterFeedbackEmailUrl,
  openAccountDeletionPolicy,
  openSupportLink,
  requestAccountDeletionByEmail,
  supportLinks
} from "../services/support";
import { NativeScreenProps } from "./types";

type AccountSetting = {
  title: string;
  caption: string;
  actionLabel: string;
  onPress?: () => void;
};

export function ProfileScreen({ theme, session, events, onSignOut }: NativeScreenProps) {
  const [preferences, setPreferences] = useState<NativePreferences>(defaultNativePreferences);
  const [pushStatus, setPushStatus] = useState("Push token has not been requested on this device.");
  const [connectivityProbe, setConnectivityProbe] = useState<NativeConnectivityProbeResult | null>(null);
  const [connectivityChecking, setConnectivityChecking] = useState(false);
  const [qaShareStatus, setQaShareStatus] = useState("No QA evidence shared yet.");
  const [deviceQaProgress, setDeviceQaProgress] = useState<NativeDeviceQaProgress>({});
  const pushReadiness = getPushReadinessMessage();
  const nativeStorageReadiness = getNativeStorageReadinessMessage();
  const sessionStorageReadiness = getSessionStorageReadinessMessage();
  const notificationPreferences = useMemo(() => buildNotificationPreferences(preferences), [preferences]);
  const deviceQaChecklist = useMemo(
    () => applyNativeDeviceQaProgress(buildNativeDeviceQaChecklist(session, events.length), deviceQaProgress),
    [deviceQaProgress, events.length, session]
  );
  const runtimeInfo = useMemo(() => buildNativeRuntimeInfo(), []);
  const accountSettings: AccountSetting[] = [
    {
      title: "Profile",
      caption: "Live profile identity is available from the native session; profile editing remains a later native account screen.",
      actionLabel: "GATED"
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
      title: "Tester feedback",
      caption: "Open a structured native QA feedback email with your runtime, connectivity, and checklist context.",
      actionLabel: "EMAIL",
      onPress: () => {
        openSupportLink(
          buildNativeTesterFeedbackEmailUrl({
            checklist: deviceQaChecklist,
            connectivityProbe,
            eventsCount: events.length,
            runtimeInfo,
            session
          })
        ).catch(() => {});
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
    },
    {
      title: "Deletion policy",
      caption: "Open the hosted account deletion page required for store compliance.",
      actionLabel: "OPEN",
      onPress: () => {
        openAccountDeletionPolicy().catch(() => {});
      }
    },
    {
      title: "Request deletion by email",
      caption: "Prepare an email from this signed-in account while direct native deletion remains gated.",
      actionLabel: "EMAIL",
      onPress: () => {
        requestAccountDeletionByEmail(session).catch(() => {});
      }
    }
  ];

  useEffect(() => {
    loadNativePreferences()
      .then(setPreferences)
      .catch(() => setPreferences(defaultNativePreferences));

    loadNativeDeviceQaProgress()
      .then(setDeviceQaProgress)
      .catch(() => setDeviceQaProgress({}));
  }, []);

  const toggleNotificationPreference = (preference: NativeNotificationPreference) => {
    saveNotificationPreference(preference.channel, !preference.enabled)
      .then(setPreferences)
      .catch(() => {});
  };

  const handlePreparePushRegistration = async () => {
    setPushStatus("Requesting notification permission...");
    const result = await prepareNativePushRegistration(session);

    if (result.status === "registered-local") {
      setPushStatus(`${result.message} Token ending ${result.registration.pushToken.slice(-8)}.`);
      const backendResult = await registerPushToken(result.registration, session);
      setPushStatus(`${result.message} Token ending ${result.registration.pushToken.slice(-8)}. ${backendResult.message}`);
      return;
    }

    setPushStatus(result.message);
  };

  const handleConnectivityProbe = async () => {
    setConnectivityChecking(true);
    const result = await runNativeConnectivityProbe();
    setConnectivityProbe(result);
    setConnectivityChecking(false);
  };

  const handleShareQaEvidence = async () => {
    const message = buildNativeQaEvidenceReport({
      checklist: deviceQaChecklist,
      connectivityProbe,
      eventsCount: events.length,
      releaseGates: nativeReleaseGateItems,
      runtimeInfo,
      session
    });

    const shared = await shareNativePayload({
      title: "EventSlot Native QA Evidence",
      message
    });

    setQaShareStatus(shared ? "QA evidence shared from this device." : "QA evidence share sheet was closed.");
  };

  const handleDeviceQaStatusChange = async (key: string, status: NativeDeviceQaStatus) => {
    const nextProgress = await saveNativeDeviceQaItemStatus(deviceQaProgress, key, status);
    setDeviceQaProgress(nextProgress);
  };

  const handleDeviceQaStatusReset = async (key: string) => {
    const nextProgress = await resetNativeDeviceQaItemStatus(deviceQaProgress, key);
    setDeviceQaProgress(nextProgress);
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
              : "Live API mode is enabled for native integration testing with bearer-token sessions."}
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

      <View style={[styles.summaryCard, { backgroundColor: theme.colors.hero, borderColor: theme.colors.border }]}>
        <Text style={[styles.rowTitle, { color: theme.colors.text }]}>Logout cleanup</Text>
        <Text style={[styles.rowCaption, { color: theme.colors.secondary }]}>{getNativeLogoutCleanupReadinessMessage()}</Text>
      </View>

      <Text style={[styles.sectionTitle, { color: theme.colors.muted }]}>ACCOUNT</Text>
      {accountSettings.map((item) => (
        <SettingRow key={item.title} item={item} theme={theme} />
      ))}

      <Text style={[styles.sectionTitle, { color: theme.colors.muted }]}>NATIVE READINESS</Text>
      {nativeReadinessItems.map((item) => (
        <ReadinessRow key={item.key} item={item} theme={theme} />
      ))}

      <Text style={[styles.sectionTitle, { color: theme.colors.muted }]}>BUILD INFO</Text>
      <View style={[styles.summaryCard, { backgroundColor: theme.colors.hero, borderColor: theme.colors.border }]}>
        <Text style={[styles.rowTitle, { color: theme.colors.text }]}>Native runtime</Text>
        <Text style={[styles.rowCaption, { color: theme.colors.secondary }]}>{getRuntimeInfoReadinessMessage()}</Text>
      </View>
      {runtimeInfo.map((item) => (
        <RuntimeInfoRow key={item.key} item={item} theme={theme} />
      ))}

      <Text style={[styles.sectionTitle, { color: theme.colors.muted }]}>RELEASE GATES</Text>
      {nativeReleaseGateItems.map((item) => (
        <ReadinessRow key={item.key} item={item} theme={theme} />
      ))}

      <Text style={[styles.sectionTitle, { color: theme.colors.muted }]}>DEVICE QA</Text>
      <View style={[styles.summaryCard, { backgroundColor: theme.colors.hero, borderColor: theme.colors.border }]}>
        <Text style={[styles.rowTitle, { color: theme.colors.text }]}>Connectivity probe</Text>
        <Text style={[styles.rowCaption, { color: connectivityProbe?.status === "error" ? theme.colors.error : theme.colors.secondary }]}>
          {connectivityProbe?.message ?? "Run this on the Android test device before signing off native QA."}
        </Text>
        <Text style={[styles.rowCaption, { color: theme.colors.muted }]}>
          Last checked: {formatConnectivityCheckedAt(connectivityProbe?.checkedAt ?? null)}
        </Text>
        <Pressable
          accessibilityRole="button"
          disabled={connectivityChecking}
          onPress={handleConnectivityProbe}
          style={[styles.inlineButton, { borderColor: theme.colors.border, opacity: connectivityChecking ? 0.6 : 1 }]}
        >
          <Text style={[styles.inlineButtonText, { color: theme.colors.accent }]}>
            {connectivityChecking ? "Checking..." : "Run connectivity check"}
          </Text>
        </Pressable>
      </View>
      <View style={[styles.summaryCard, { backgroundColor: theme.colors.hero, borderColor: theme.colors.border }]}>
        <Text style={[styles.rowTitle, { color: theme.colors.text }]}>QA progress</Text>
        <Text style={[styles.rowCaption, { color: theme.colors.secondary }]}>{getDeviceQaProgressReadinessMessage()}</Text>
      </View>
      {deviceQaChecklist.map((item) => (
        <DeviceQaRow
          key={item.key}
          item={item}
          onMarkPass={() => handleDeviceQaStatusChange(item.key, "pass")}
          onMarkReview={() => handleDeviceQaStatusChange(item.key, "needs-review")}
          onReset={() => handleDeviceQaStatusReset(item.key)}
          theme={theme}
        />
      ))}
      <View style={[styles.summaryCard, { backgroundColor: theme.colors.hero, borderColor: theme.colors.border }]}>
        <Text style={[styles.rowTitle, { color: theme.colors.text }]}>QA evidence report</Text>
        <Text style={[styles.rowCaption, { color: theme.colors.secondary }]}>
          Share runtime info, connectivity result, checklist items, and release gates after testing on the Android device.
        </Text>
        <Text style={[styles.rowCaption, { color: theme.colors.muted }]}>{qaShareStatus}</Text>
        <Pressable accessibilityRole="button" onPress={handleShareQaEvidence} style={[styles.inlineButton, { borderColor: theme.colors.border }]}>
          <Text style={[styles.inlineButtonText, { color: theme.colors.accent }]}>Share QA evidence</Text>
        </Pressable>
      </View>

      <Text style={[styles.sectionTitle, { color: theme.colors.muted }]}>PERMISSIONS</Text>
      {nativePermissionItems.map((item) => (
        <PermissionRow key={item.key} item={item} theme={theme} />
      ))}

      <Text style={[styles.sectionTitle, { color: theme.colors.muted }]}>NOTIFICATION CHANNELS</Text>
      <View style={[styles.summaryCard, { backgroundColor: theme.colors.hero, borderColor: theme.colors.border }]}>
        <Text style={[styles.rowTitle, { color: theme.colors.text }]}>Push readiness</Text>
        <Text style={[styles.rowCaption, { color: theme.colors.secondary }]}>{pushReadiness}</Text>
        <Text style={[styles.rowCaption, { color: theme.colors.secondary }]}>{pushStatus}</Text>
        <Pressable accessibilityRole="button" onPress={handlePreparePushRegistration} style={[styles.inlineButton, { borderColor: theme.colors.border }]}>
          <Text style={[styles.inlineButtonText, { color: theme.colors.accent }]}>Prepare push token</Text>
        </Pressable>
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
          {events.length} native events are available in this preview. Live mode uses owned and invited events from the native workspace API; demo mode keeps local sample data.
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

type RuntimeInfoRowProps = {
  item: NativeRuntimeInfoItem;
  theme: NativeScreenProps["theme"];
};

function RuntimeInfoRow({ item, theme }: RuntimeInfoRowProps) {
  const valueColor = item.tone === "ready" ? theme.colors.success : item.tone === "blocked" ? theme.colors.error : theme.colors.secondary;

  return (
    <View style={[styles.row, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: theme.colors.text }]}>{item.label}</Text>
        <Text style={[styles.rowCaption, { color: valueColor }]}>{item.value}</Text>
      </View>
      <Text style={[styles.statusPill, { backgroundColor: theme.colors.activeTab, color: valueColor }]}>
        {item.tone.toUpperCase()}
      </Text>
    </View>
  );
}

type DeviceQaRowProps = {
  item: NativeDeviceQaItem;
  onMarkPass: () => void;
  onMarkReview: () => void;
  onReset: () => void;
  theme: NativeScreenProps["theme"];
};

function DeviceQaRow({ item, onMarkPass, onMarkReview, onReset, theme }: DeviceQaRowProps) {
  const statusColor =
    item.status === "pass"
      ? theme.colors.success
      : item.status === "needs-review"
        ? theme.colors.accent
        : item.status === "blocked"
          ? theme.colors.error
          : theme.colors.muted;

  return (
    <View style={[styles.row, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: theme.colors.text }]}>{item.title}</Text>
        <Text style={[styles.rowCaption, { color: theme.colors.secondary }]}>{item.expected}</Text>
      </View>
      <Text style={[styles.statusPill, { backgroundColor: theme.colors.activeTab, color: statusColor }]}>
        {item.status.toUpperCase()}
      </Text>
      <View style={styles.qaActionRow}>
        <Pressable accessibilityRole="button" onPress={onMarkPass} style={[styles.qaActionButton, { borderColor: theme.colors.border }]}>
          <Text style={[styles.qaActionText, { color: theme.colors.success }]}>Pass</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onMarkReview} style={[styles.qaActionButton, { borderColor: theme.colors.border }]}>
          <Text style={[styles.qaActionText, { color: theme.colors.accent }]}>Review</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onReset} style={[styles.qaActionButton, { borderColor: theme.colors.border }]}>
          <Text style={[styles.qaActionText, { color: theme.colors.muted }]}>Reset</Text>
        </Pressable>
      </View>
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
    flexWrap: "wrap",
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
  inlineButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  inlineButtonText: {
    fontSize: 13,
    fontWeight: "900"
  },
  qaActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    width: "100%"
  },
  qaActionButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  qaActionText: {
    fontSize: 12,
    fontWeight: "900"
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
