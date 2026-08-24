import { ReactNode } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

type EventSlotMetricGridProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function EventSlotMetricGrid({ children, style }: EventSlotMetricGridProps) {
  return <View style={[styles.grid, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  }
});
