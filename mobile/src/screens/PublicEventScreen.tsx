import { useEffect, useMemo, useState } from "react";
import QRCode from "react-native-qrcode-svg";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { EventSlotField } from "../components/EventSlotField";
import { EventSlotInsetCard } from "../components/EventSlotInsetCard";
import { EventSlotMessageCard } from "../components/EventSlotMessageCard";
import { EventSlotPanel } from "../components/EventSlotPanel";
import { EventSlotPill } from "../components/EventSlotPill";
import { NativeAttachmentDraft } from "../domain/attachments";
import { NativeEvent, NativeRegistrationQuestion } from "../domain/events";
import { NativePublicRegistrationAnswer, NativePublicRegistrationRecord } from "../domain/publicRegistrations";
import {
  getPublicRegistrationReadinessMessage,
  loadPublicRegistrationRecords,
  savePublicRegistrationRecord,
  updatePublicRegistrationRecord
} from "../services/publicRegistrations";
import { pollPaidOrderStatus, startPaidCheckout, submitPublicRegistration } from "../services/publicEventFlow";
import { buildNativeMapAction, openMapUrl } from "../services/maps";
import { shareNativePayload } from "../services/share";
import { openSupportLink } from "../services/support";
import { pickNativeAttachment, prepareNativeAttachmentUpload, uploadNativeAttachment } from "../services/uploads";
import { AppTheme } from "../theme";
import { fontFamily, typeScale } from "../typography";

type PublicEventScreenProps = {
  event: NativeEvent;
  theme: AppTheme;
};

type RegistrationState = "form" | "payment" | "waitlist" | "confirmed";
type PaymentStage = "idle" | "sending" | "awaiting";
type QuestionAnswerValue = string | string[];

export function PublicEventScreen({ event, theme }: PublicEventScreenProps) {
  const ticketTiers = useMemo(
    () => (event.ticketTiers ?? []).filter((tier) => tier.name.trim() || tier.price.trim() || tier.capacity.trim()),
    [event.ticketTiers]
  );
  const paidEvent = event.monetization === "paid" || event.paymentMode !== "Registration only";
  const [selectedTierId, setSelectedTierId] = useState<string | null>(ticketTiers[0]?.id ?? null);
  const [registrationState, setRegistrationState] = useState<RegistrationState>("form");
  const [paymentStage, setPaymentStage] = useState<PaymentStage>("idle");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Complete the attendee form to preview the mobile registration flow.");
  const [registrationHistory, setRegistrationHistory] = useState<NativePublicRegistrationRecord[]>([]);
  const [activeRegistrationId, setActiveRegistrationId] = useState<string | null>(null);
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, QuestionAnswerValue>>({});
  const [selectedAttachment, setSelectedAttachment] = useState<NativeAttachmentDraft | null>(null);
  const [attachmentStatus, setAttachmentStatus] = useState("No attendee file selected yet.");

  const selectedTier = ticketTiers.find((tier) => tier.id === selectedTierId) ?? null;
  const fileQuestion = (event.registrationQuestions ?? []).find((question) => question.type === "file");
  const registrationQuestions = (event.registrationQuestions ?? []).filter((question) => question.type !== "file");
  const attachmentRequirement = fileQuestion && event.attachmentRequirement
    ? {
        ...event.attachmentRequirement,
        label: fileQuestion.label || event.attachmentRequirement.label
      }
    : event.attachmentRequirement;
  const eventIsFull = event.capacity > 0 && event.attendees >= event.capacity;
  const eventIsClosed = event.status === "Closed";
  const registrationDisabled = eventIsClosed || registrationState === "payment" || registrationState === "confirmed";
  const spotsRemaining = event.capacity > 0 ? Math.max(0, event.capacity - event.attendees) : null;
  const mapAction = buildNativeMapAction({
    mapDirectionsUrl: event.mapDirectionsUrl,
    venue: event.venue
  });
  const organizerContactUrl = buildOrganizerContactUrl(event);
  const organizerContactLabel = event.contactMode === "CALL" ? "Call organizer" : "Chat organizer";
  const activeRegistration =
    registrationHistory.find((record) => record.id === activeRegistrationId) ??
    registrationHistory.find((record) => record.state === "confirmed" || record.state === "payment-pending") ??
    null;
  const payableAmount =
    selectedTier ? `KES ${selectedTier.price || "0"}` : event.standardPrice ? `KES ${event.standardPrice}` : event.entryFeeLabel ?? "Configured on the event";

  useEffect(() => {
    let mounted = true;

    loadPublicRegistrationRecords(event.slug)
      .then((records) => {
        if (mounted) {
          setRegistrationHistory(records);
          setActiveRegistrationId(records[0]?.id ?? null);
        }
      })
      .catch(() => {
        if (mounted) {
          setRegistrationHistory([]);
          setActiveRegistrationId(null);
        }
      });

    return () => {
      mounted = false;
    };
  }, [event.slug]);

  useEffect(() => {
    setQuestionAnswers((current) => {
      const next: Record<string, QuestionAnswerValue> = {};

      for (const question of registrationQuestions) {
        next[question.id] = current[question.id] ?? getEmptyQuestionAnswer(question);
      }

      return next;
    });
  }, [registrationQuestions]);

  useEffect(() => {
    const paymentOrderId = activeRegistration?.paymentOrderId;
    if (registrationState !== "payment" || !paymentOrderId) {
      return;
    }

    let cancelled = false;
    setPaymentStage("awaiting");

    const pollStatus = async () => {
      try {
        const result = await pollPaidOrderStatus(paymentOrderId);
        if (cancelled || !result.success) {
          return;
        }

        if (result.status === "PAID") {
          const records = await updatePublicRegistrationRecord(event.slug, activeRegistration.id, {
            backendRegistrationId: result.registrationId ?? undefined,
            confirmationCode: result.confirmationCode ?? activeRegistration.confirmationCode,
            paymentConfirmedAt: new Date().toISOString(),
            state: "confirmed"
          });
          if (cancelled) {
            return;
          }
          setRegistrationHistory(records);
          setRegistrationState("confirmed");
          setPaymentStage("idle");
          setStatusMessage("Payment confirmed through EventSlot. Your attendee ticket is ready.");
          return;
        }

        if (result.status === "FAILED" || result.status === "CANCELLED" || result.status === "EXPIRED") {
          const records = await updatePublicRegistrationRecord(event.slug, activeRegistration.id, {
            state: "draft"
          });
          if (cancelled) {
            return;
          }
          setRegistrationHistory(records);
          setRegistrationState("form");
          setPaymentStage("idle");
          setActiveRegistrationId(null);
          setStatusMessage("Payment was not completed. You can try the registration again.");
          return;
        }

        if (!cancelled) {
          setTimeout(() => {
            void pollStatus();
          }, 4000);
        }
      } catch {
        if (!cancelled) {
          setTimeout(() => {
            void pollStatus();
          }, 5000);
        }
      }
    };

    void pollStatus();

    return () => {
      cancelled = true;
    };
  }, [activeRegistration, event.slug, registrationState]);

  const handleSubmit = async () => {
    if (eventIsClosed) {
      setStatusMessage("Registration is closed. Event details, maps, and organizer contact remain available.");
      return;
    }

    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      setStatusMessage("Add your name, email, and phone number before continuing.");
      return;
    }

    if (!consentAccepted) {
      setStatusMessage("Accept the data-processing consent before continuing.");
      return;
    }

    if (attachmentRequirement?.enabled && attachmentRequirement.required && !selectedAttachment) {
      setStatusMessage("Add the requested attendee file before continuing.");
      return;
    }

    for (const question of registrationQuestions) {
      if (question.required && !hasQuestionAnswer(question, questionAnswers[question.id])) {
        setStatusMessage(`Answer "${question.label}" before continuing.`);
        return;
      }
    }

    const answers = buildAnswers(registrationQuestions, questionAnswers, attachmentRequirement, selectedAttachment, fileQuestion);

    try {
      if (paidEvent && selectedTierId) {
        const checkout = await startPaidCheckout({
          eventSlug: event.slug,
          attendeeEmail: email.trim(),
          attendeePhone: phone.trim(),
          ticketTierId: selectedTierId,
          answers,
          consentDataProcessing: true
        });

        if (checkout.kind === "checkout") {
          const records = await savePublicRegistrationRecord({
            eventSlug: event.slug,
            attendeeName: fullName.trim(),
            attendeeEmail: email.trim(),
            attendeePhone: phone.trim(),
            ticketTierName: selectedTier?.name,
            ticketPriceLabel: selectedTier ? `KES ${selectedTier.price || "0"}` : event.standardPrice ? `KES ${event.standardPrice}` : event.entryFeeLabel,
            state: "payment-pending",
            paymentOrderId: checkout.orderId,
            checkoutRequestId: checkout.checkoutRequestId,
            paymentReference: checkout.checkoutRequestId,
            answers
          });
          setRegistrationHistory(records);
          setActiveRegistrationId(records[0]?.id ?? null);
          setRegistrationState("payment");
          setPaymentStage("awaiting");
          setStatusMessage(checkout.customerMessage);
          return;
        }

        if (checkout.kind === "waitlist") {
          const waitlistRecords = await savePublicRegistrationRecord({
            eventSlug: event.slug,
            attendeeName: fullName.trim(),
            attendeeEmail: email.trim(),
            attendeePhone: phone.trim(),
            backendRegistrationId: checkout.registrationId,
            ticketTierName: selectedTier?.name,
            ticketPriceLabel: selectedTier ? `KES ${selectedTier.price || "0"}` : event.standardPrice ? `KES ${event.standardPrice}` : event.entryFeeLabel,
            state: "waitlist",
            answers
          });
          setRegistrationHistory(waitlistRecords);
          setActiveRegistrationId(waitlistRecords[0]?.id ?? null);
          setRegistrationState("waitlist");
          setPaymentStage("idle");
          setStatusMessage(
            checkout.waitlistPosition
              ? `The selected ticket tier is full. This attendee has been added to the waitlist at position #${checkout.waitlistPosition}.`
              : "The selected ticket tier is full. This attendee has been added to the waitlist."
          );
          return;
        }

        const fallbackRecords = await savePublicRegistrationRecord({
          eventSlug: event.slug,
          attendeeName: fullName.trim(),
          attendeeEmail: email.trim(),
          attendeePhone: phone.trim(),
          ticketTierName: selectedTier?.name,
          ticketPriceLabel: selectedTier ? `KES ${selectedTier.price || "0"}` : event.standardPrice ? `KES ${event.standardPrice}` : event.entryFeeLabel,
          state: "payment-pending",
          paymentReference: buildPaymentReference(event.slug),
          answers
        });
        setRegistrationHistory(fallbackRecords);
        setActiveRegistrationId(fallbackRecords[0]?.id ?? null);
        setRegistrationState("payment");
        setPaymentStage("idle");
        setStatusMessage(`${checkout.error} A local payment preview has been staged on this device so work can continue.`);
        return;
      }

      const liveResult = await submitPublicRegistration({
        eventSlug: event.slug,
        attendeeEmail: email.trim(),
        answers,
        consentDataProcessing: true
      });

      if (liveResult.kind === "duplicate") {
        setStatusMessage(liveResult.error);
        return;
      }

      const records = await savePublicRegistrationRecord({
        eventSlug: event.slug,
        attendeeName: fullName.trim(),
        attendeeEmail: email.trim(),
        attendeePhone: phone.trim(),
        backendRegistrationId: liveResult.registrationId,
        ticketTierName: selectedTier?.name,
        ticketPriceLabel: selectedTier ? `KES ${selectedTier.price || "0"}` : undefined,
        state: liveResult.kind,
        confirmationCode: liveResult.confirmationCode,
        answers
      });
      setRegistrationHistory(records);
      setActiveRegistrationId(records[0]?.id ?? null);
      setRegistrationState(liveResult.kind === "confirmed" ? "confirmed" : "waitlist");
      setPaymentStage("idle");
      setStatusMessage(
        liveResult.kind === "confirmed"
          ? "Registration confirmed through EventSlot and mirrored locally on this device."
          : "This attendee has been added to the EventSlot waitlist and mirrored locally on this device."
      );
      return;
    } catch (error) {
      if (paidEvent) {
        const fallbackRecords = await savePublicRegistrationRecord({
          eventSlug: event.slug,
          attendeeName: fullName.trim(),
          attendeeEmail: email.trim(),
          attendeePhone: phone.trim(),
          ticketTierName: selectedTier?.name,
          ticketPriceLabel: selectedTier ? `KES ${selectedTier.price || "0"}` : event.standardPrice ? `KES ${event.standardPrice}` : event.entryFeeLabel,
          state: eventIsFull ? "waitlist" : "payment-pending",
          paymentReference: buildPaymentReference(event.slug),
          answers
        });
        setRegistrationHistory(fallbackRecords);
        setActiveRegistrationId(fallbackRecords[0]?.id ?? null);
        setRegistrationState(eventIsFull ? "waitlist" : "payment");
        setPaymentStage("idle");
        setStatusMessage(`${error instanceof Error ? error.message : "Live checkout failed."} A local fallback record has been saved on this device.`);
        return;
      }

      setStatusMessage(error instanceof Error ? error.message : "Registration failed.");
    }
  };

  const handleSendStkPush = () => {
    if (!phone.trim()) {
      setStatusMessage("Enter a valid phone number before sending an STK push.");
      return;
    }

    setPaymentStage("sending");
    setStatusMessage(`Sending an M-Pesa STK push to ${phone.trim()}.`);

    setTimeout(() => {
      setPaymentStage("awaiting");
      setStatusMessage("STK push sent. Check your phone and confirm payment when the prompt is approved.");
    }, 700);
  };

  const handleConfirmPayment = async () => {
    if (!activeRegistrationId) {
      setStatusMessage("Payment confirmation needs an active registration record.");
      return;
    }

    const records = await updatePublicRegistrationRecord(event.slug, activeRegistrationId, {
      state: "confirmed",
      paymentConfirmedAt: new Date().toISOString()
    });
    setRegistrationHistory(records);
    setRegistrationState("confirmed");
    setPaymentStage("idle");
    setStatusMessage("Payment confirmed. Your attendee ticket is now ready.");
  };

  const handleStartNew = () => {
    setRegistrationState("form");
    setPaymentStage("idle");
    setActiveRegistrationId(null);
    setFullName("");
    setEmail("");
    setPhone("");
    setConsentAccepted(false);
    setQuestionAnswers({});
    setSelectedAttachment(null);
    setAttachmentStatus("No attendee file selected yet.");
    setStatusMessage("Complete the attendee form to preview the mobile registration flow.");
  };

  const handleShareTicket = async () => {
    if (!activeRegistration) {
      return;
    }

    await shareNativePayload({
      title: `${event.title} ticket`,
      message: [
        `Event: ${event.title}`,
        `Attendee: ${activeRegistration.attendeeName}`,
        `Confirmation: ${activeRegistration.confirmationCode}`,
        activeRegistration.ticketTierName ? `Tier: ${activeRegistration.ticketTierName}` : undefined,
        [event.dateLabel, event.timeLabel, event.venue].filter(Boolean).join(" | ")
      ]
        .filter(Boolean)
        .join("\n")
    }).catch(() => {});
  };

  const handlePickAttachment = async () => {
    if (eventIsClosed) {
      setAttachmentStatus("Registration is closed for this event.");
      return;
    }

    if (!attachmentRequirement?.enabled) {
      setAttachmentStatus("This event is not requesting attendee uploads.");
      return;
    }

    const result = await pickNativeAttachment(attachmentRequirement);
    if (result.status !== "picked") {
      setAttachmentStatus(result.message);
      return;
    }

    setSelectedAttachment(result.attachment);
    const readiness = prepareNativeAttachmentUpload(result.attachment, attachmentRequirement);
    setAttachmentStatus(readiness.message);

    if (readiness.ready) {
      const uploadResult = await uploadNativeAttachment(result.attachment, attachmentRequirement, {
        eventSlug: event.slug,
        questionId: fileQuestion?.id ?? "attachment-upload"
      });

      if (uploadResult.status === "uploaded") {
        setSelectedAttachment({
          ...result.attachment,
          uploadedUrl: uploadResult.uploadedUrl
        });
      }

      setAttachmentStatus(uploadResult.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
      <EventSlotPanel theme={theme} tone="hero" style={styles.hero}>
        <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>PUBLIC EVENT</Text>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{event.title}</Text>
          {paidEvent ? <EventSlotPill label="PAID" theme={theme} tone="accent" /> : <EventSlotPill label="FREE" theme={theme} tone="success" />}
        </View>
        <Text style={[styles.meta, { color: theme.colors.secondary }]}>
          {[event.dateLabel, event.timeLabel, event.venue].filter(Boolean).join(" | ")}
        </Text>
        <Text style={[styles.body, { color: theme.colors.secondary }]}>
          {event.entryFeeLabel ? `Ticketing: ${event.entryFeeLabel}` : "Attendees can register directly from mobile for this event."}
        </Text>
        {event.description ? <Text style={[styles.body, { color: theme.colors.secondary }]}>{event.description}</Text> : null}
        {typeof spotsRemaining === "number" && event.showRemainingSpots ? (
          <Text style={[styles.meta, { color: theme.colors.accent }]}>
            {spotsRemaining > 0 ? `${spotsRemaining} spot${spotsRemaining === 1 ? "" : "s"} remaining` : "Waitlist open"}
          </Text>
        ) : null}
        {mapAction.ready ? (
          <Pressable accessibilityRole="button" onPress={() => openMapUrl(mapAction.url)} style={[styles.secondaryAction, { borderColor: theme.colors.border, backgroundColor: theme.colors.input }]}>
            <Text style={[styles.secondaryActionText, { color: theme.colors.text }]}>{mapAction.label}</Text>
          </Pressable>
        ) : null}
        {organizerContactUrl ? (
          <Pressable accessibilityRole="button" onPress={() => void openSupportLink(organizerContactUrl)} style={[styles.secondaryAction, { borderColor: theme.colors.border, backgroundColor: theme.colors.input }]}>
            <Text style={[styles.secondaryActionText, { color: theme.colors.text }]}>{organizerContactLabel}</Text>
          </Pressable>
        ) : null}
        {event.communityLink ? (
          <Pressable accessibilityRole="button" onPress={() => void openSupportLink(event.communityLink!)} style={[styles.secondaryAction, { borderColor: theme.colors.border, backgroundColor: theme.colors.input }]}>
            <Text style={[styles.secondaryActionText, { color: theme.colors.text }]}>Open community</Text>
          </Pressable>
        ) : null}
        <Text style={[styles.meta, { color: theme.colors.secondary }]}>{getPublicRegistrationReadinessMessage(event)}</Text>
      </EventSlotPanel>

      {eventIsClosed ? (
        <EventSlotMessageCard
          title="Event closed"
          caption="Registration is closed, but attendees can still review the details, directions, and organizer contact."
          theme={theme}
          tone="input"
        />
      ) : null}

      {registrationState === "waitlist" ? (
        <EventSlotMessageCard
          title="You're on the waitlist"
          caption="This attendee flow now reflects a dedicated waitlist outcome when the event has reached capacity."
          theme={theme}
        />
      ) : null}

      {registrationState === "payment" && activeRegistration ? (
        <EventSlotPanel theme={theme} style={styles.paymentStepCard}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Complete payment</Text>
          <Text style={[styles.body, { color: theme.colors.secondary }]}>
            Use the same M-Pesa number from the attendee form, approve the STK prompt, then confirm payment to unlock the ticket.
          </Text>

          <EventSlotInsetCard theme={theme} style={styles.paymentCard}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Payment summary</Text>
            <Text style={[styles.meta, { color: theme.colors.secondary }]}>Attendee: {activeRegistration.attendeeName}</Text>
            <Text style={[styles.meta, { color: theme.colors.secondary }]}>Phone: {activeRegistration.attendeePhone}</Text>
            <Text style={[styles.meta, { color: theme.colors.accent }]}>Amount: {activeRegistration.ticketPriceLabel ?? payableAmount}</Text>
            <Text style={[styles.meta, { color: theme.colors.secondary }]}>
              Reference: {activeRegistration.paymentReference ?? buildPaymentReference(event.slug)}
            </Text>
          </EventSlotInsetCard>

          <View style={styles.paymentActions}>
            <Pressable accessibilityRole="button" onPress={handleSendStkPush} style={[styles.submitButton, { backgroundColor: theme.colors.accent }]}>
              <Text style={styles.submitText}>
                {activeRegistration.paymentOrderId ? "Waiting for confirmation..." : paymentStage === "sending" ? "Sending prompt..." : "Send STK push"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={handleConfirmPayment}
              style={[styles.secondaryAction, { borderColor: theme.colors.border, backgroundColor: theme.colors.input }]}
            >
              <Text style={[styles.secondaryActionText, { color: theme.colors.text }]}>I've completed payment</Text>
            </Pressable>
          </View>
        </EventSlotPanel>
      ) : null}

      {registrationState === "confirmed" && activeRegistration ? (
        <EventSlotPanel theme={theme} style={styles.confirmedCard}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Ticket ready</Text>
          <Text style={[styles.body, { color: theme.colors.secondary }]}>
            {paidEvent
              ? "Payment is marked as complete in this preview, so the attendee ticket is now available."
              : "Free-event registration is confirmed and the attendee ticket is ready."}
          </Text>
          <EventSlotInsetCard theme={theme} style={styles.ticketPreview}>
            <Text style={[styles.ticketTitle, { color: theme.colors.text }]}>{event.title}</Text>
            <Text style={[styles.meta, { color: theme.colors.secondary }]}>
              {[event.dateLabel, event.timeLabel, event.venue].filter(Boolean).join(" | ")}
            </Text>
            <View style={[styles.qrWrap, { borderColor: theme.colors.border, backgroundColor: "#FFFFFF" }]}>
              <QRCode value={activeRegistration.confirmationCode} size={170} color="#0A0A0A" backgroundColor="#FFFFFF" />
            </View>
            <Text style={[styles.meta, { color: theme.colors.secondary }]}>{activeRegistration.attendeeName}</Text>
            <Text style={[styles.meta, { color: theme.colors.secondary }]}>{activeRegistration.attendeeEmail}</Text>
            <Text style={[styles.meta, { color: theme.colors.secondary }]}>{activeRegistration.attendeePhone}</Text>
            <Text style={[styles.meta, { color: theme.colors.accent }]}>Confirmation: {activeRegistration.confirmationCode}</Text>
            {activeRegistration.ticketTierName ? (
              <Text style={[styles.meta, { color: theme.colors.accent }]}>
                {activeRegistration.ticketTierName} | {activeRegistration.ticketPriceLabel ?? "Free"}
              </Text>
            ) : null}
            {activeRegistration.paymentReference ? (
              <Text style={[styles.meta, { color: theme.colors.secondary }]}>Payment ref: {activeRegistration.paymentReference}</Text>
            ) : null}
          </EventSlotInsetCard>
          <Pressable
            accessibilityRole="button"
            onPress={handleShareTicket}
            style={[styles.secondaryAction, { borderColor: theme.colors.border, backgroundColor: theme.colors.input }]}
          >
            <Text style={[styles.secondaryActionText, { color: theme.colors.text }]}>Share ticket</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={handleStartNew}
            style={[styles.secondaryAction, { borderColor: theme.colors.border, backgroundColor: theme.colors.input }]}
          >
            <Text style={[styles.secondaryActionText, { color: theme.colors.text }]}>Start another registration</Text>
          </Pressable>
        </EventSlotPanel>
      ) : null}

      <EventSlotPanel theme={theme} style={styles.formCard}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          {registrationState === "payment" ? "Attendee details" : "Register"}
        </Text>
        <Text style={[styles.body, { color: theme.colors.secondary }]}>{statusMessage}</Text>

        {eventIsClosed ? (
          <EventSlotInsetCard theme={theme} style={styles.closedStateCard}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Registration closed</Text>
            <Text style={[styles.body, { color: theme.colors.secondary }]}>
              Attendees can still review the event details, open directions, and chat with the organizer, but new registrations are no longer accepted.
            </Text>
          </EventSlotInsetCard>
        ) : null}

        {paidEvent ? (
          <View style={styles.tiersSection}>
            <Text style={[styles.fieldLabel, { color: theme.colors.secondary }]}>Ticket tier</Text>
            {ticketTiers.length > 0 ? (
              ticketTiers.map((tier) => (
                <Pressable
                  key={tier.id}
                  accessibilityRole="button"
                  disabled={registrationDisabled}
                  onPress={registrationDisabled ? undefined : () => setSelectedTierId(tier.id)}
                  style={[
                    styles.tierOption,
                    {
                      backgroundColor: selectedTierId === tier.id ? theme.colors.activeTab : theme.colors.input,
                      borderColor: selectedTierId === tier.id ? theme.colors.accent : theme.colors.border,
                      opacity: registrationDisabled ? 0.55 : 1
                    }
                  ]}
                >
                  <Text style={[styles.tierName, { color: theme.colors.text }]}>{tier.name || "Untitled tier"}</Text>
                  <Text style={[styles.tierMeta, { color: theme.colors.secondary }]}>
                    KES {tier.price || "0"}{tier.capacity ? ` | ${tier.capacity} spots` : ""}
                  </Text>
                </Pressable>
              ))
            ) : (
              <EventSlotMessageCard
                title="Paid event"
                caption={`Default price: ${event.standardPrice ? `KES ${event.standardPrice}` : event.entryFeeLabel ?? "Configured on the event"}`}
                theme={theme}
                tone="input"
              />
            )}
          </View>
        ) : null}

        <EventSlotField label="Full name" value={fullName} onChangeText={setFullName} placeholder="Your full name" theme={theme} editable={!registrationDisabled} />
        <EventSlotField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" theme={theme} editable={!registrationDisabled} />
        <EventSlotField label="Phone" value={phone} onChangeText={setPhone} placeholder="+2547..." theme={theme} keyboardType="phone-pad" editable={!registrationDisabled} />

        {registrationQuestions.length > 0 ? (
          <View style={styles.questionsSection}>
            <Text style={[styles.fieldLabel, { color: theme.colors.secondary }]}>Registration questions</Text>
            {registrationQuestions.map((question) => (
              <RegistrationQuestionField
                key={question.id}
                question={question}
                value={questionAnswers[question.id] ?? getEmptyQuestionAnswer(question)}
                onChange={(value) => setQuestionAnswers((current) => ({ ...current, [question.id]: value }))}
                theme={theme}
                disabled={registrationDisabled}
              />
            ))}
          </View>
        ) : null}

        {attachmentRequirement?.enabled ? (
          <EventSlotInsetCard theme={theme} style={styles.attachmentCard}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>{attachmentRequirement.label}</Text>
            <Text style={[styles.body, { color: theme.colors.secondary }]}>{attachmentRequirement.caption}</Text>
            <Text style={[styles.meta, { color: theme.colors.secondary }]}>
              Accepted: {attachmentRequirement.acceptedKind} | Max {attachmentRequirement.maxFileSizeMb} MB
              {attachmentRequirement.required ? " | Required" : " | Optional"}
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={registrationDisabled}
              onPress={registrationDisabled ? undefined : handlePickAttachment}
              style={[
                styles.secondaryAction,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.input,
                  opacity: registrationDisabled ? 0.55 : 1
                }
              ]}
            >
              <Text style={[styles.secondaryActionText, { color: theme.colors.text }]}>
                {selectedAttachment ? "Choose another file" : "Choose file"}
              </Text>
            </Pressable>
            <Text style={[styles.meta, { color: selectedAttachment?.validationError ? theme.colors.error : theme.colors.secondary }]}>
              {attachmentStatus}
            </Text>
            {selectedAttachment ? (
              <Text style={[styles.meta, { color: theme.colors.accent }]}>
                {selectedAttachment.name} | {Math.ceil(selectedAttachment.sizeBytes / 1024)} KB
                {selectedAttachment.uploadedUrl ? " | Uploaded" : " | Staged locally"}
              </Text>
            ) : null}
          </EventSlotInsetCard>
        ) : null}

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consentAccepted }}
          disabled={registrationDisabled}
          onPress={registrationDisabled ? undefined : () => setConsentAccepted((current) => !current)}
          style={[
            styles.consentRow,
            {
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.input,
              opacity: registrationDisabled ? 0.55 : 1
            }
          ]}
        >
          <View style={[styles.checkbox, { backgroundColor: consentAccepted ? theme.colors.accent : theme.colors.page, borderColor: theme.colors.border }]} />
          <Text style={[styles.consentText, { color: theme.colors.secondary }]}>
            {event.attendeeConsentText?.trim() || "I consent to EventSlot processing my data in line with the Kenya Data Protection Act 2019."}
          </Text>
        </Pressable>

        {paidEvent ? (
          <EventSlotInsetCard theme={theme} style={styles.paymentCard}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>M-Pesa payment flow</Text>
            <Text style={[styles.body, { color: theme.colors.secondary }]}>
              This preview now includes a separate payment step after attendee details are saved, closer to the live mobile ticketing journey.
            </Text>
            <Text style={[styles.meta, { color: theme.colors.accent }]}>Amount: {payableAmount}</Text>
          </EventSlotInsetCard>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={registrationDisabled}
          onPress={registrationDisabled ? undefined : handleSubmit}
          style={[styles.submitButton, { backgroundColor: eventIsClosed ? theme.colors.border : theme.colors.accent, opacity: eventIsClosed ? 0.7 : 1 }]}
        >
          <Text style={styles.submitText}>{eventIsClosed ? "Event closed" : eventIsFull ? "Join waitlist" : paidEvent ? "Continue to payment" : "Register now"}</Text>
        </Pressable>
      </EventSlotPanel>

      <EventSlotPanel theme={theme} style={styles.historyCard}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent mobile registrations</Text>
        {registrationHistory.length === 0 ? (
          <Text style={[styles.body, { color: theme.colors.secondary }]}>No local registrations have been staged for this event on this device yet.</Text>
        ) : (
          registrationHistory.slice(0, 4).map((record) => (
            <EventSlotInsetCard key={record.id} theme={theme} style={styles.historyItem}>
              <Text style={[styles.ticketTitle, { color: theme.colors.text }]}>{record.attendeeName}</Text>
              <Text style={[styles.meta, { color: theme.colors.secondary }]}>
                {record.state.replace("-", " ").toUpperCase()} | {record.attendeeEmail}
              </Text>
              <Text style={[styles.meta, { color: theme.colors.secondary }]}>
                {record.ticketTierName ? `${record.ticketTierName} | ` : ""}{record.ticketPriceLabel ?? "Free"} | {new Date(record.submittedAt).toLocaleString()}
              </Text>
              <Text style={[styles.meta, { color: theme.colors.accent }]}>Confirmation: {record.confirmationCode}</Text>
              {record.paymentReference ? (
                <Text style={[styles.meta, { color: theme.colors.secondary }]}>
                  Payment ref: {record.paymentReference}{record.paymentConfirmedAt ? " | Confirmed" : " | Pending"}
                </Text>
              ) : null}
              {record.answers && record.answers.length > 0 ? (
                <Text style={[styles.meta, { color: theme.colors.secondary }]}>
                  Answers: {record.answers.slice(0, 2).map((answer) => `${answer.label}: ${answer.displayValue ?? answer.value}`).join(" | ")}
                </Text>
              ) : null}
            </EventSlotInsetCard>
          ))
        )}
      </EventSlotPanel>
    </ScrollView>
  );
}

function buildPaymentReference(eventSlug: string) {
  return `MPESA-${eventSlug.slice(0, 3).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function buildOrganizerContactUrl(event: NativeEvent): string | null {
  const number = event.whatsappNumber?.trim();
  if (!number) {
    return null;
  }

  if (event.contactMode === "CALL") {
    return `tel:+${number}`;
  }

  return `https://wa.me/${number}?text=${encodeURIComponent(`Hello, I would like to ask about ${event.title}.`)}`;
}

function buildAnswers(
  questions: NativeRegistrationQuestion[],
  questionAnswers: Record<string, QuestionAnswerValue>,
  attachmentRequirement?: NativeEvent["attachmentRequirement"],
  selectedAttachment?: NativeAttachmentDraft | null,
  fileQuestion?: NativeRegistrationQuestion
): NativePublicRegistrationAnswer[] {
  const answers = questions
    .map((question) => buildPublicRegistrationAnswer(question, questionAnswers[question.id]))
    .filter((answer): answer is NativePublicRegistrationAnswer => Boolean(answer));

  if (attachmentRequirement?.enabled && selectedAttachment) {
    answers.push({
      questionId: fileQuestion?.id ?? "attachment-upload",
      label: attachmentRequirement.label,
      value: selectedAttachment.uploadedUrl ?? selectedAttachment.name,
      displayValue: selectedAttachment.name
    });
  }

  return answers;
}

function RegistrationQuestionField({
  question,
  value,
  onChange,
  theme,
  disabled = false
}: {
  question: NativeRegistrationQuestion;
  value: QuestionAnswerValue;
  onChange: (value: QuestionAnswerValue) => void;
  theme: AppTheme;
  disabled?: boolean;
}) {
  if (question.type === "select" && question.options && question.options.length > 0) {
    return (
      <View style={styles.questionField}>
        <Text style={[styles.questionLabel, { color: theme.colors.secondary }]}>
          {question.label}{question.required ? " *" : ""}
        </Text>
        <View style={styles.questionOptions}>
          {question.options.map((option) => {
            const active = value === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                disabled={disabled}
                onPress={disabled ? undefined : () => onChange(option)}
                style={[
                  styles.optionChip,
                  {
                    backgroundColor: active ? theme.colors.activeTab : theme.colors.input,
                    borderColor: active ? theme.colors.accent : theme.colors.border,
                    opacity: disabled ? 0.55 : 1
                  }
                ]}
              >
                <Text style={[styles.optionText, { color: active ? theme.colors.accent : theme.colors.text }]}>
                  {getQuestionOptionLabel(question, option)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {hasQuestionOptionLimits(question) ? (
          <Text style={[styles.optionHint, { color: theme.colors.secondary }]}>
            Some positions have limited slots and may close once full.
          </Text>
        ) : null}
      </View>
    );
  }

  if (question.type === "checkbox" && question.options && question.options.length > 0) {
    const selectedValues = parseCheckboxAnswer(value);
    return (
      <View style={styles.questionField}>
        <Text style={[styles.questionLabel, { color: theme.colors.secondary }]}>
          {question.label}{question.required ? " *" : ""}
        </Text>
        <View style={styles.checkboxList}>
          {question.options.map((option) => {
            const checked = selectedValues.includes(option);
            return (
              <Pressable
                key={option}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                disabled={disabled}
                onPress={
                  disabled
                    ? undefined
                    : () =>
                        onChange(
                          checked
                            ? selectedValues.filter((selectedValue) => selectedValue !== option)
                            : question.allowMultiple
                              ? [...selectedValues, option]
                              : [option]
                        )
                }
                style={[
                  styles.consentRow,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.input,
                    opacity: disabled ? 0.55 : 1
                  }
                ]}
              >
                <View style={[styles.checkbox, { backgroundColor: checked ? theme.colors.accent : theme.colors.page, borderColor: theme.colors.border }]} />
                <Text style={[styles.consentText, { color: theme.colors.secondary }]}>{getQuestionOptionLabel(question, option)}</Text>
              </Pressable>
            );
          })}
        </View>
        {question.required && selectedValues.length === 0 ? (
          <Text style={[styles.optionHint, { color: theme.colors.secondary }]}>Select at least one option.</Text>
        ) : null}
        {hasQuestionOptionLimits(question) ? (
          <Text style={[styles.optionHint, { color: theme.colors.secondary }]}>
            Some options have limited slots and may stop accepting selections once full.
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <EventSlotField
      label={`${question.label}${question.required ? " *" : ""}`}
      value={typeof value === "string" ? value : ""}
      onChangeText={(nextValue) => onChange(nextValue)}
      placeholder={question.label}
      theme={theme}
      keyboardType={
        question.type === "number"
          ? "number-pad"
          : question.type === "phone"
            ? "phone-pad"
            : "default"
      }
      multiline={question.type === "textarea"}
      editable={!disabled}
    />
  );
}

function buildPublicRegistrationAnswer(
  question: NativeRegistrationQuestion,
  value: QuestionAnswerValue | undefined
): NativePublicRegistrationAnswer | null {
  if (question.type === "checkbox") {
    const selectedValues = parseCheckboxAnswer(value);
    if (selectedValues.length === 0) {
      return null;
    }

    return {
      questionId: question.id,
      label: question.label,
      value: JSON.stringify(selectedValues),
      displayValue: selectedValues.join(", ")
    };
  }

  const normalizedValue = typeof value === "string" ? value.trim() : "";
  if (!normalizedValue) {
    return null;
  }

  return {
    questionId: question.id,
    label: question.label,
    value: normalizedValue,
    displayValue: normalizedValue
  };
}

function getEmptyQuestionAnswer(question: NativeRegistrationQuestion): QuestionAnswerValue {
  return question.type === "checkbox" ? [] : "";
}

function hasQuestionAnswer(question: NativeRegistrationQuestion, value: QuestionAnswerValue | undefined): boolean {
  if (question.type === "checkbox") {
    return parseCheckboxAnswer(value).length > 0;
  }

  return typeof value === "string" && value.trim().length > 0;
}

function parseCheckboxAnswer(value: QuestionAnswerValue | undefined): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      .map((entry) => entry.trim());
  }

  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        .map((entry) => entry.trim());
    }
  } catch {
    return value.split("|").map((entry) => entry.trim()).filter(Boolean);
  }

  return [];
}

function hasQuestionOptionLimits(question: NativeRegistrationQuestion): boolean {
  return Boolean(question.optionLimits && Object.keys(question.optionLimits).length > 0);
}

function getQuestionOptionLabel(question: NativeRegistrationQuestion, option: string): string {
  const optionLimit = question.optionLimits?.[option];
  return typeof optionLimit === "number" && Number.isFinite(optionLimit) && optionLimit > 0
    ? `${option} (max ${optionLimit})`
    : option;
}

const styles = StyleSheet.create({
  screen: {
    gap: 16,
    padding: 16,
    paddingBottom: 40
  },
  hero: {
    gap: 10,
    padding: 20
  },
  eyebrow: {
    ...typeScale.label
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  title: {
    flex: 1,
    fontFamily: fontFamily.display,
    fontSize: 28,
    fontWeight: "400",
    lineHeight: 34
  },
  meta: {
    fontSize: 13,
    lineHeight: 18
  },
  body: {
    ...typeScale.body
  },
  formCard: {
    gap: 14
  },
  paymentStepCard: {
    gap: 14
  },
  confirmedCard: {
    gap: 14
  },
  sectionTitle: {
    ...typeScale.sectionTitle
  },
  tiersSection: {
    gap: 10
  },
  questionsSection: {
    gap: 10
  },
  fieldLabel: {
    ...typeScale.label
  },
  questionField: {
    gap: 8
  },
  questionLabel: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18
  },
  questionOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  optionChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  optionText: {
    fontSize: 13,
    fontWeight: "700"
  },
  optionHint: {
    fontSize: 12,
    lineHeight: 18
  },
  checkboxList: {
    gap: 10
  },
  tierOption: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    padding: 14
  },
  tierName: {
    ...typeScale.bodyStrong
  },
  tierMeta: {
    fontSize: 13,
    lineHeight: 18
  },
  consentRow: {
    alignItems: "flex-start",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14
  },
  checkbox: {
    borderRadius: 6,
    borderWidth: 1,
    height: 20,
    marginTop: 2,
    width: 20
  },
  consentText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20
  },
  paymentCard: {
    gap: 8
  },
  closedStateCard: {
    gap: 8
  },
  paymentActions: {
    gap: 10
  },
  attachmentCard: {
    gap: 8
  },
  qrWrap: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: 20,
    borderWidth: 1,
    padding: 18
  },
  submitButton: {
    alignItems: "center",
    borderRadius: 18,
    paddingVertical: 16
  },
  submitText: {
    color: "#0A0A0A",
    fontFamily: fontFamily.medium,
    fontSize: 14,
    fontWeight: "900"
  },
  secondaryAction: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 15
  },
  secondaryActionText: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    fontWeight: "900"
  },
  ticketPreview: {
    gap: 8
  },
  ticketTitle: {
    ...typeScale.bodyStrong
  },
  historyCard: {
    gap: 12
  },
  historyItem: {
    gap: 6
  }
});
