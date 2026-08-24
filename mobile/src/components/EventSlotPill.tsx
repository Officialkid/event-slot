import { StyleProp, StyleSheet, Text, TextStyle } from "react-native";

import { AppTheme } from "../theme";

type EventSlotPillProps = {
  label: string;
  theme: AppTheme;
  tone?: "accent" | "success" | "error" | "muted" | "text";
  size?: "xs" | "sm" | "md";
  background?: "active" | "elevated";
  style?: StyleProp<TextStyle>;
  fullWidth?: boolean;
};

export function EventSlotPill({
  label,
  theme,
  tone = "accent",
  size = "sm",
  background = "active",
  style,
  fullWidth = false
}: EventSlotPillProps) {
  const color =
    tone === "success"
      ? theme.colors.success
      : tone === "error"
        ? theme.colors.error
        : tone === "muted"
          ? theme.colors.muted
          : tone === "text"
            ? theme.colors.text
            : theme.colors.accent;

  const backgroundColor = background === "active" ? theme.colors.activeTab : theme.colors.elevated;

  return (
    <Text
      style={[
        styles.base,
        size === "xs" ? styles.xs : size === "md" ? styles.md : styles.sm,
        {
          alignSelf: fullWidth ? "stretch" : "flex-start",
          backgroundColor,
          color,
          textAlign: fullWidth ? "center" : "left"
        },
        style
      ]}
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 999,
    fontWeight: "900",
    overflow: "hidden"
  },
  xs: {
    fontSize: 10,
    letterSpacing: 1,
    paddingHorizontal: 9,
    paddingVertical: 5
  },
  sm: {
    fontSize: 11,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  md: {
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 7
  }
});
