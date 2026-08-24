import { StyleSheet, Text, TextInput, View } from "react-native";

import { AppTheme } from "../theme";

type EventSlotFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  theme: AppTheme;
  keyboardType?: "default" | "number-pad" | "phone-pad";
  multiline?: boolean;
  helperText?: string;
  editable?: boolean;
};

export function EventSlotField({
  label,
  value,
  onChangeText,
  placeholder,
  theme,
  keyboardType = "default",
  multiline = false,
  helperText,
  editable = true
}: EventSlotFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.colors.muted }]}>{label.toUpperCase()}</Text>
      <TextInput
        editable={editable}
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.muted}
        style={[
          styles.input,
          multiline && styles.multiline,
          !editable && styles.inputDisabled,
          { backgroundColor: theme.colors.input, borderColor: theme.colors.border, color: theme.colors.text }
        ]}
        value={value}
      />
      {helperText ? <Text style={[styles.helper, { color: theme.colors.secondary }]}>{helperText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
  inputDisabled: {
    opacity: 0.6
  },
  multiline: {
    minHeight: 110,
    textAlignVertical: "top"
  },
  helper: {
    fontSize: 13,
    lineHeight: 20
  }
});
