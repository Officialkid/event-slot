import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { NativeExportAction } from "../domain/exports";
import { getEventAccessSummary, buildVerifierInviteAction, formatCapabilityLabel } from "../services/eventAccess";
import { findNativeEvent } from "../services/events";
import { buildExportActions, getExportReadinessMessage, prepareNativeExport } from "../services/exports";
import { isSupportedMapUrl, openMapUrl } from "../services/maps";
import { buildDemoRegistrationWorkspace } from "../services/registrations";
import { shareNativePayload } from "../services/share";
import { EventDetailScreenProps } from "./types";

export function EventDetailScreen({ eventId, theme, session, navigate, events, eventsLoading, eventsError, refreshEvents }: EventDetailScreenProps) {
  const event = findNativeEvent(events, eventId);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  if (eventsLoading) {
    return (
      <View style={styles.stack}>
        <Pressable accessibilityRole="button" onPress={() => navigate({ name: "events" })}>
          <Text style={[styles.backLink, { color: theme.colors.accent }]}>Back to events</Text>
        </Pressable>
        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Loading event</Text>
          <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>
            We are opening the native event workspace.
          </Text>
        </View>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.stack}>
        <Pressable accessibilityRole="button" onPress={() => navigate({ name: "events" })}>
          <Text style={[styles.backLink, { color: theme.colors.accent }]}>Back to events</Text>
        </Pressable>
        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Event unavailable</Text>
          <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>
            {eventsError ?? "This event could not be found in the native workspace."}
          </Text>
          <Text style={[styles.backLink, { color: theme.colors.accent }]} onPress={refreshEvents}>
            Refresh events
          </Text>
        </View>
      </View>
    );
  }

  const fillPercent = event.capacity > 0 ? Math.round((event.attendees / event.capacity) * 100) : 0;
  const canOpenMap = isSupportedMapUrl(event.mapDirectionsUrl);
  const registrationWorkspace = buildDemoRegistrationWorkspace(event);
  const exportActions = buildExportActions(event);
  const accessSummary = getEventAccessSummary(event);
  const verifierInvite = buildVerifierInviteAction(event);

  const handlePrepareExport = async (action: NativeExportAction) => {
    setExportStatus(`Preparing ${action.title.toLowerCase()}...`);

    try {
      const result = await prepareNativeExport(session, event, action);
      const message =
        result.status === "preparing"
          ? `${action.title} is preparing. Job: ${result.jobId ?? "pending"}`
          : `${action.title} is ready${result.expiresAt ? ` until ${new Date(result.expiresAt).toLocaleTimeString()}` : ""}.`;

      setExportStatus(message);

      if (result.downloadUrl) {
        await shareNativePayload({
          title: action.title,
          message,
          url: result.downloadUrl
        }).catch(() => {});
      }
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : "Could not prepare this export right now.");
    }
  };

  return (
    <View style={styles.stack}>
      <Pressable accessibilityRole="button" onPress={() => navigate({ name: "events" })}>
        <Text style={[styles.backLink, { color: theme.colors.accent }]}>Back to events</Text>
      </Pressable>

      <View style={[styles.hero, { backgroundColor: theme.colors.hero, borderColor: theme.colors.border }]}>
        <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>{event.status.toUpperCase()} EVENT</Text>
        <Text style={[styles.title, { color: theme.colors.text }]}>{event.title}</Text>
        <Text style={[styles.body, { color: theme.colors.secondary }]}>
          {event.dateLabel} | {event.timeLabel} | {event.venue}
        </Text>
        {canOpenMap ? (
          <Pressable accessibilityRole="button" onPress={() => openMapUrl(event.mapDirectionsUrl)} style={[styles.mapButton, { backgroundColor: theme.colors.accent }]}>
            <Text style={styles.mapButtonText}>Open directions</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.grid}>
        <InfoTile label="Confirmed" value={`${event.attendees}`} caption={`${fillPercent}% full`} theme={theme} />
        <InfoTile label="Waitlist" value={`${event.waitlist}`} caption="Auto promote later" theme={theme} />
        <InfoTile label="Capacity" value={`${event.capacity}`} caption={event.paymentMode} theme={theme} />
        <InfoTile label="Verify code" value={event.verifierCode} caption={`${event.role} access`} theme={theme} />
      </View>

      <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Native workspace</Text>
        <ActionLine label="Registrations" value="View confirmed, waitlist, and attendee records" theme={theme} />
        <ActionLine label="Access role" value={accessSummary.caption} theme={theme} />
        <ActionLine
          label="Maps"
          value={canOpenMap ? "Organiser-provided directions are ready" : "Add organiser-provided directions before launch"}
          action={canOpenMap ? "Open map" : undefined}
          onPress={canOpenMap ? () => openMapUrl(event.mapDirectionsUrl) : undefined}
          theme={theme}
        />
      </View>

      <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Verifier Team</Text>
        <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>{accessSummary.title}</Text>
        <View style={styles.capabilityRow}>
          {accessSummary.capabilities.map((capability) => (
            <Text key={capability} style={[styles.capabilityPill, { backgroundColor: theme.colors.activeTab, color: theme.colors.accent }]}>
              {formatCapabilityLabel(capability)}
            </Text>
          ))}
        </View>
        <View style={[styles.verifierCard, { backgroundColor: theme.colors.input, borderColor: theme.colors.border }]}>
          <Text style={[styles.actionLabel, { color: theme.colors.text }]}>{verifierInvite.title}</Text>
          <Text style={[styles.verifierCode, { color: theme.colors.accent }]}>{verifierInvite.verifierCode}</Text>
          <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>{verifierInvite.caption}</Text>
          <Text style={[styles.exportEndpoint, { color: theme.colors.muted }]}>{verifierInvite.shareLabel}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              shareNativePayload({
                title: verifierInvite.title,
                message: verifierInvite.shareLabel
              }).catch(() => {})
            }
            style={[styles.shareButton, { borderColor: theme.colors.border }]}
          >
            <Text style={[styles.inlineButtonText, { color: theme.colors.accent }]}>Share verifier code</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Export Centre</Text>
        <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>
          {getExportReadinessMessage(event)}
        </Text>
        {exportStatus ? (
          <Text style={[styles.exportStatus, { color: theme.colors.accent }]}>{exportStatus}</Text>
        ) : null}
        <View style={styles.exportGrid}>
          {exportActions.map((action) => (
            <ExportActionCard key={action.kind} action={action} onPrepare={() => handlePrepareExport(action)} theme={theme} />
          ))}
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Registrations</Text>
        <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>
          Native confirmed and waitlist records will load here from the event workspace API. Demo mode shows a small preview.
        </Text>
        <View style={styles.registrationTabs}>
          <Text style={[styles.registrationTab, { backgroundColor: theme.colors.activeTab, color: theme.colors.accent }]}>
            Confirmed {event.attendees}
          </Text>
          <Text style={[styles.registrationTab, { backgroundColor: theme.colors.activeTab, color: theme.colors.secondary }]}>
            Waitlist {event.waitlist}
          </Text>
        </View>
        {registrationWorkspace.confirmed.length > 0 ? (
          registrationWorkspace.confirmed.map((registration) => (
            <RegistrationLine key={registration.id} registration={registration} theme={theme} />
          ))
        ) : (
          <Text style={[styles.emptyText, { color: theme.colors.secondary }]}>No confirmed attendees yet.</Text>
        )}
        {registrationWorkspace.waitlist.length > 0 ? (
          <View style={[styles.waitlistPreview, { borderColor: theme.colors.border }]}>
            <Text style={[styles.actionLabel, { color: theme.colors.text }]}>Waitlist preview</Text>
            {registrationWorkspace.waitlist.map((registration) => (
              <RegistrationLine key={registration.id} registration={registration} theme={theme} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

type TileProps = {
  label: string;
  value: string;
  caption: string;
  theme: EventDetailScreenProps["theme"];
};

function InfoTile({ label, value, caption, theme }: TileProps) {
  return (
    <View style={[styles.tile, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <Text style={[styles.tileLabel, { color: theme.colors.muted }]}>{label}</Text>
      <Text style={[styles.tileValue, { color: theme.colors.text }]}>{value}</Text>
      <Text style={[styles.tileCaption, { color: theme.colors.secondary }]}>{caption}</Text>
    </View>
  );
}

type ActionLineProps = {
  label: string;
  value: string;
  action?: string;
  onPress?: () => void;
  theme: EventDetailScreenProps["theme"];
};

function ActionLine({ label, value, action, onPress, theme }: ActionLineProps) {
  return (
    <View style={[styles.actionLine, { borderColor: theme.colors.border }]}>
      <View style={styles.actionCopy}>
        <Text style={[styles.actionLabel, { color: theme.colors.text }]}>{label}</Text>
        <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>{value}</Text>
      </View>
      {action ? (
        <Pressable accessibilityRole="button" onPress={onPress} style={[styles.inlineButton, { borderColor: theme.colors.border }]}>
          <Text style={[styles.inlineButtonText, { color: theme.colors.accent }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

type ExportActionCardProps = {
  action: NativeExportAction;
  onPrepare: () => void;
  theme: EventDetailScreenProps["theme"];
};

function ExportActionCard({ action, onPrepare, theme }: ExportActionCardProps) {
  const ready = action.state === "ready";

  return (
    <View style={[styles.exportCard, { backgroundColor: theme.colors.input, borderColor: ready ? theme.colors.accent : theme.colors.border }]}>
      <Text style={[styles.actionLabel, { color: theme.colors.text }]}>{action.title}</Text>
      <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>{action.caption}</Text>
      <Text style={[styles.exportEndpoint, { color: theme.colors.muted }]}>{action.endpoint}</Text>
      <Text style={[styles.registrationStatus, { backgroundColor: theme.colors.activeTab, color: ready ? theme.colors.accent : theme.colors.muted }]}>
        {ready ? "READY" : "LIVE API"}
      </Text>
      <Pressable accessibilityRole="button" onPress={onPrepare} style={[styles.shareButton, { borderColor: theme.colors.border }]}>
        <Text style={[styles.inlineButtonText, { color: theme.colors.accent }]}>Prepare export</Text>
      </Pressable>
    </View>
  );
}

type RegistrationLineProps = {
  registration: ReturnType<typeof buildDemoRegistrationWorkspace>["confirmed"][number];
  theme: EventDetailScreenProps["theme"];
};

function RegistrationLine({ registration, theme }: RegistrationLineProps) {
  const meta = [
    registration.attendeePhone,
    registration.attendeeEmail,
    registration.waitlistPosition ? `#${registration.waitlistPosition} waitlist` : undefined,
    registration.submittedAtLabel
  ].filter(Boolean);

  return (
    <View style={[styles.registrationLine, { borderColor: theme.colors.border }]}>
      <View style={styles.actionCopy}>
        <Text style={[styles.actionLabel, { color: theme.colors.text }]}>{registration.attendeeName}</Text>
        <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>{meta.join(" | ")}</Text>
      </View>
      <Text style={[styles.registrationStatus, { backgroundColor: theme.colors.activeTab, color: registration.status === "confirmed" ? theme.colors.success : theme.colors.accent }]}>
        {registration.status.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 14
  },
  backLink: {
    fontSize: 14,
    fontWeight: "900"
  },
  hero: {
    borderRadius: 30,
    borderWidth: 1,
    gap: 12,
    padding: 22
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2.4
  },
  title: {
    fontSize: 31,
    fontWeight: "900",
    lineHeight: 36
  },
  body: {
    fontSize: 15,
    lineHeight: 23
  },
  mapButton: {
    alignItems: "center",
    borderRadius: 999,
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  mapButtonText: {
    color: "#0A0A0A",
    fontSize: 13,
    fontWeight: "900"
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  tile: {
    borderRadius: 22,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    minWidth: "47%",
    padding: 16
  },
  tileLabel: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.8,
    textTransform: "uppercase"
  },
  tileValue: {
    fontSize: 26,
    fontWeight: "900"
  },
  tileCaption: {
    fontSize: 12,
    fontWeight: "700"
  },
  section: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 8
  },
  actionLine: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingVertical: 14
  },
  actionCopy: {
    flex: 1,
    gap: 4
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: "900"
  },
  actionValue: {
    fontSize: 13,
    lineHeight: 19
  },
  inlineButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  inlineButtonText: {
    fontSize: 12,
    fontWeight: "900"
  },
  exportGrid: {
    gap: 10,
    marginTop: 12
  },
  exportCard: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 7,
    padding: 14
  },
  exportEndpoint: {
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 16
  },
  exportStatus: {
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 20,
    marginTop: 10
  },
  capabilityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10
  },
  capabilityPill: {
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  verifierCard: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    marginTop: 12,
    padding: 14
  },
  verifierCode: {
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 3
  },
  shareButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 11
  },
  registrationTabs: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10
  },
  registrationTab: {
    borderRadius: 999,
    flex: 1,
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    paddingVertical: 10,
    textAlign: "center"
  },
  registrationLine: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingVertical: 13
  },
  registrationStatus: {
    borderRadius: 999,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 6
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 20,
    paddingTop: 12
  },
  waitlistPreview: {
    borderTopWidth: 1,
    gap: 2,
    marginTop: 8,
    paddingTop: 12
  }
});
