import { ReactNode } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

import { AppTheme } from "../theme";

type EventSlotInsetCardProps = {
  theme: AppTheme;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function EventSlotInsetCard({ theme, children, style }: EventSlotInsetCardProps) {
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.input, borderColor: theme.colors.border }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14
  }
});
