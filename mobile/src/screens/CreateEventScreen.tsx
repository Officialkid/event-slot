import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { createDraftPreview } from "../services/events";
import { NativeScreenProps } from "./types";

export function CreateEventScreen({ theme, navigate }: NativeScreenProps) {
  const [title, setTitle] = useState("");
  const [dateLabel, setDateLabel] = useState("");
  const [venue, setVenue] = useState("");
  const [capacity, setCapacity] = useState("");
  const [description, setDescription] = useState("");
  const preview = useMemo(
    () => createDraftPreview({ title, dateLabel, venue, capacity, description }),
    [capacity, dateLabel, description, title, venue]
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
        <Field label="Event title" value={title} onChangeText={setTitle} placeholder="e.g. Annual team summit" theme={theme} />
        <Field label="Date" value={dateLabel} onChangeText={setDateLabel} placeholder="e.g. 22 Aug 2026" theme={theme} />
        <Field label="Venue" value={venue} onChangeText={setVenue} placeholder="Venue or online link" theme={theme} />
        <Field label="Capacity" value={capacity} onChangeText={setCapacity} placeholder="100" theme={theme} keyboardType="number-pad" />
        <Field
          label="Caption / description"
          value={description}
          onChangeText={setDescription}
          placeholder="Keep spacing, emojis, and event wording exactly as entered."
          theme={theme}
          multiline
        />
      </View>

      <View style={[styles.preview, { backgroundColor: theme.colors.hero, borderColor: theme.colors.border }]}>
        <Text style={[styles.previewLabel, { color: theme.colors.accent }]}>DRAFT PREVIEW</Text>
        <Text style={[styles.previewTitle, { color: theme.colors.text }]}>{preview.title}</Text>
        <Text style={[styles.previewMeta, { color: theme.colors.secondary }]}>
          {preview.dateLabel} · {preview.venue} · {preview.capacity} spots
        </Text>
        <Text style={[styles.previewBody, { color: theme.colors.secondary }]}>
          {description || "Your event description will appear here with the spacing and wording preserved."}
        </Text>
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
  keyboardType?: "default" | "number-pad";
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

