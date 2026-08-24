import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { CREATE_EVENT_COPY } from "../../../lib/createEventContent";
import { EVENT_TEMPLATES, type EventTemplate } from "../../../lib/eventTemplates";
import { EventSlotChoiceCard } from "../components/EventSlotChoiceCard";
import { EventSlotField } from "../components/EventSlotField";
import { EventSlotInsetCard } from "../components/EventSlotInsetCard";
import { EventSlotMessageCard } from "../components/EventSlotMessageCard";
import { EventSlotOutlineButton } from "../components/EventSlotOutlineButton";
import { EventSlotPageHeader } from "../components/EventSlotPageHeader";
import { EventSlotPill } from "../components/EventSlotPill";
import { EventSlotSectionCard } from "../components/EventSlotSectionCard";
import { EventSlotSegmentedOptions } from "../components/EventSlotSegmentedOptions";
import { EventSlotStatusCard } from "../components/EventSlotStatusCard";
import { EventSlotTabs } from "../components/EventSlotTabs";
import { NativeAttachmentDraft, NativeAttachmentKind } from "../domain/attachments";
import { EventDraft, NativeAccessType, NativeEventType, NativeRegistrationQuestion, NativeRegistrationQuestionType, NativeTicketTierDraft } from "../domain/events";
import {
  clearEventDraft,
  emptyEventDraft,
  formatDraftSavedAt,
  hasEventDraftChanges,
  loadEventDraftRecord,
  saveEventDraft
} from "../services/drafts";
import { getNativeCreateEventReadinessMessage, prepareNativeCreateEventRequest, submitNativeEventDraft } from "../services/eventSubmission";
import { buildNativeEventLaunchChecklist } from "../services/eventLaunchChecklist";
import { validateEventDraft } from "../services/eventValidation";
import { createDraftPreview } from "../services/events";
import { buildNativeMapAction, openMapUrl } from "../services/maps";
import { getUploadReadinessMessage, pickNativeAttachment, prepareNativeAttachmentUpload, uploadNativeAttachment } from "../services/uploads";
import { NativeScreenProps } from "./types";

type CreateEventTab = "setup" | "details" | "attendees" | "review";

export function CreateEventScreen({ theme, navigate, refreshEvents, session }: NativeScreenProps) {
  const [draft, setDraft] = useState<EventDraft>(emptyEventDraft);
  const [selectedTemplateId, setSelectedTemplateId] = useState<EventTemplate["id"]>("blank");
  const [activeTab, setActiveTab] = useState<CreateEventTab>("setup");
  const [draftStatus, setDraftStatus] = useState("Loading saved event draft...");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [draftLoading, setDraftLoading] = useState(true);
  const [submitStatus, setSubmitStatus] = useState("Complete the required event details before publishing.");
  const [attachmentPreview, setAttachmentPreview] = useState<NativeAttachmentDraft | null>(null);
  const [attachmentStatus, setAttachmentStatus] = useState("No attachment selected yet.");
  const draftHydratedRef = useRef(false);
  const clearingDraftRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    loadEventDraftRecord()
      .then((record) => {
        if (!mounted) {
          return;
        }
        setDraft(record.draft);
        setLastSavedAt(record.savedAt);
        setDraftStatus(hasEventDraftChanges(record.draft) ? `Saved draft restored from ${formatDraftSavedAt(record.savedAt)}.` : "No saved draft yet.");
      })
      .catch(() => {
        if (mounted) {
          setDraftStatus("Could not load saved draft.");
        }
      })
      .finally(() => {
        if (mounted) {
          setDraftLoading(false);
          draftHydratedRef.current = true;
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!draftHydratedRef.current || draftLoading || clearingDraftRef.current) {
      return;
    }

    if (!hasEventDraftChanges(draft)) {
      return;
    }

    setDraftStatus("Auto-saving changes on this device...");

    const autoSaveTimer = setTimeout(() => {
      saveEventDraft(draft)
        .then((savedAt) => {
          setLastSavedAt(savedAt);
          setDraftStatus(`Autosaved ${formatDraftSavedAt(savedAt)}.`);
        })
        .catch(() => {
          setDraftStatus("Could not auto-save this draft. Use Save draft before leaving.");
        });
    }, 900);

    return () => clearTimeout(autoSaveTimer);
  }, [draft, draftLoading]);

  const preview = useMemo(() => createDraftPreview(draft), [draft]);
  const validation = useMemo(() => validateEventDraft(draft), [draft]);
  const launchChecklist = useMemo(() => buildNativeEventLaunchChecklist(draft, validation, session), [draft, session, validation]);
  const submissionPreparation = useMemo(() => prepareNativeCreateEventRequest(draft), [draft]);
  const mapAction = buildNativeMapAction({
    mapDirectionsUrl: preview.mapDirectionsUrl,
    venue: preview.venue
  });
  const publishReadiness = getNativeCreateEventReadinessMessage(session);
  const uploadReadiness = getUploadReadinessMessage();
  const selectedTemplate = EVENT_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? EVENT_TEMPLATES[EVENT_TEMPLATES.length - 1];
  const fileQuestion = draft.registrationQuestions.find((question) => question.type === "file");
  const currentSetupSummary = [
    selectedTemplate.name,
    draft.eventType === "physical" ? CREATE_EVENT_COPY.fields.eventType.physical.title : CREATE_EVENT_COPY.fields.eventType.virtual.title,
    draft.monetization === "paid" ? "Paid tickets" : "Free registration",
    draft.accessType === "public" ? "Public access" : "Private access"
  ].join(" | ");
  const attendeeFlowSummary = [
    draft.attendeeConsentEnabled ? "Consent enabled" : "Consent disabled",
    draft.showRemainingSpots ? "Spots visible" : "Spots hidden",
    `${draft.registrationQuestions.filter((question) => question.label.trim()).length} questions`,
    draft.attachmentRequirement.enabled ? `Uploads: ${draft.attachmentRequirement.acceptedKind}` : "Uploads disabled",
    draft.attachmentRequirement.required ? "Upload required" : "Upload optional"
  ].join(" | ");
  const createTabs: Array<{ key: CreateEventTab; label: string }> = [
    { key: "setup", label: CREATE_EVENT_COPY.tabs.setup },
    { key: "details", label: CREATE_EVENT_COPY.tabs.details },
    { key: "attendees", label: CREATE_EVENT_COPY.tabs.attendees },
    { key: "review", label: CREATE_EVENT_COPY.tabs.review }
  ];

  const updateDraft = <Key extends keyof EventDraft>(key: Key, value: EventDraft[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setDraftStatus("Unsaved changes on this device. Auto-save is preparing...");
  };

  const handleTierChange = <Key extends keyof NativeTicketTierDraft>(tierId: string, key: Key, value: NativeTicketTierDraft[Key]) => {
    updateDraft(
      "ticketTiers",
      draft.ticketTiers.map((tier) => (tier.id === tierId ? { ...tier, [key]: value } : tier))
    );
  };

  const handleAddTier = () => {
    updateDraft("ticketTiers", [
      ...draft.ticketTiers,
      { id: `tier-${Date.now()}`, name: "", price: "", capacity: "" }
    ]);
  };

  const handleQuestionChange = <Key extends keyof NativeRegistrationQuestion>(
    questionId: string,
    key: Key,
    value: NativeRegistrationQuestion[Key]
  ) => {
    const currentQuestion = draft.registrationQuestions.find((question) => question.id === questionId);
    updateDraft(
      "registrationQuestions",
      draft.registrationQuestions.map((question) => {
        if (question.id !== questionId) {
          return question;
        }

        const nextQuestion: NativeRegistrationQuestion = { ...question, [key]: value };

        if (key === "type") {
          const nextType = value as NativeRegistrationQuestionType;
          if (nextType === "select" || nextType === "checkbox") {
            nextQuestion.options = question.options && question.options.length > 0 ? question.options : [""];
          } else {
            nextQuestion.options = undefined;
            nextQuestion.optionLimits = undefined;
          }

          if (nextType !== "checkbox") {
            nextQuestion.allowMultiple = undefined;
          } else if (typeof nextQuestion.allowMultiple !== "boolean") {
            nextQuestion.allowMultiple = false;
          }
        }

        if (key === "options") {
          const nextOptions = ((value as NativeRegistrationQuestion["options"]) ?? []).map((option) => option ?? "");
          nextQuestion.options = nextOptions;
          nextQuestion.optionLimits = pruneQuestionOptionLimits(nextQuestion.optionLimits, nextOptions);
        }

        return nextQuestion;
      })
    );

    if (key === "type" && value === "file") {
      updateDraft("attachmentRequirement", {
        ...draft.attachmentRequirement,
        enabled: true,
        label: draft.registrationQuestions.find((question) => question.id === questionId)?.label || draft.attachmentRequirement.label
      });
    }

    if (key === "label") {
      if (currentQuestion?.type === "file") {
        updateDraft("attachmentRequirement", {
          ...draft.attachmentRequirement,
          enabled: true,
          label: String(value || draft.attachmentRequirement.label)
        });
      }
    }
  };

  const handleAddQuestion = () => {
    updateDraft("registrationQuestions", [
      ...draft.registrationQuestions,
      { id: `question-${Date.now()}`, label: "", type: "text", required: false, allowMultiple: false, optionLimits: {} }
    ]);
  };

  const handleRemoveQuestion = (questionId: string) => {
    if (draft.registrationQuestions.length === 1) {
      updateDraft("registrationQuestions", [{ id: "name", label: "Full name", type: "text", required: true }]);
      return;
    }

    updateDraft(
      "registrationQuestions",
      draft.registrationQuestions.filter((question) => question.id !== questionId)
    );
  };

  const handleAddQuestionOption = (questionId: string) => {
    const question = draft.registrationQuestions.find((item) => item.id === questionId);
    if (!question) {
      return;
    }

    handleQuestionChange(questionId, "options", [...(question.options ?? []), ""]);
  };

  const handleQuestionOptionChange = (questionId: string, optionIndex: number, value: string) => {
    const question = draft.registrationQuestions.find((item) => item.id === questionId);
    if (!question) {
      return;
    }

    const nextOptions = [...(question.options ?? [])];
    const previousOption = nextOptions[optionIndex] ?? "";
    nextOptions[optionIndex] = value;

    updateDraft(
      "registrationQuestions",
      draft.registrationQuestions.map((item) => {
        if (item.id !== questionId) {
          return item;
        }

        return {
          ...item,
          options: nextOptions,
          optionLimits:
            previousOption && previousOption !== value
              ? renameQuestionOptionLimit(item.optionLimits, previousOption, value)
              : pruneQuestionOptionLimits(item.optionLimits, nextOptions)
        };
      })
    );
  };

  const handleRemoveQuestionOption = (questionId: string, optionIndex: number) => {
    const question = draft.registrationQuestions.find((item) => item.id === questionId);
    if (!question) {
      return;
    }

    handleQuestionChange(
      questionId,
      "options",
      (question.options ?? []).filter((_, index) => index !== optionIndex)
    );
  };

  const handleQuestionOptionLimitChange = (questionId: string, option: string, value: string) => {
    const question = draft.registrationQuestions.find((item) => item.id === questionId);
    if (!question) {
      return;
    }

    updateDraft(
      "registrationQuestions",
      draft.registrationQuestions.map((item) => {
        if (item.id !== questionId) {
          return item;
        }

        return {
          ...item,
          optionLimits: {
            ...(item.optionLimits ?? {}),
            [option]: parseOptionLimit(value)
          }
        };
      })
    );
  };

  const handleRemoveTier = (tierId: string) => {
    if (draft.ticketTiers.length === 1) {
      updateDraft("ticketTiers", [{ id: "regular", name: "Regular", price: "", capacity: "" }]);
      return;
    }

    updateDraft(
      "ticketTiers",
      draft.ticketTiers.filter((tier) => tier.id !== tierId)
    );
  };

  const handleSaveDraft = async () => {
    const savedAt = await saveEventDraft(draft);
    setLastSavedAt(savedAt);
    setDraftStatus(`Draft saved locally ${formatDraftSavedAt(savedAt)}.`);
  };

  const handleClearDraft = async () => {
    clearingDraftRef.current = true;
    await clearEventDraft();
    setDraft({ ...emptyEventDraft });
    setLastSavedAt(null);
    setDraftStatus("Draft cleared from this device.");
    setSubmitStatus("Complete the required event details before publishing.");
    setTimeout(() => {
      clearingDraftRef.current = false;
    }, 0);
  };

  const handleNativeSubmit = async () => {
    if (!submissionPreparation.ready) {
      setSubmitStatus(submissionPreparation.reason);
      return;
    }

    if (session.authMode !== "live") {
      setSubmitStatus("This draft is ready. Sign in with a live EventSlot account before publishing.");
      return;
    }

    setSubmitStatus("Publishing event to EventSlot...");
    try {
      const createdEvent = await submitNativeEventDraft(session, draft);
      clearingDraftRef.current = true;
      await clearEventDraft();
      setDraft({ ...emptyEventDraft });
      setLastSavedAt(null);
      setDraftStatus("Draft published and cleared from this device.");
      setSubmitStatus(`Created ${createdEvent.title}. Refreshing your events...`);
      refreshEvents();
      navigate({ name: "eventDetail", eventId: createdEvent.id });
      setTimeout(() => {
        clearingDraftRef.current = false;
      }, 0);
    } catch (error) {
      setSubmitStatus(error instanceof Error ? error.message : "Could not publish this event draft.");
    }
  };

  const handlePickAttachment = async () => {
    setAttachmentStatus("Opening native file picker...");
    const result = await pickNativeAttachment(draft.attachmentRequirement);

    if (result.status !== "picked") {
      setAttachmentPreview(null);
      setAttachmentStatus(result.message);
      return;
    }

    setAttachmentPreview(result.attachment);
    const readiness = prepareNativeAttachmentUpload(result.attachment, draft.attachmentRequirement);
    if (!readiness.ready) {
      setAttachmentStatus(readiness.message);
      return;
    }

    const uploadResult = await uploadNativeAttachment(result.attachment, draft.attachmentRequirement);
    setAttachmentStatus(uploadResult.message);
  };

  const handlePickTemplate = (templateId: EventTemplate["id"]) => {
    setSelectedTemplateId(templateId);
    const template = EVENT_TEMPLATES.find((item) => item.id === templateId);
    if (template) {
      updateDraft(
        "registrationQuestions",
        template.questions.map((question, index) => ({
          id: `${template.id}-${question.id || index + 1}`,
          label: question.label,
          type: question.type,
          required: question.required,
          options: question.options ? [...question.options] : undefined,
          allowMultiple: question.allowMultiple ?? false,
          optionLimits: {}
        }))
      );
    }
    setDraftStatus(`Template selected: ${EVENT_TEMPLATES.find((template) => template.id === templateId)?.name ?? "Start from scratch"}.`);
  };

  return (
    <View style={styles.stack}>
      <EventSlotPageHeader
        theme={theme}
        backLabel="My Events"
        onBackPress={() => navigate({ name: "events" })}
        title={CREATE_EVENT_COPY.header.title}
        caption={CREATE_EVENT_COPY.header.caption}
      />

      <EventSlotStatusCard
        label="CREATE EVENT"
        title={CREATE_EVENT_COPY.banner.pricingPausedTitle}
        message={CREATE_EVENT_COPY.banner.pricingPausedMessage}
        theme={theme}
        tone="hero"
        style={styles.billingBanner}
      />

      {draftLoading ? (
        <EventSlotMessageCard
          title="Loading saved event draft"
          caption="Checking this device for saved work..."
          theme={theme}
        />
      ) : null}

      <EventSlotTabs items={createTabs} activeKey={activeTab} onSelect={setActiveTab} theme={theme} />

      {activeTab === "setup" ? (
        <>
          <EventSlotStatusCard
            label="SAVED ON THIS DEVICE"
            message={draftStatus}
            meta={`Last saved: ${formatDraftSavedAt(lastSavedAt)}`}
            theme={theme}
            tone="hero"
            style={styles.statusCard}
          />

          <EventSlotSectionCard
            title={CREATE_EVENT_COPY.sections.template.title}
            caption={CREATE_EVENT_COPY.sections.template.caption}
            theme={theme}
            style={styles.formCard}
          >
            <View style={styles.templateGrid}>
              {EVENT_TEMPLATES.map((template) => {
                const active = selectedTemplateId === template.id;

                return (
                  <EventSlotChoiceCard
                    key={template.id}
                    title={template.name}
                    caption={template.description}
                    icon={template.icon}
                    active={active}
                    theme={theme}
                    onPress={() => handlePickTemplate(template.id)}
                    style={styles.templateCard}
                  />
                );
              })}
            </View>
          </EventSlotSectionCard>

          <EventSlotSectionCard
            title={CREATE_EVENT_COPY.sections.eventKind.title}
            caption="Choose the core format before you fill in the details."
            theme={theme}
            style={styles.formCard}
          >
            <View style={styles.eventKindGrid}>
              <EventSlotChoiceCard
                title={CREATE_EVENT_COPY.fields.eventType.physical.title}
                caption={CREATE_EVENT_COPY.fields.eventType.physical.caption}
                active={draft.eventType === "physical"}
                theme={theme}
                onPress={() => updateDraft("eventType", "physical")}
                style={styles.eventKindCard}
              />
              <EventSlotChoiceCard
                title={CREATE_EVENT_COPY.fields.eventType.virtual.title}
                caption={CREATE_EVENT_COPY.fields.eventType.virtual.caption}
                active={draft.eventType === "virtual"}
                theme={theme}
                onPress={() => updateDraft("eventType", "virtual")}
                style={styles.eventKindCard}
              />
            </View>
            <EventSlotSegmentedOptions
              label="Monetization"
              options={[
                { label: "Free", value: "free" },
                { label: "Paid", value: "paid" }
              ]}
              selected={draft.monetization}
              onSelect={(value) => updateDraft("monetization", value)}
              theme={theme}
            />
          </EventSlotSectionCard>

          <EventSlotSectionCard title="NATIVE LAUNCH CHECKLIST" caption="Use this checklist so attendees receive clear event details." theme={theme} style={styles.statusCard}>
            {launchChecklist.map((item) => (
              <View key={item.key} style={[styles.checklistItem, { borderColor: theme.colors.border }]}>
                <Text
                  style={[
                    styles.checklistBadge,
                    {
                      backgroundColor: theme.colors.activeTab,
                      color: item.tone === "ready" ? theme.colors.success : item.tone === "blocked" ? theme.colors.error : theme.colors.accent
                    }
                  ]}
                >
                  {item.tone.toUpperCase()}
                </Text>
                <View style={styles.checklistCopy}>
                  <Text style={[styles.checklistTitle, { color: theme.colors.text }]}>{item.title}</Text>
                  <Text style={[styles.helper, { color: theme.colors.secondary }]}>{item.caption}</Text>
                </View>
              </View>
            ))}
          </EventSlotSectionCard>
        </>
      ) : null}

      {activeTab === "details" ? (
        <>
          <EventSlotStatusCard
            label={CREATE_EVENT_COPY.sections.currentSetup.title.toUpperCase()}
            title={CREATE_EVENT_COPY.sections.currentSetup.title}
            message={CREATE_EVENT_COPY.sections.currentSetup.caption}
            meta={currentSetupSummary}
            theme={theme}
            tone="hero"
            style={styles.statusCard}
          />

          <EventSlotSectionCard title={CREATE_EVENT_COPY.sections.eventDetails.title} theme={theme} style={styles.formCard}>
            <EventSlotField
              label={CREATE_EVENT_COPY.fields.eventTitle.label}
              value={draft.title}
              onChangeText={(value) => updateDraft("title", value)}
              placeholder={CREATE_EVENT_COPY.fields.eventTitle.placeholder}
              theme={theme}
            />
            <EventSlotField label="Date" value={draft.dateLabel} onChangeText={(value) => updateDraft("dateLabel", value)} placeholder="e.g. 22 Aug 2026" theme={theme} />
            <EventSlotField label="Venue" value={draft.venue} onChangeText={(value) => updateDraft("venue", value)} placeholder="Venue or online link" theme={theme} />
            <EventSlotField label="Capacity" value={draft.capacity} onChangeText={(value) => updateDraft("capacity", value)} placeholder="100" theme={theme} keyboardType="number-pad" />
            <Text style={[styles.helper, { color: theme.colors.secondary }]}>
              Event type: {draft.eventType === "physical" ? CREATE_EVENT_COPY.fields.eventType.physical.title : CREATE_EVENT_COPY.fields.eventType.virtual.title}
            </Text>
            {draft.eventType === "virtual" ? (
              <EventSlotField
                label={CREATE_EVENT_COPY.fields.virtualMeetingLink.label}
                value={draft.virtualLink}
                onChangeText={(value) => updateDraft("virtualLink", value)}
                placeholder={CREATE_EVENT_COPY.fields.virtualMeetingLink.placeholder}
                theme={theme}
              />
            ) : null}
            <EventSlotSegmentedOptions
              label="Access"
              options={[
                { label: "Public", value: "public" },
                { label: "Private", value: "private" }
              ]}
              selected={draft.accessType}
              onSelect={(value) => updateDraft("accessType", value)}
              theme={theme}
            />
            <EventSlotField
              label={CREATE_EVENT_COPY.fields.description.mobileLabel}
              value={draft.description}
              onChangeText={(value) => updateDraft("description", value)}
              placeholder={CREATE_EVENT_COPY.fields.description.mobilePlaceholder}
              theme={theme}
              multiline
              helperText={CREATE_EVENT_COPY.fields.description.mobileHelper}
            />
          </EventSlotSectionCard>

          <EventSlotSectionCard
            title={CREATE_EVENT_COPY.sections.venueAndEntry.title}
            caption={draft.monetization === "paid" ? "Set the default KES price and any optional ticket tiers for the mobile paid-event flow." : "Free events do not require ticket pricing."}
            theme={theme}
            style={styles.formCard}
          >
            {draft.monetization === "paid" ? (
              <>
                <EventSlotField
                  label="Standard price (KES)"
                  value={draft.standardPrice}
                  onChangeText={(value) => updateDraft("standardPrice", value)}
                  placeholder="1500"
                  theme={theme}
                  keyboardType="number-pad"
                  helperText="Default single-ticket price for paid events."
                />
                <EventSlotField
                  label="Pricing note"
                  value={draft.entryFeeLabel}
                  onChangeText={(value) => updateDraft("entryFeeLabel", value)}
                  placeholder="Regular KES 1,500 | VIP KES 3,000"
                  theme={theme}
                  helperText="Optional copy shown when you want to spell out pricing or entry notes."
                />
                <EventSlotSectionCard
                  title="Ticket tiers"
                  caption="Add named tiers like Regular, VIP, or VVIP. Leave only the standard price if you do not need multiple tiers."
                  theme={theme}
                  tone="input"
                  style={styles.innerSection}
                >
                  {draft.ticketTiers.map((tier, index) => (
                    <EventSlotInsetCard key={tier.id} theme={theme} style={styles.ticketTierCard}>
                      <Text style={[styles.ticketTierTitle, { color: theme.colors.text }]}>Tier {index + 1}</Text>
                      <EventSlotField
                        label="Tier name"
                        value={tier.name}
                        onChangeText={(value) => handleTierChange(tier.id, "name", value)}
                        placeholder={index === 0 ? "Regular" : "VIP"}
                        theme={theme}
                      />
                      <EventSlotField
                        label="Price (KES)"
                        value={tier.price}
                        onChangeText={(value) => handleTierChange(tier.id, "price", value)}
                        placeholder="1500"
                        theme={theme}
                        keyboardType="number-pad"
                      />
                      <EventSlotField
                        label="Tier capacity"
                        value={tier.capacity}
                        onChangeText={(value) => handleTierChange(tier.id, "capacity", value)}
                        placeholder="50"
                        theme={theme}
                        keyboardType="number-pad"
                        helperText="Optional. Leave blank to share the event capacity."
                      />
                      <EventSlotOutlineButton
                        label={draft.ticketTiers.length === 1 ? "Reset tier" : "Remove tier"}
                        theme={theme}
                        tone="text"
                        onPress={() => handleRemoveTier(tier.id)}
                        style={styles.tierButton}
                      />
                    </EventSlotInsetCard>
                  ))}
                  <EventSlotOutlineButton label="Add ticket tier" theme={theme} onPress={handleAddTier} style={styles.outlineButton} />
                </EventSlotSectionCard>
              </>
            ) : (
              <EventSlotMessageCard
                title="Free event selected"
                caption="Attendees will register without ticket pricing. Switch to Paid when you want KES pricing and ticket tiers."
                theme={theme}
                tone="input"
              />
            )}
            <EventSlotField
              label={CREATE_EVENT_COPY.fields.googleMapsLink.label}
              value={draft.mapDirectionsUrl}
              onChangeText={(value) => updateDraft("mapDirectionsUrl", value)}
              placeholder={CREATE_EVENT_COPY.fields.googleMapsLink.placeholder}
              theme={theme}
              helperText={CREATE_EVENT_COPY.fields.googleMapsLink.helper}
            />
            <EventSlotField
              label={CREATE_EVENT_COPY.fields.whatsappContact.label}
              value={draft.whatsappNumber}
              onChangeText={(value) => updateDraft("whatsappNumber", value)}
              placeholder={CREATE_EVENT_COPY.fields.whatsappContact.placeholder}
              theme={theme}
              keyboardType="phone-pad"
            />
          </EventSlotSectionCard>
        </>
      ) : null}

      {activeTab === "attendees" ? (
        <>
          <EventSlotStatusCard
            label={CREATE_EVENT_COPY.attendeeFlow.summary.label}
            title={CREATE_EVENT_COPY.attendeeFlow.summary.title}
            message={CREATE_EVENT_COPY.attendeeFlow.summary.message}
            meta={attendeeFlowSummary}
            theme={theme}
            tone="hero"
            style={styles.statusCard}
          />

          <EventSlotSectionCard
            title={CREATE_EVENT_COPY.attendeeFlow.registrationQuestions.title}
            caption={CREATE_EVENT_COPY.attendeeFlow.registrationQuestions.caption}
            theme={theme}
            style={styles.formCard}
          >
            <Text style={[styles.helper, { color: theme.colors.secondary }]}>
              Template questions are loaded from setup. Edit them here to match what attendees should submit on mobile.
            </Text>
            {draft.registrationQuestions.map((question, index) => (
              <EventSlotInsetCard key={question.id} theme={theme} style={styles.ticketTierCard}>
                <Text style={[styles.ticketTierTitle, { color: theme.colors.text }]}>Question {index + 1}</Text>
                <EventSlotField
                  label="Question label"
                  value={question.label}
                  onChangeText={(value) => handleQuestionChange(question.id, "label", value)}
                  placeholder="What should attendees answer?"
                  theme={theme}
                />
                <EventSlotSegmentedOptions
                  label="Question type"
                  options={[
                    { label: "Text", value: "text" },
                    { label: "Email", value: "email" },
                    { label: "Phone", value: "phone" },
                    { label: "Number", value: "number" },
                    { label: "Select", value: "select" },
                    { label: "Check", value: "checkbox" },
                    { label: "Long", value: "textarea" },
                    { label: "File", value: "file" }
                  ]}
                  selected={question.type}
                  onSelect={(value: NativeRegistrationQuestionType) => handleQuestionChange(question.id, "type", value)}
                  theme={theme}
                />
                <EventSlotSegmentedOptions
                  label="Required"
                  options={[
                    { label: "Optional", value: "optional" },
                    { label: "Required", value: "required" }
                  ]}
                  selected={question.required ? "required" : "optional"}
                  onSelect={(value) => handleQuestionChange(question.id, "required", value === "required")}
                  theme={theme}
                />
                {question.type === "select" || question.type === "checkbox" ? (
                  <View style={styles.questionOptionsSection}>
                    {(question.options ?? []).map((option, optionIndex) => (
                      <View key={`${question.id}-option-${optionIndex}`} style={styles.optionEditorCard}>
                        <EventSlotField
                          label={`Option ${optionIndex + 1}`}
                          value={option}
                          onChangeText={(value) => handleQuestionOptionChange(question.id, optionIndex, value)}
                          placeholder="Option label"
                          theme={theme}
                        />
                        <EventSlotField
                          label="Limit (optional)"
                          value={formatOptionLimitValue(question.optionLimits?.[option])}
                          onChangeText={(value) => handleQuestionOptionLimitChange(question.id, option, value)}
                          placeholder="Leave blank for no cap"
                          theme={theme}
                          keyboardType="number-pad"
                        />
                      </View>
                    ))}
                    {question.type === "checkbox" ? (
                      <EventSlotSegmentedOptions
                        label="Selection mode"
                        options={[
                          { label: "Single", value: "single" },
                          { label: "Multiple", value: "multiple" }
                        ]}
                        selected={question.allowMultiple ? "multiple" : "single"}
                        onSelect={(value) => handleQuestionChange(question.id, "allowMultiple", value === "multiple")}
                        theme={theme}
                      />
                    ) : null}
                    <Text style={[styles.helper, { color: theme.colors.secondary }]}>
                      Add per-option limits to mirror web-side capped positions. Leave a limit blank when that option should stay open.
                    </Text>
                    <View style={styles.inlineActions}>
                      <EventSlotOutlineButton label="Add option" theme={theme} onPress={() => handleAddQuestionOption(question.id)} style={styles.tierButton} />
                      {(question.options ?? []).length > 0 ? (
                        <EventSlotOutlineButton
                          label="Remove last option"
                          theme={theme}
                          tone="text"
                          onPress={() => handleRemoveQuestionOption(question.id, (question.options ?? []).length - 1)}
                          style={styles.tierButton}
                        />
                      ) : null}
                    </View>
                  </View>
                ) : null}
                {question.type === "file" ? (
                  <EventSlotMessageCard
                    title="File question"
                    caption="This question uses the upload configuration in the Uploads section below. The attendee will see the upload label, help text, accepted file types, and requirement state there."
                    theme={theme}
                    tone="input"
                  />
                ) : null}
                <EventSlotOutlineButton
                  label={draft.registrationQuestions.length === 1 ? "Reset question" : "Remove question"}
                  theme={theme}
                  tone="text"
                  onPress={() => handleRemoveQuestion(question.id)}
                  style={styles.tierButton}
                />
              </EventSlotInsetCard>
            ))}
            <EventSlotOutlineButton label="Add question" theme={theme} onPress={handleAddQuestion} style={styles.outlineButton} />
          </EventSlotSectionCard>

          <EventSlotSectionCard
            title={CREATE_EVENT_COPY.attendeeFlow.consent.title}
            caption={CREATE_EVENT_COPY.attendeeFlow.consent.caption}
            theme={theme}
            style={styles.formCard}
          >
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: draft.showRemainingSpots }}
              onPress={() => updateDraft("showRemainingSpots", !draft.showRemainingSpots)}
              style={[styles.switchRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.input }]}
            >
              <Text style={[styles.switchText, { color: theme.colors.text }]}>
                {draft.showRemainingSpots ? "Remaining spots visible to attendees" : "Remaining spots hidden from attendees"}
              </Text>
              <EventSlotPill label={draft.showRemainingSpots ? "ON" : "OFF"} theme={theme} style={styles.switchPill} />
            </Pressable>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: draft.attendeeConsentEnabled }}
              onPress={() => updateDraft("attendeeConsentEnabled", !draft.attendeeConsentEnabled)}
              style={[styles.switchRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.input }]}
            >
              <Text style={[styles.switchText, { color: theme.colors.text }]}>
                {draft.attendeeConsentEnabled ? "Consent screen enabled" : "Consent screen disabled"}
              </Text>
              <EventSlotPill label={draft.attendeeConsentEnabled ? "ON" : "OFF"} theme={theme} style={styles.switchPill} />
            </Pressable>
            {draft.attendeeConsentEnabled ? (
              <EventSlotField
                label="Consent wording"
                value={draft.attendeeConsentText}
                onChangeText={(value) => updateDraft("attendeeConsentText", value)}
                placeholder={CREATE_EVENT_COPY.fields.consentText.placeholder}
                theme={theme}
                multiline
              />
            ) : null}
          </EventSlotSectionCard>

          <EventSlotSectionCard
            title={CREATE_EVENT_COPY.attendeeFlow.uploads.title}
            caption={CREATE_EVENT_COPY.attendeeFlow.uploads.caption}
            theme={theme}
            style={styles.formCard}
          >
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: draft.attachmentRequirement.enabled }}
              onPress={() =>
                updateDraft("attachmentRequirement", {
                  ...draft.attachmentRequirement,
                  enabled: !draft.attachmentRequirement.enabled
                })
              }
              style={[styles.switchRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.input }]}
            >
              <Text style={[styles.switchText, { color: theme.colors.text }]}>
                {draft.attachmentRequirement.enabled ? "File upload question enabled" : "File upload question disabled"}
              </Text>
              <EventSlotPill label={draft.attachmentRequirement.enabled ? "ON" : "OFF"} theme={theme} style={styles.switchPill} />
            </Pressable>
            <Text style={[styles.helper, { color: theme.colors.secondary }]}>{uploadReadiness}</Text>
            {draft.attachmentRequirement.enabled ? (
              <>
                {fileQuestion ? (
                  <Text style={[styles.helper, { color: theme.colors.accent }]}>
                    File question linked: {fileQuestion.label || "Untitled file question"}
                  </Text>
                ) : null}
                <EventSlotField
                  label="Upload label"
                  value={draft.attachmentRequirement.label}
                  onChangeText={(value) =>
                    updateDraft("attachmentRequirement", {
                      ...draft.attachmentRequirement,
                      label: value
                    })
                  }
                  placeholder="Attach a document or image"
                  theme={theme}
                />
                <EventSlotField
                  label="Upload help text"
                  value={draft.attachmentRequirement.caption}
                  onChangeText={(value) =>
                    updateDraft("attachmentRequirement", {
                      ...draft.attachmentRequirement,
                      caption: value
                    })
                  }
                  placeholder="Tell attendees what to upload."
                  theme={theme}
                  multiline
                />
                <EventSlotSegmentedOptions
                  label="Accepted files"
                  options={[
                    { label: "Any", value: "any" },
                    { label: "Images", value: "image" },
                    { label: "Documents", value: "document" }
                  ]}
                  selected={draft.attachmentRequirement.acceptedKind}
                  onSelect={(value: NativeAttachmentKind) =>
                    updateDraft("attachmentRequirement", {
                      ...draft.attachmentRequirement,
                      acceptedKind: value
                    })
                  }
                  theme={theme}
                />
                <EventSlotField
                  label="Max file size (MB)"
                  value={`${draft.attachmentRequirement.maxFileSizeMb}`}
                  onChangeText={(value) =>
                    updateDraft("attachmentRequirement", {
                      ...draft.attachmentRequirement,
                      maxFileSizeMb: parseNativeFileSizeLimit(value)
                    })
                  }
                  placeholder="10"
                  theme={theme}
                  keyboardType="number-pad"
                />
                <EventSlotSegmentedOptions
                  label="Required"
                  options={[
                    { label: "Optional", value: "optional" },
                    { label: "Required", value: "required" }
                  ]}
                  selected={draft.attachmentRequirement.required ? "required" : "optional"}
                  onSelect={(value) =>
                    updateDraft("attachmentRequirement", {
                      ...draft.attachmentRequirement,
                      required: value === "required"
                    })
                  }
                  theme={theme}
                />
                <EventSlotOutlineButton label="Choose file" theme={theme} tone="text" onPress={handlePickAttachment} style={styles.outlineButton} />
                <EventSlotInsetCard theme={theme} style={styles.attachmentPreview}>
                  <Text style={[styles.helper, { color: attachmentPreview?.validationError ? theme.colors.error : theme.colors.secondary }]}>
                    {attachmentStatus}
                  </Text>
                  {attachmentPreview ? (
                    <Text style={[styles.helper, { color: theme.colors.muted }]}>
                      {attachmentPreview.name} | {Math.ceil(attachmentPreview.sizeBytes / 1024)} KB | {attachmentPreview.mimeType}
                    </Text>
                  ) : null}
                </EventSlotInsetCard>
              </>
            ) : null}
          </EventSlotSectionCard>
        </>
      ) : null}

      {activeTab === "review" ? (
        <>
          <EventSlotStatusCard
            label={CREATE_EVENT_COPY.review.readiness.label}
            message={
              validation.errors.length === 0 && validation.warnings.length === 0
                ? CREATE_EVENT_COPY.review.readiness.readyMessage
                : CREATE_EVENT_COPY.review.readiness.issuesMessage
            }
            theme={theme}
            emphasis={validation.canSubmit ? "success" : "accent"}
            trailing={
              <EventSlotPill
                label={validation.canSubmit ? "READY" : `${validation.errors.length} FIX`}
                theme={theme}
                tone={validation.canSubmit ? "success" : "error"}
                style={styles.validationPill}
              />
            }
            style={[styles.statusCard, validation.canSubmit ? { borderColor: theme.colors.success } : undefined]}
          >
            {validation.errors.map((issue) => (
              <ValidationLine key={`error-${issue.field}-${issue.message}`} message={issue.message} tone="error" theme={theme} />
            ))}
            {validation.warnings.slice(0, 3).map((issue) => (
              <ValidationLine key={`warning-${issue.field}-${issue.message}`} message={issue.message} tone="warning" theme={theme} />
            ))}
            {validation.warnings.length > 3 ? (
              <Text style={[styles.statusCopy, { color: theme.colors.secondary }]}>
                {validation.warnings.length - 3} more suggestion{validation.warnings.length - 3 === 1 ? "" : "s"} will be checked before live publishing.
              </Text>
            ) : null}
          </EventSlotStatusCard>

          <EventSlotStatusCard
            label={CREATE_EVENT_COPY.review.publishStatus.label}
            message={publishReadiness}
            theme={theme}
            tone="hero"
            emphasis={submissionPreparation.ready ? "success" : "accent"}
            trailing={
              <EventSlotPill
                label={session.authMode.toUpperCase()}
                theme={theme}
                tone={session.authMode === "live" ? "success" : "muted"}
                style={styles.validationPill}
              />
            }
            style={[styles.statusCard, submissionPreparation.ready ? { borderColor: theme.colors.success } : undefined]}
          >
            <Text style={[styles.statusCopy, { color: submissionPreparation.ready ? theme.colors.secondary : theme.colors.error }]}>
              {submissionPreparation.ready ? submitStatus : submissionPreparation.reason}
            </Text>
          </EventSlotStatusCard>

          <EventSlotSectionCard
            title={CREATE_EVENT_COPY.review.preview.title}
            caption={CREATE_EVENT_COPY.review.preview.caption}
            theme={theme}
            tone="hero"
            style={styles.preview}
          >
            <Text style={[styles.previewTitle, { color: theme.colors.text }]}>{preview.title}</Text>
            <Text style={[styles.previewMeta, { color: theme.colors.accent }]}>
              Template: {selectedTemplate.name}
            </Text>
            <Text style={[styles.previewMeta, { color: theme.colors.secondary }]}>
              {preview.dateLabel} | {preview.venue} | {preview.capacity} spots
            </Text>
            <Text style={[styles.previewMeta, { color: theme.colors.secondary }]}>
              {preview.eventType} | {preview.accessType} | {draft.monetization === "paid" ? preview.entryFeeLabel ?? "Paid event" : "Registration only"}
            </Text>
            {draft.monetization === "paid" && (preview.standardPrice || (preview.ticketTiers && preview.ticketTiers.length > 0)) ? (
              <Text style={[styles.previewMeta, { color: theme.colors.accent }]}>
                {preview.standardPrice ? `Standard KES ${preview.standardPrice}` : "Custom ticket tiers configured"}
              </Text>
            ) : null}
            {draft.monetization === "paid" && preview.ticketTiers && preview.ticketTiers.length > 0 ? (
              <View style={styles.previewTierList}>
                {preview.ticketTiers.map((tier) => (
                  <Text key={tier.id} style={[styles.previewMeta, { color: theme.colors.secondary }]}>
                    {tier.name || "Untitled tier"} | KES {tier.price || "0"}{tier.capacity ? ` | ${tier.capacity} spots` : ""}
                  </Text>
                ))}
              </View>
            ) : null}
            {preview.eventType === "virtual" && preview.virtualLink ? (
              <Text style={[styles.previewMeta, { color: theme.colors.accent }]}>
                Virtual link ready: {preview.virtualLink}
              </Text>
            ) : null}
            <Text style={[styles.previewBody, { color: theme.colors.secondary }]}>
              {draft.description || "Your event description will appear here with the spacing and wording preserved."}
            </Text>
            {mapAction.ready ? (
              <View style={[styles.mapStatus, { borderColor: theme.colors.border }]}>
                <Text style={[styles.previewMeta, { color: mapAction.source === "organiser-link" || mapAction.source === "venue-search" ? theme.colors.accent : theme.colors.error }]}>
                  {mapAction.source === "organiser-link" ? "Organiser Maps link ready" : "Venue can be searched on Google Maps"}
                </Text>
                <Pressable accessibilityRole="button" onPress={() => openMapUrl(mapAction.url)} style={[styles.mapButton, { borderColor: theme.colors.border }]}>
                  <Text style={[styles.mapButtonText, { color: theme.colors.accent }]}>{mapAction.label}</Text>
                </Pressable>
              </View>
            ) : null}
            {preview.attendeeConsentEnabled ? (
              <Text style={[styles.previewMeta, { color: theme.colors.accent }]}>Custom consent screen enabled</Text>
            ) : null}
            {preview.registrationQuestions && preview.registrationQuestions.length > 0 ? (
              <View style={styles.previewTierList}>
                {preview.registrationQuestions.map((question) => (
                  <Text key={question.id} style={[styles.previewMeta, { color: theme.colors.secondary }]}>
                    {question.label || "Untitled question"} | {question.type}{question.required ? " | required" : ""}
                  </Text>
                ))}
              </View>
            ) : null}
            {preview.attachmentRequirement ? (
              <Text style={[styles.previewMeta, { color: theme.colors.accent }]}>
                Upload question: {preview.attachmentRequirement.label} ({preview.attachmentRequirement.acceptedKind}, max {preview.attachmentRequirement.maxFileSizeMb} MB)
              </Text>
            ) : null}
          </EventSlotSectionCard>
        </>
      ) : null}

      <View style={[styles.actionRow, { borderColor: theme.colors.border }]}>
        <Pressable accessibilityRole="button" onPress={handleSaveDraft} style={[styles.actionButton, { backgroundColor: theme.colors.accent }]}>
          <Text style={styles.actionButtonText}>{CREATE_EVENT_COPY.actions.saveDraft}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={!submissionPreparation.ready}
          onPress={handleNativeSubmit}
          style={[
            styles.actionButton,
            {
              backgroundColor: submissionPreparation.ready ? theme.colors.success : theme.colors.border,
              opacity: submissionPreparation.ready ? 1 : 0.55
            }
          ]}
        >
          <Text style={styles.actionButtonText}>{CREATE_EVENT_COPY.actions.publish}</Text>
        </Pressable>
        <EventSlotOutlineButton label={CREATE_EVENT_COPY.actions.clear} theme={theme} tone="text" onPress={handleClearDraft} style={styles.outlineButton} />
      </View>
    </View>
  );
}

type ValidationLineProps = {
  message: string;
  tone: "error" | "warning";
  theme: NativeScreenProps["theme"];
};

function ValidationLine({ message, tone, theme }: ValidationLineProps) {
  return (
    <Text style={[styles.validationLine, { color: tone === "error" ? theme.colors.error : theme.colors.secondary }]}>
      {tone === "error" ? "Fix: " : "Tip: "}
      {message}
    </Text>
  );
}

function parseNativeFileSizeLimit(value: string): number {
  const parsed = Number.parseInt(value.replace(/[^0-9]/g, ""), 10);
  if (Number.isNaN(parsed)) {
    return 0;
  }

  return Math.min(Math.max(parsed, 1), 50);
}

function parseOptionLimit(value: string): number | null {
  const parsed = Number.parseInt(value.replace(/[^0-9]/g, ""), 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function formatOptionLimitValue(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? String(value) : "";
}

function pruneQuestionOptionLimits(
  optionLimits: NativeRegistrationQuestion["optionLimits"],
  options: string[]
): NativeRegistrationQuestion["optionLimits"] {
  if (!optionLimits) {
    return undefined;
  }

  const nextEntries = options
    .map((option) => option.trim())
    .filter(Boolean)
    .map((option) => [option, optionLimits[option] ?? null] as const)
    .filter(([, limit]) => typeof limit === "number" && Number.isFinite(limit) && limit > 0);

  return nextEntries.length > 0 ? Object.fromEntries(nextEntries) : undefined;
}

function renameQuestionOptionLimit(
  optionLimits: NativeRegistrationQuestion["optionLimits"],
  previousOption: string,
  nextOption: string
): NativeRegistrationQuestion["optionLimits"] {
  if (!optionLimits) {
    return undefined;
  }

  const nextEntries = Object.entries(optionLimits)
    .map(([option, limit]) => [option === previousOption ? nextOption : option, limit] as const)
    .filter(([option]) => option.trim())
    .filter(([, limit]) => typeof limit === "number" && Number.isFinite(limit) && limit > 0);

  return nextEntries.length > 0 ? Object.fromEntries(nextEntries) : undefined;
}

const styles = StyleSheet.create({
  stack: {
    gap: 14
  },
  statusCard: {
    gap: 6,
    padding: 16
  },
  billingBanner: {
    gap: 6,
    padding: 16
  },
  statusCopy: {
    fontSize: 14,
    lineHeight: 20
  },
  validationPill: {
    marginLeft: 10
  },
  validationLine: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 20
  },
  checklistItem: {
    alignItems: "flex-start",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingTop: 12
  },
  checklistBadge: {
    borderRadius: 999,
    fontSize: 10,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 5
  },
  checklistCopy: {
    flex: 1,
    gap: 3
  },
  checklistTitle: {
    fontSize: 14,
    fontWeight: "900"
  },
  formCard: {
    gap: 14,
    padding: 18
  },
  templateGrid: {
    gap: 10
  },
  templateCard: {
    minHeight: 106
  },
  eventKindGrid: {
    gap: 10
  },
  eventKindCard: {
    minHeight: 124
  },
  helper: {
    fontSize: 13,
    lineHeight: 20
  },
  switchRow: {
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14
  },
  switchText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "900"
  },
  switchPill: {
    marginLeft: 10
  },
  actionRow: {
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 10
  },
  actionButton: {
    alignItems: "center",
    borderRadius: 999,
    flex: 1,
    paddingVertical: 14
  },
  actionButtonText: {
    color: "#0A0A0A",
    fontSize: 14,
    fontWeight: "900"
  },
  outlineButton: {
    flex: 1,
    paddingVertical: 14
  },
  attachmentPreview: {
    gap: 4,
    padding: 12
  },
  innerSection: {
    gap: 12,
    padding: 14
  },
  ticketTierCard: {
    gap: 10,
    padding: 12
  },
  ticketTierTitle: {
    fontSize: 15,
    fontWeight: "900"
  },
  tierButton: {
    paddingVertical: 12
  },
  questionOptionsSection: {
    gap: 10
  },
  optionEditorCard: {
    gap: 10
  },
  inlineActions: {
    gap: 10
  },
  preview: {
    gap: 10,
    padding: 20
  },
  previewTierList: {
    gap: 4
  },
  previewTitle: {
    fontSize: 26,
    fontWeight: "900",
    lineHeight: 30
  },
  previewMeta: {
    fontSize: 14,
    fontWeight: "800"
  },
  previewBody: {
    fontSize: 14,
    lineHeight: 22
  },
  mapStatus: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    paddingTop: 10
  },
  mapButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  mapButtonText: {
    fontSize: 12,
    fontWeight: "900"
  }
});
