import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppTheme } from "../theme";

type EventSlotOption<T extends string> = {
  label: string;
  value: T;
};

type EventSlotSegmentedOptionsProps<T extends string> = {
  label: string;
  options: Array<EventSlotOption<T>>;
  selected: T;
  onSelect: (value: T) => void;
  theme: AppTheme;
};

export function EventSlotSegmentedOptions<T extends string>({
  label,
  options,
  selected,
  onSelect,
  theme
}: EventSlotSegmentedOptionsProps<T>) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.colors.muted }]}>{label.toUpperCase()}</Text>
      <View style={styles.optionRow}>
        {options.map((option) => {
          const active = option.value === selected;
          return (
            <Pressable
              accessibilityRole="button"
              key={option.value}
              onPress={() => onSelect(option.value)}
              style={[
                styles.optionButton,
                {
                  backgroundColor: active ? theme.colors.activeTab : theme.colors.input,
                  borderColor: active ? theme.colors.accent : theme.colors.border
                }
              ]}
            >
              <Text style={[styles.optionText, { color: active ? theme.colors.accent : theme.colors.secondary }]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 8
  },
  label: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.8
  },
  optionRow: {
    flexDirection: "row",
    gap: 10
  },
  optionButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 13
  },
  optionText: {
    fontSize: 13,
    fontWeight: "900"
  }
});
