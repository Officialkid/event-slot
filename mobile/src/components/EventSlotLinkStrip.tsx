import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

import { AppTheme } from "../theme";
import { EventSlotOutlineButton } from "./EventSlotOutlineButton";

type EventSlotLinkStripAction = {
  key: string;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  tone?: "accent" | "text";
};

type EventSlotLinkStripProps = {
  theme: AppTheme;
  url: string;
  actions?: EventSlotLinkStripAction[];
  style?: StyleProp<ViewStyle>;
};

export function EventSlotLinkStrip({ theme, url, actions = [], style }: EventSlotLinkStripProps) {
  return (
    <View style={[styles.stack, style]}>
      <View style={[styles.linkRow, { backgroundColor: theme.colors.input, borderColor: theme.colors.border }]}>
        <Text style={[styles.linkValue, { color: theme.colors.secondary }]} numberOfLines={1}>
          {url}
        </Text>
      </View>
      {actions.length > 0 ? (
        <View style={styles.actionsRow}>
          {actions.map((action) => (
            <EventSlotOutlineButton
              key={action.key}
              label={action.label}
              theme={theme}
              onPress={action.onPress}
              disabled={action.disabled}
              tone={action.tone}
              style={styles.actionButton}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 10
  },
  linkRow: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  linkValue: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 9
  }
});
