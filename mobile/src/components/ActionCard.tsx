import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppTheme } from "../theme";
import { fontFamily, typeScale } from "../typography";

type ActionCardProps = {
  title: string;
  caption: string;
  action: string;
  theme: AppTheme;
  onPress?: () => void;
};

export function ActionCard({ title, caption, action, theme, onPress }: ActionCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
    >
      <View style={styles.copy}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
        <Text style={[styles.caption, { color: theme.colors.secondary }]}>{caption}</Text>
      </View>
      <View style={[styles.pill, { backgroundColor: theme.colors.accent }]}>
        <Text style={styles.pillText}>{action}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 18,
    padding: 18
  },
  copy: {
    gap: 8
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: 22,
    fontWeight: "400"
  },
  caption: {
    ...typeScale.body
  },
  pill: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  pillText: {
    color: "#0A0A0A",
    fontSize: 13,
    fontWeight: "900"
  }
});
