import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { NativeAttachmentDraft, NativeAttachmentKind } from "../domain/attachments";
import { EventDraft, NativeAccessType, NativeEventType } from "../domain/events";
import { clearEventDraft, emptyEventDraft, hasEventDraftChanges, loadEventDraft, saveEventDraft } from "../services/drafts";
import { getNativeCreateEventReadinessMessage, prepareNativeCreateEventRequest, submitNativeEventDraft } from "../services/eventSubmission";
import { validateEventDraft } from "../services/eventValidation";
import { createDraftPreview } from "../services/events";
import { isSupportedMapUrl, openMapUrl } from "../services/maps";
import { getUploadReadinessMessage, pickNativeAttachment, prepareNativeAttachmentUpload } from "../services/uploads";
import { NativeScreenProps } from "./types";

export function CreateEventScreen({ theme, navigate, refreshEvents, session }: NativeScreenProps) {
  const [draft, setDraft] = useState<EventDraft>(emptyEventDraft);
  const [draftStatus, setDraftStatus] = useState("Loading saved native draft...");
  const [draftLoading, setDraftLoading] = useState(true);
  const [submitStatus, setSubmitStatus] = useState("Native publishing is not active until live API mode is enabled.");
  const [attachmentPreview, setAttachmentPreview] = useState<NativeAttachmentDraft | null>(null);
  const [attachmentStatus, setAttachmentStatus] = useState("No attachment selected in this native preview.");

  useEffect(() => {
    let mounted = true;

    loadEventDraft()
      .then((savedDraft) => {
        if (!mounted) {
          return;
        }
        setDraft(savedDraft);
        setDraftStatus(hasEventDraftChanges(savedDraft) ? "Saved draft restored on this device." : "No saved draft yet.");
      })
      .catch(() => {
        if (mounted) {
          setDraftStatus("Could not load saved draft.");
        }
      })
      .finally(() => {
        if (mounted) {
          setDraftLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const preview = useMemo(() => createDraftPreview(draft), [draft]);
  const validation = useMemo(() => validateEventDraft(draft), [draft]);
  const submissionPreparation = useMemo(() => prepareNativeCreateEventRequest(draft), [draft]);
  const mapUrlSupported = isSupportedMapUrl(preview.mapDirectionsUrl);
  const publishReadiness = getNativeCreateEventReadinessMessage(session);
  const uploadReadiness = getUploadReadinessMessage();

  const updateDraft = <Key extends keyof EventDraft>(key: Key, value: EventDraft[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setDraftStatus("Unsaved changes on this device.");
  };

  const handleSaveDraft = async () => {
    await saveEventDraft(draft);
    setDraftStatus("Draft saved locally in the native app preview.");
  };

  const handleClearDraft = async () => {
    await clearEventDraft();
    setDraft({ ...emptyEventDraft });
    setDraftStatus("Draft cleared from this native preview.");
    setSubmitStatus("Native publishing is not active until live API mode is enabled.");
  };

  const handleNativeSubmit = async () => {
    if (!submissionPreparation.ready) {
      setSubmitStatus(submissionPreparation.reason);
      return;
    }

    if (session.authMode !== "live") {
      setSubmitStatus("This draft is ready, but native publishing is intentionally disabled in demo mode.");
      return;
    }

    setSubmitStatus("Publishing event through the native API...");
    try {
      const createdEvent = await submitNativeEventDraft(session, draft);
      await clearEventDraft();
      setDraft({ ...emptyEventDraft });
      setDraftStatus("Draft published and cleared from this device.");
      setSubmitStatus(`Created ${createdEvent.title}. Refreshing your native events...`);
      refreshEvents();
      navigate({ name: "eventDetail", eventId: createdEvent.id });
    } catch (error) {
      setSubmitStatus(error instanceof Error ? error.message : "Could not publish this native event draft.");
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
    setAttachmentStatus(readiness.message);
  };

  return (
    <View style={styles.stack}>
      <Pressable accessibilityRole="button" onPress={() => navigate({ name: "events" })}>
        <Text style={[styles.backLink, { color: theme.colors.accent }]}>Back to events</Text>
      </Pressable>
      <Text style={[styles.heading, { color: theme.colors.text }]}>Create Event</Text>
      <Text style={[styles.subcopy, { color: theme.colors.secondary }]}>
        This native draft flow can save and restore progress locally. It still does not publish anything until live API/session work is approved.
      </Text>

      <View style={[styles.statusCard, { backgroundColor: theme.colors.hero, borderColor: theme.colors.border }]}>
        <Text style={[styles.statusTitle, { color: theme.colors.accent }]}>LOCAL DRAFT</Text>
        <Text style={[styles.statusCopy, { color: theme.colors.secondary }]}>
          {draftLoading ? "Checking this device for saved work..." : draftStatus}
        </Text>
      </View>

      <View style={[styles.statusCard, { backgroundColor: theme.colors.surface, borderColor: validation.canSubmit ? theme.colors.success : theme.colors.border }]}>
        <View style={styles.validationHeader}>
          <Text style={[styles.statusTitle, { color: validation.canSubmit ? theme.colors.success : theme.colors.accent }]}>
            DRAFT READINESS
          </Text>
          <Text style={[styles.validationPill, { backgroundColor: theme.colors.activeTab, color: validation.canSubmit ? theme.colors.success : theme.colors.error }]}>
            {validation.canSubmit ? "READY" : `${validation.errors.length} FIX`}
          </Text>
        </View>
        {validation.errors.length === 0 && validation.warnings.length === 0 ? (
          <Text style={[styles.statusCopy, { color: theme.colors.secondary }]}>
            This draft has the minimum information needed for the future native publish step.
          </Text>
        ) : null}
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
      </View>

      <View style={[styles.statusCard, { backgroundColor: theme.colors.hero, borderColor: submissionPreparation.ready ? theme.colors.success : theme.colors.border }]}>
        <View style={styles.validationHeader}>
          <Text style={[styles.statusTitle, { color: submissionPreparation.ready ? theme.colors.success : theme.colors.accent }]}>
            NATIVE PUBLISH
          </Text>
          <Text style={[styles.validationPill, { backgroundColor: theme.colors.activeTab, color: session.authMode === "live" ? theme.colors.success : theme.colors.muted }]}>
            {session.authMode.toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.statusCopy, { color: theme.colors.secondary }]}>{publishReadiness}</Text>
        <Text style={[styles.statusCopy, { color: submissionPreparation.ready ? theme.colors.secondary : theme.colors.error }]}>
          {submissionPreparation.ready ? submitStatus : submissionPreparation.reason}
        </Text>
      </View>

      <View style={[styles.formCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.sectionLabel, { color: theme.colors.accent }]}>EVENT BASICS</Text>
        <Field label="Event title" value={draft.title} onChangeText={(value) => updateDraft("title", value)} placeholder="e.g. Annual team summit" theme={theme} />
        <Field label="Date" value={draft.dateLabel} onChangeText={(value) => updateDraft("dateLabel", value)} placeholder="e.g. 22 Aug 2026" theme={theme} />
        <Field label="Venue" value={draft.venue} onChangeText={(value) => updateDraft("venue", value)} placeholder="Venue or online link" theme={theme} />
        <Field label="Capacity" value={draft.capacity} onChangeText={(value) => updateDraft("capacity", value)} placeholder="100" theme={theme} keyboardType="number-pad" />
        <OptionRow
          label="Event type"
          options={[
            { label: "Physical", value: "physical" },
            { label: "Virtual", value: "virtual" }
          ]}
          selected={draft.eventType}
          onSelect={(value) => updateDraft("eventType", value)}
          theme={theme}
        />
        <OptionRow
          label="Access"
          options={[
            { label: "Public", value: "public" },
            { label: "Private", value: "private" }
          ]}
          selected={draft.accessType}
          onSelect={(value) => updateDraft("accessType", value)}
          theme={theme}
        />
        <Field
          label="Caption / description"
          value={draft.description}
          onChangeText={(value) => updateDraft("description", value)}
          placeholder="Keep spacing, emojis, and event wording exactly as entered."
          theme={theme}
          multiline
        />
      </View>

      <View style={[styles.formCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.sectionLabel, { color: theme.colors.accent }]}>ORGANIZER DETAILS</Text>
        <Field
          label="Entry / contribution label"
          value={draft.entryFeeLabel}
          onChangeText={(value) => updateDraft("entryFeeLabel", value)}
          placeholder="e.g. KSh 1,000 paid via organiser"
          theme={theme}
        />
        <Text style={[styles.helper, { color: theme.colors.secondary }]}>
          Payments stay hidden in native. This field only explains external contribution details if the organiser adds them.
        </Text>
        <Field
          label="Google Maps link"
          value={draft.mapDirectionsUrl}
          onChangeText={(value) => updateDraft("mapDirectionsUrl", value)}
          placeholder="Paste organiser-provided Maps link"
          theme={theme}
        />
        <Field
          label="WhatsApp contact"
          value={draft.whatsappNumber}
          onChangeText={(value) => updateDraft("whatsappNumber", value)}
          placeholder="+254..."
          theme={theme}
          keyboardType="phone-pad"
        />
      </View>

      <View style={[styles.formCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.sectionLabel, { color: theme.colors.accent }]}>CONSENT</Text>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: draft.attendeeConsentEnabled }}
          onPress={() => updateDraft("attendeeConsentEnabled", !draft.attendeeConsentEnabled)}
          style={[styles.switchRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.input }]}
        >
          <Text style={[styles.switchText, { color: theme.colors.text }]}>
            {draft.attendeeConsentEnabled ? "Consent screen enabled" : "Consent screen disabled"}
          </Text>
          <Text style={[styles.switchPill, { backgroundColor: theme.colors.activeTab, color: theme.colors.accent }]}>
            {draft.attendeeConsentEnabled ? "ON" : "OFF"}
          </Text>
        </Pressable>
        {draft.attendeeConsentEnabled ? (
          <Field
            label="Consent wording"
            value={draft.attendeeConsentText}
            onChangeText={(value) => updateDraft("attendeeConsentText", value)}
            placeholder="Write the consent clause attendees must review."
            theme={theme}
            multiline
          />
        ) : null}
      </View>

      <View style={[styles.formCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.sectionLabel, { color: theme.colors.accent }]}>ATTENDEE UPLOADS</Text>
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
          <Text style={[styles.switchPill, { backgroundColor: theme.colors.activeTab, color: theme.colors.accent }]}>
            {draft.attachmentRequirement.enabled ? "ON" : "OFF"}
          </Text>
        </Pressable>
        <Text style={[styles.helper, { color: theme.colors.secondary }]}>{uploadReadiness}</Text>
        {draft.attachmentRequirement.enabled ? (
          <>
            <Field
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
            <Field
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
            <OptionRow
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
            <OptionRow
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
            <Pressable accessibilityRole="button" onPress={handlePickAttachment} style={[styles.outlineButton, { borderColor: theme.colors.border }]}>
              <Text style={[styles.outlineButtonText, { color: theme.colors.text }]}>Test native file picker</Text>
            </Pressable>
            <View style={[styles.attachmentPreview, { borderColor: theme.colors.border, backgroundColor: theme.colors.input }]}>
              <Text style={[styles.helper, { color: attachmentPreview?.validationError ? theme.colors.error : theme.colors.secondary }]}>
                {attachmentStatus}
              </Text>
              {attachmentPreview ? (
                <Text style={[styles.helper, { color: theme.colors.muted }]}>
                  {attachmentPreview.name} | {Math.ceil(attachmentPreview.sizeBytes / 1024)} KB | {attachmentPreview.mimeType}
                </Text>
              ) : null}
            </View>
          </>
        ) : null}
      </View>

      <View style={[styles.actionRow, { borderColor: theme.colors.border }]}>
        <Pressable accessibilityRole="button" onPress={handleSaveDraft} style={[styles.actionButton, { backgroundColor: theme.colors.accent }]}>
          <Text style={styles.actionButtonText}>Save draft</Text>
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
          <Text style={styles.actionButtonText}>Publish</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={handleClearDraft} style={[styles.outlineButton, { borderColor: theme.colors.border }]}>
          <Text style={[styles.outlineButtonText, { color: theme.colors.text }]}>Clear</Text>
        </Pressable>
      </View>

      <View style={[styles.preview, { backgroundColor: theme.colors.hero, borderColor: theme.colors.border }]}>
        <Text style={[styles.previewLabel, { color: theme.colors.accent }]}>DRAFT PREVIEW</Text>
        <Text style={[styles.previewTitle, { color: theme.colors.text }]}>{preview.title}</Text>
        <Text style={[styles.previewMeta, { color: theme.colors.secondary }]}>
          {preview.dateLabel} | {preview.venue} | {preview.capacity} spots
        </Text>
        <Text style={[styles.previewMeta, { color: theme.colors.secondary }]}>
          {preview.eventType} | {preview.accessType} | {preview.entryFeeLabel ?? "Registration only"}
        </Text>
        <Text style={[styles.previewBody, { color: theme.colors.secondary }]}>
          {draft.description || "Your event description will appear here with the spacing and wording preserved."}
        </Text>
        {preview.mapDirectionsUrl ? (
          <View style={[styles.mapStatus, { borderColor: theme.colors.border }]}>
            <Text style={[styles.previewMeta, { color: mapUrlSupported ? theme.colors.accent : theme.colors.error }]}>
              {mapUrlSupported ? "Maps link ready" : "Maps link needs a Google Maps URL"}
            </Text>
            {mapUrlSupported ? (
              <Pressable accessibilityRole="button" onPress={() => openMapUrl(preview.mapDirectionsUrl)} style={[styles.mapButton, { borderColor: theme.colors.border }]}>
                <Text style={[styles.mapButtonText, { color: theme.colors.accent }]}>Open map</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {preview.attendeeConsentEnabled ? (
          <Text style={[styles.previewMeta, { color: theme.colors.accent }]}>Custom consent screen enabled</Text>
        ) : null}
        {preview.attachmentRequirement ? (
          <Text style={[styles.previewMeta, { color: theme.colors.accent }]}>
            Upload question: {preview.attachmentRequirement.label} ({preview.attachmentRequirement.acceptedKind})
          </Text>
        ) : null}
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

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  theme: NativeScreenProps["theme"];
  keyboardType?: "default" | "number-pad" | "phone-pad";
  multiline?: boolean;
};

function Field({ label, value, onChangeText, placeholder, theme, keyboardType = "default", multiline }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.colors.muted }]}>{label.toUpperCase()}</Text>
      <TextInput
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.muted}
        style={[
          styles.input,
          multiline && styles.multiline,
          { backgroundColor: theme.colors.input, borderColor: theme.colors.border, color: theme.colors.text }
        ]}
        value={value}
      />
    </View>
  );
}

type Option<T extends string> = {
  label: string;
  value: T;
};

type OptionRowProps<T extends string> = {
  label: string;
  options: Option<T>[];
  selected: T;
  onSelect: (value: T) => void;
  theme: NativeScreenProps["theme"];
};

function OptionRow<T extends string>({ label, options, selected, onSelect, theme }: OptionRowProps<T>) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.colors.muted }]}>{label.toUpperCase()}</Text>
      <View style={styles.optionRow}>
        {options.map((option) => {
          const active = option.value === selected;
          return (
            <Pressable
              accessibilityRole="button"
              key={option.value}
              onPress={() => onSelect(option.value)}
              style={[
                styles.optionButton,
                {
                  backgroundColor: active ? theme.colors.activeTab : theme.colors.input,
                  borderColor: active ? theme.colors.accent : theme.colors.border
                }
              ]}
            >
              <Text style={[styles.optionText, { color: active ? theme.colors.accent : theme.colors.secondary }]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
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
  heading: {
    fontSize: 32,
    fontWeight: "900"
  },
  subcopy: {
    fontSize: 15,
    lineHeight: 23
  },
  statusCard: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 6,
    padding: 16
  },
  statusTitle: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2
  },
  statusCopy: {
    fontSize: 14,
    lineHeight: 20
  },
  validationHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  validationPill: {
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  validationLine: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 20
  },
  formCard: {
    borderRadius: 26,
    borderWidth: 1,
    gap: 14,
    padding: 18
  },
  field: {
    gap: 8
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2.2
  },
  label: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.8
  },
  input: {
    borderRadius: 18,
    borderWidth: 1,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  multiline: {
    minHeight: 110,
    textAlignVertical: "top"
  },
  optionRow: {
    flexDirection: "row",
    gap: 10
  },
  optionButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 13
  },
  optionText: {
    fontSize: 13,
    fontWeight: "900"
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
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6
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
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 14
  },
  outlineButtonText: {
    fontSize: 14,
    fontWeight: "900"
  },
  attachmentPreview: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    padding: 12
  },
  preview: {
    borderRadius: 26,
    borderWidth: 1,
    gap: 10,
    padding: 20
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2.2
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
