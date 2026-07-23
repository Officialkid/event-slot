import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { NativeAccessType, NativeEventType } from "../domain/events";
import { createDraftPreview } from "../services/events";
import { NativeScreenProps } from "./types";

export function CreateEventScreen({ theme, navigate }: NativeScreenProps) {
  const [title, setTitle] = useState("");
  const [dateLabel, setDateLabel] = useState("");
  const [venue, setVenue] = useState("");
  const [capacity, setCapacity] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState<NativeEventType>("physical");
  const [accessType, setAccessType] = useState<NativeAccessType>("public");
  const [mapDirectionsUrl, setMapDirectionsUrl] = useState("");
  const [entryFeeLabel, setEntryFeeLabel] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [attendeeConsentEnabled, setAttendeeConsentEnabled] = useState(false);
  const [attendeeConsentText, setAttendeeConsentText] = useState("");

  const preview = useMemo(
    () =>
      createDraftPreview({
        title,
        dateLabel,
        venue,
        capacity,
        description,
        eventType,
        accessType,
        mapDirectionsUrl,
        entryFeeLabel,
        whatsappNumber,
        attendeeConsentEnabled,
        attendeeConsentText
      }),
    [
      accessType,
      attendeeConsentEnabled,
      attendeeConsentText,
      capacity,
      dateLabel,
      description,
      entryFeeLabel,
      eventType,
      mapDirectionsUrl,
      title,
      venue,
      whatsappNumber
    ]
  );

  return (
    <View style={styles.stack}>
      <Pressable accessibilityRole="button" onPress={() => navigate({ name: "events" })}>
        <Text style={[styles.backLink, { color: theme.colors.accent }]}>Back to events</Text>
      </Pressable>
      <Text style={[styles.heading, { color: theme.colors.text }]}>Create Event</Text>
      <Text style={[styles.subcopy, { color: theme.colors.secondary }]}>
        This is the native draft flow. It does not publish anything yet; live event creation will be wired after API/session work.
      </Text>

      <View style={[styles.formCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.sectionLabel, { color: theme.colors.accent }]}>EVENT BASICS</Text>
        <Field label="Event title" value={title} onChangeText={setTitle} placeholder="e.g. Annual team summit" theme={theme} />
        <Field label="Date" value={dateLabel} onChangeText={setDateLabel} placeholder="e.g. 22 Aug 2026" theme={theme} />
        <Field label="Venue" value={venue} onChangeText={setVenue} placeholder="Venue or online link" theme={theme} />
        <Field label="Capacity" value={capacity} onChangeText={setCapacity} placeholder="100" theme={theme} keyboardType="number-pad" />
        <OptionRow
          label="Event type"
          options={[
            { label: "Physical", value: "physical" },
            { label: "Virtual", value: "virtual" }
          ]}
          selected={eventType}
          onSelect={setEventType}
          theme={theme}
        />
        <OptionRow
          label="Access"
          options={[
            { label: "Public", value: "public" },
            { label: "Private", value: "private" }
          ]}
          selected={accessType}
          onSelect={setAccessType}
          theme={theme}
        />
        <Field
          label="Caption / description"
          value={description}
          onChangeText={setDescription}
          placeholder="Keep spacing, emojis, and event wording exactly as entered."
          theme={theme}
          multiline
        />
      </View>

      <View style={[styles.formCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.sectionLabel, { color: theme.colors.accent }]}>ORGANIZER DETAILS</Text>
        <Field
          label="Entry / contribution label"
          value={entryFeeLabel}
          onChangeText={setEntryFeeLabel}
          placeholder="e.g. KSh 1,000 paid via organiser"
          theme={theme}
        />
        <Text style={[styles.helper, { color: theme.colors.secondary }]}>
          Payments stay hidden in native. This field only explains external contribution details if the organiser adds them.
        </Text>
        <Field
          label="Google Maps link"
          value={mapDirectionsUrl}
          onChangeText={setMapDirectionsUrl}
          placeholder="Paste organiser-provided Maps link"
          theme={theme}
        />
        <Field
          label="WhatsApp contact"
          value={whatsappNumber}
          onChangeText={setWhatsappNumber}
          placeholder="+254..."
          theme={theme}
          keyboardType="phone-pad"
        />
      </View>

      <View style={[styles.formCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.sectionLabel, { color: theme.colors.accent }]}>CONSENT</Text>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: attendeeConsentEnabled }}
          onPress={() => setAttendeeConsentEnabled((current) => !current)}
          style={[styles.switchRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.input }]}
        >
          <Text style={[styles.switchText, { color: theme.colors.text }]}>
            {attendeeConsentEnabled ? "Consent screen enabled" : "Consent screen disabled"}
          </Text>
          <Text style={[styles.switchPill, { backgroundColor: theme.colors.activeTab, color: theme.colors.accent }]}>
            {attendeeConsentEnabled ? "ON" : "OFF"}
          </Text>
        </Pressable>
        {attendeeConsentEnabled ? (
          <Field
            label="Consent wording"
            value={attendeeConsentText}
            onChangeText={setAttendeeConsentText}
            placeholder="Write the consent clause attendees must review."
            theme={theme}
            multiline
          />
        ) : null}
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
          {description || "Your event description will appear here with the spacing and wording preserved."}
        </Text>
        {preview.mapDirectionsUrl ? (
          <Text style={[styles.previewMeta, { color: theme.colors.accent }]}>Maps link ready</Text>
        ) : null}
        {preview.attendeeConsentEnabled ? (
          <Text style={[styles.previewMeta, { color: theme.colors.accent }]}>Custom consent screen enabled</Text>
        ) : null}
      </View>
    </View>
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
  }
});
