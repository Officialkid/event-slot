import { ReactNode } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

import { AppTheme } from "../theme";

type EventSlotPanelProps = {
  children: ReactNode;
  theme: AppTheme;
  tone?: "surface" | "hero" | "input";
  style?: StyleProp<ViewStyle>;
};

export function EventSlotPanel({ children, theme, tone = "surface", style }: EventSlotPanelProps) {
  const backgroundColor =
    tone === "hero" ? theme.colors.hero : tone === "input" ? theme.colors.input : theme.colors.surface;

  return <View style={[styles.panel, { backgroundColor, borderColor: theme.colors.border }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18
  }
});
