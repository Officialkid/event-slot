import { StyleSheet, Text, View } from "react-native";

import { AppTheme } from "../theme";
import { fontFamily, typeScale } from "../typography";

type MetricCardProps = {
  label: string;
  value: string;
  trend: string;
  theme: AppTheme;
  valueWeight?: "400" | "700";
  valueSize?: number;
  trendSize?: number;
};

export function MetricCard({ label, value, trend, theme, valueWeight = "700", valueSize = 30, trendSize = 11 }: MetricCardProps) {
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <Text style={[styles.label, { color: theme.colors.muted }]}>{label}</Text>
      <Text style={[styles.value, { color: theme.colors.text, fontSize: valueSize, fontWeight: valueWeight, fontFamily: fontFamily.display }]}>{value}</Text>
      <Text style={[styles.trend, { color: theme.colors.secondary, fontSize: trendSize }]}>{trend}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    minWidth: "47%",
    padding: 16
  },
  label: {
    ...typeScale.label,
    textTransform: "uppercase"
  },
  value: {
    fontSize: 30,
    fontWeight: "700"
  },
  trend: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    fontWeight: "600"
  }
});
