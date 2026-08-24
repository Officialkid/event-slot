import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from "react-native";

import { AppTheme } from "../theme";

type EventSlotOutlineButtonProps = {
  label: string;
  theme: AppTheme;
  onPress?: () => void;
  disabled?: boolean;
  tone?: "accent" | "text";
  style?: StyleProp<ViewStyle>;
};

export function EventSlotOutlineButton({
  label,
  theme,
  onPress,
  disabled = false,
  tone = "accent",
  style
}: EventSlotOutlineButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, { borderColor: theme.colors.border, opacity: disabled ? 0.5 : 1 }, style]}
    >
      <Text style={[styles.text, { color: tone === "accent" ? theme.colors.accent : theme.colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11
  },
  text: {
    fontSize: 12,
    fontWeight: "900"
  }
});
