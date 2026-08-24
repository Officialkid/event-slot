import { StyleSheet, Text, View } from "react-native";

import { AppTheme } from "../theme";

type EventSlotSectionHeadingProps = {
  title: string;
  caption?: string;
  theme: AppTheme;
};

export function EventSlotSectionHeading({ title, caption, theme }: EventSlotSectionHeadingProps) {
  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
      {caption ? <Text style={[styles.caption, { color: theme.colors.secondary }]}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 4,
    marginBottom: 12
  },
  title: {
    fontSize: 20,
    fontWeight: "900"
  },
  caption: {
    fontSize: 13,
    lineHeight: 19
  }
});
