import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from "react-native";

import { AppTheme } from "../theme";
import { EventSlotPanel } from "./EventSlotPanel";
import { EventSlotSectionHeading } from "./EventSlotSectionHeading";

type EventSlotMessageCardProps = {
  title: string;
  caption: string;
  theme: AppTheme;
  actionLabel?: string;
  onActionPress?: () => void;
  tone?: "surface" | "hero" | "input";
  style?: StyleProp<ViewStyle>;
};

export function EventSlotMessageCard({
  title,
  caption,
  theme,
  actionLabel,
  onActionPress,
  tone = "surface",
  style
}: EventSlotMessageCardProps) {
  return (
    <EventSlotPanel theme={theme} tone={tone} style={[styles.card, style]}>
      <EventSlotSectionHeading title={title} caption={caption} theme={theme} />
      {actionLabel && onActionPress ? (
        <Pressable accessibilityRole="button" onPress={onActionPress}>
          <Text style={[styles.action, { color: theme.colors.accent }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </EventSlotPanel>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 6
  },
  action: {
    fontSize: 12,
    fontWeight: "800"
  }
});
