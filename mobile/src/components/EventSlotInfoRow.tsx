import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppTheme } from "../theme";

type EventSlotInfoRowProps = {
  title: string;
  subtitle: string;
  theme: AppTheme;
  rightSlot?: ReactNode;
  bordered?: boolean;
};

export function EventSlotInfoRow({ title, subtitle, theme, rightSlot, bordered = true }: EventSlotInfoRowProps) {
  return (
    <View style={[styles.row, bordered && { borderTopColor: theme.colors.border, borderTopWidth: 1 }]}>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: theme.colors.secondary }]}>{subtitle}</Text>
      </View>
      {rightSlot}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingVertical: 14
  },
  copy: {
    flex: 1,
    gap: 4
  },
  title: {
    fontSize: 15,
    fontWeight: "900"
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19
  }
});
