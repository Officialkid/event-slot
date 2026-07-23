import { StyleSheet, Text, View } from "react-native";

import { AppTheme } from "../theme";

type MetricCardProps = {
  label: string;
  value: string;
  trend: string;
  theme: AppTheme;
};

export function MetricCard({ label, value, trend, theme }: MetricCardProps) {
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <Text style={[styles.label, { color: theme.colors.muted }]}>{label}</Text>
      <Text style={[styles.value, { color: theme.colors.text }]}>{value}</Text>
      <Text style={[styles.trend, { color: theme.colors.accent }]}>{trend}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    minWidth: "47%",
    padding: 16
  },
  label: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.8,
    textTransform: "uppercase"
  },
  value: {
    fontSize: 28,
    fontWeight: "900"
  },
  trend: {
    fontSize: 12,
    fontWeight: "800"
  }
});

