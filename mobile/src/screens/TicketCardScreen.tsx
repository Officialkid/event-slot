import { useState } from "react";
import QRCode from "react-native-qrcode-svg";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { EventSlotInsetCard } from "../components/EventSlotInsetCard";
import { EventSlotPageHeader } from "../components/EventSlotPageHeader";
import { EventSlotPanel } from "../components/EventSlotPanel";
import { EventSlotPill } from "../components/EventSlotPill";
import { NativeEvent } from "../domain/events";
import { NativeRegistrationPreview } from "../domain/registrations";
import { exportTicketPdf } from "../services/ticketExport";
import { AppTheme } from "../theme";
import { fontFamily, typeScale } from "../typography";

type TicketCardScreenProps = {
  event: NativeEvent;
  registration: NativeRegistrationPreview;
  theme: AppTheme;
  onBackPress: () => void;
};

export function TicketCardScreen({ event, registration, theme, onBackPress }: TicketCardScreenProps) {
  const ticketCode = registration.confirmationCode ?? registration.ticketCode ?? `EVT-${registration.id.slice(-6).toUpperCase()}`;
  const tierLabel = registration.tierLabel ?? (event.monetization === "paid" ? event.entryFeeLabel ?? "Paid entry" : "General");
  const hasConfirmedTicket = registration.status === "confirmed";
  const responseAnswers = registration.answers?.filter((answer) => answer.value.trim()) ?? [];
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const recordSummary = [
    registration.source ?? "Registration form",
    registration.submittedAtLabel,
    registration.waitlistPosition ? `Waitlist #${registration.waitlistPosition}` : undefined
  ]
    .filter(Boolean)
    .join(" | ");

  const handleExportTicketPdf = async () => {
    try {
      setExporting(true);
      const result = await exportTicketPdf({
        event,
        registration,
        ticketCode
      });
      setExportStatus(result.message);
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : "Could not prepare the ticket PDF.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
      <EventSlotPageHeader
        theme={theme}
        title="Attendee detail"
        caption={event.title}
        backLabel="Back to event"
        onBackPress={onBackPress}
      />

      <EventSlotPanel theme={theme} tone="hero" style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <Text style={[styles.summaryTitle, { color: theme.colors.text }]}>{registration.attendeeName}</Text>
          <EventSlotPill
            label={registration.status.toUpperCase()}
            theme={theme}
            tone={registration.status === "confirmed" ? "success" : "accent"}
          />
        </View>
        <Text style={[styles.meta, { color: theme.colors.secondary }]}>{recordSummary}</Text>
        <Text style={[styles.meta, { color: theme.colors.accent }]}>
          {hasConfirmedTicket ? "Ticket-ready attendee record" : "Waitlist attendee record"}
        </Text>
      </EventSlotPanel>

      <View style={[styles.ticketShell, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={styles.brandRow}>
          <Text style={[styles.brand, { color: theme.colors.text }]}>EventSlot</Text>
          <Text style={[styles.brandMeta, { color: theme.colors.accent }]}>{event.role}</Text>
        </View>

        <Text style={[styles.title, { color: theme.colors.text }]}>{event.title}</Text>
        <Text style={[styles.meta, { color: theme.colors.secondary }]}>
          {[event.dateLabel, event.timeLabel, event.venue].filter(Boolean).join(" | ")}
        </Text>

        <EventSlotInsetCard theme={theme} style={styles.infoCard}>
          <Text style={[styles.infoLine, { color: theme.colors.text }]}>Name: {registration.attendeeName}</Text>
          {registration.attendeeEmail ? <Text style={[styles.infoLine, { color: theme.colors.secondary }]}>Email: {registration.attendeeEmail}</Text> : null}
          {registration.attendeePhone ? <Text style={[styles.infoLine, { color: theme.colors.secondary }]}>Phone: {registration.attendeePhone}</Text> : null}
          <Text style={[styles.infoLine, { color: theme.colors.accent }]}>Ticket type: {tierLabel}</Text>
          <Text style={[styles.infoLine, { color: theme.colors.secondary }]}>Source: {registration.source ?? "Registration form"}</Text>
        </EventSlotInsetCard>

        {hasConfirmedTicket ? (
          <>
            <View style={[styles.qrWrap, { borderColor: theme.colors.border, backgroundColor: "#FFFFFF" }]}>
              <QRCode value={ticketCode} size={180} color="#0A0A0A" backgroundColor="#FFFFFF" />
            </View>
            <Text style={[styles.ticketCode, { color: theme.colors.accent }]}>{ticketCode}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={handleExportTicketPdf}
              style={[styles.secondaryAction, { borderColor: theme.colors.border, backgroundColor: theme.colors.input }]}
            >
              <Text style={[styles.secondaryActionText, { color: theme.colors.text }]}>
                {exporting ? "Preparing PDF..." : "Download ticket PDF"}
              </Text>
            </Pressable>
            {exportStatus ? <Text style={[styles.meta, { color: theme.colors.secondary, textAlign: "center" }]}>{exportStatus}</Text> : null}
          </>
        ) : (
          <EventSlotInsetCard theme={theme} style={styles.waitlistCard}>
            <Text style={[styles.waitlistTitle, { color: theme.colors.text }]}>Waitlist status</Text>
            <Text style={[styles.infoLine, { color: theme.colors.secondary }]}>
              This attendee is still waiting for a confirmed spot, so no active QR ticket is shown yet.
            </Text>
            {registration.waitlistPosition ? (
              <Text style={[styles.ticketCode, { color: theme.colors.accent }]}>Position #{registration.waitlistPosition}</Text>
            ) : null}
          </EventSlotInsetCard>
        )}
      </View>

      <EventSlotPanel theme={theme} style={styles.responseCard}>
        <Text style={[styles.responseHeading, { color: theme.colors.text }]}>Response detail</Text>
        <EventSlotInsetCard theme={theme} style={styles.infoCard}>
          <Text style={[styles.infoLine, { color: theme.colors.secondary }]}>
            Registration source: {registration.source ?? "Registration form"}
          </Text>
          <Text style={[styles.infoLine, { color: theme.colors.secondary }]}>
            Event type: {event.eventType ?? "physical"} | Access: {event.accessType ?? "public"}
          </Text>
          <Text style={[styles.infoLine, { color: theme.colors.secondary }]}>
            Consent flow: {event.attendeeConsentEnabled ? "Enabled" : "Not enabled"}
          </Text>
          <Text style={[styles.infoLine, { color: theme.colors.secondary }]}>
            Registration saved: {registration.submittedAtLabel}
          </Text>
          {event.attendeeConsentText ? (
            <Text style={[styles.infoLine, { color: theme.colors.secondary }]}>
              Consent copy: {event.attendeeConsentText}
            </Text>
          ) : null}
        </EventSlotInsetCard>
        {responseAnswers.length > 0 ? (
          <EventSlotInsetCard theme={theme} style={styles.answersCard}>
            <Text style={[styles.answersHeading, { color: theme.colors.text }]}>Submitted answers</Text>
            {responseAnswers.map((answer) => (
              <View key={`${answer.label}:${answer.value}`} style={styles.answerRow}>
                <Text style={[styles.answerLabel, { color: theme.colors.secondary }]}>{answer.label}</Text>
                <Text style={[styles.answerValue, { color: theme.colors.text }]}>{answer.value}</Text>
              </View>
            ))}
          </EventSlotInsetCard>
        ) : null}
        <Pressable accessibilityRole="button" onPress={onBackPress} style={[styles.backButton, { borderColor: theme.colors.border }]}>
          <Text style={[styles.backButtonText, { color: theme.colors.text }]}>Back to attendee list</Text>
        </Pressable>
      </EventSlotPanel>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: 16,
    padding: 16,
    paddingBottom: 40
  },
  summaryCard: {
    gap: 8,
    padding: 18
  },
  summaryHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  summaryTitle: {
    ...typeScale.sectionTitle,
    flex: 1
  },
  ticketShell: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 16,
    padding: 20
  },
  brandRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  brand: {
    fontFamily: fontFamily.display,
    fontSize: 24,
    fontWeight: "400"
  },
  brandMeta: {
    ...typeScale.label
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: 30,
    fontWeight: "400",
    lineHeight: 36
  },
  meta: {
    fontSize: 13,
    lineHeight: 18
  },
  infoCard: {
    gap: 8
  },
  infoLine: {
    fontSize: 14,
    lineHeight: 20
  },
  qrWrap: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: 20,
    borderWidth: 1,
    padding: 20
  },
  ticketCode: {
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1.5,
    textAlign: "center"
  },
  waitlistCard: {
    gap: 10
  },
  waitlistTitle: {
    fontSize: 16,
    fontWeight: "900"
  },
  secondaryAction: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: "900"
  },
  responseCard: {
    gap: 12
  },
  responseHeading: {
    ...typeScale.sectionTitle
  },
  answersCard: {
    gap: 12
  },
  answersHeading: {
    fontSize: 14,
    fontWeight: "900"
  },
  answerRow: {
    gap: 4
  },
  answerLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  answerValue: {
    fontSize: 14,
    lineHeight: 20
  },
  backButton: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: "900"
  }
});
