import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

import { AppTheme } from "../theme";

type EventSlotChoiceCardProps = {
  title: string;
  caption: string;
  icon?: string;
  active: boolean;
  theme: AppTheme;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export function EventSlotChoiceCard({ title, caption, icon, active, theme, onPress, style }: EventSlotChoiceCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: active ? theme.colors.activeTab : theme.colors.input,
          borderColor: active ? theme.colors.accent : theme.colors.border
        },
        style
      ]}
    >
      <View style={styles.copy}>
        {icon ? <Text style={styles.icon}>{icon}</Text> : null}
        <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
        <Text style={[styles.caption, { color: theme.colors.secondary }]}>{caption}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    padding: 16
  },
  copy: {
    gap: 6
  },
  icon: {
    fontSize: 24,
    lineHeight: 28
  },
  title: {
    fontSize: 18,
    fontWeight: "700"
  },
  caption: {
    fontSize: 13,
    lineHeight: 20
  }
});
