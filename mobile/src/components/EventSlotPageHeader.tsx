import { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppTheme } from "../theme";
import { fontFamily, typeScale } from "../typography";

type EventSlotPageHeaderProps = {
  theme: AppTheme;
  title: string;
  caption?: string;
  eyebrow?: string;
  backLabel?: string;
  onBackPress?: () => void;
  actionLabel?: string;
  onActionPress?: () => void;
  trailingSlot?: ReactNode;
};

export function EventSlotPageHeader({
  theme,
  title,
  caption,
  eyebrow,
  backLabel,
  onBackPress,
  actionLabel,
  onActionPress,
  trailingSlot
}: EventSlotPageHeaderProps) {
  return (
    <View style={styles.wrap}>
      {backLabel && onBackPress ? (
        <Pressable accessibilityRole="button" onPress={onBackPress}>
          <Text style={[styles.backLink, { color: theme.colors.secondary }]}>{backLabel}</Text>
        </Pressable>
      ) : null}

      <View style={styles.headerRow}>
        <View style={styles.copy}>
          {eyebrow ? <Text style={[styles.eyebrow, { color: theme.colors.secondary }]}>{eyebrow}</Text> : null}
          <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
          {caption ? <Text style={[styles.caption, { color: theme.colors.secondary }]}>{caption}</Text> : null}
        </View>

        {trailingSlot ? trailingSlot : null}

        {actionLabel && onActionPress ? (
          <Pressable
            accessibilityRole="button"
            onPress={onActionPress}
            style={[styles.actionButton, { backgroundColor: theme.colors.accent }]}
          >
            <Text style={styles.actionText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 14
  },
  backLink: {
    fontSize: 13,
    fontWeight: "700"
  },
  headerRow: {
    alignItems: "flex-start",
    gap: 14
  },
  copy: {
    gap: 8
  },
  eyebrow: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    fontWeight: "700"
  },
  title: {
    ...typeScale.pageTitle
  },
  caption: {
    ...typeScale.body
  },
  actionButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 16,
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 14
  },
  actionText: {
    color: "#0A0A0A",
    fontFamily: fontFamily.medium,
    fontSize: 15,
    fontWeight: "900"
  }
});
