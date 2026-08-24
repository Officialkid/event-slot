import { ReactNode } from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

import { AppTheme } from "../theme";
import { EventSlotOutlineButton } from "./EventSlotOutlineButton";
import { EventSlotPanel } from "./EventSlotPanel";

type EventSlotStatusCardProps = {
  label: string;
  theme: AppTheme;
  message: string;
  title?: string;
  meta?: string;
  tone?: "surface" | "hero" | "input";
  emphasis?: "accent" | "success" | "error";
  trailing?: ReactNode;
  actionLabel?: string;
  onActionPress?: () => void;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function EventSlotStatusCard({
  label,
  theme,
  message,
  title,
  meta,
  tone = "surface",
  emphasis = "accent",
  trailing,
  actionLabel,
  onActionPress,
  children,
  style
}: EventSlotStatusCardProps) {
  const emphasisColor =
    emphasis === "success" ? theme.colors.success : emphasis === "error" ? theme.colors.error : theme.colors.accent;

  return (
    <EventSlotPanel theme={theme} tone={tone} style={style}>
      <View style={styles.header}>
        <View style={styles.copy}>
          <Text style={[styles.label, { color: emphasisColor }]}>{label}</Text>
          {title ? <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text> : null}
        </View>
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>

      <Text style={[styles.message, { color: theme.colors.secondary }]}>{message}</Text>

      {meta ? <Text style={[styles.meta, { color: theme.colors.muted }]}>{meta}</Text> : null}

      {children ? <View style={styles.children}>{children}</View> : null}

      {actionLabel && onActionPress ? (
        <EventSlotOutlineButton label={actionLabel} theme={theme} onPress={onActionPress} style={styles.action} />
      ) : null}
    </EventSlotPanel>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between"
  },
  copy: {
    flex: 1,
    gap: 6
  },
  label: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.8
  },
  title: {
    fontSize: 17,
    fontWeight: "700"
  },
  trailing: {
    alignItems: "flex-end",
    justifyContent: "flex-start"
  },
  message: {
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10
  },
  meta: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8
  },
  children: {
    gap: 8,
    marginTop: 12
  },
  action: {
    marginTop: 14,
    minWidth: 120
  }
});
