import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppTheme } from "../theme";

type EventSlotTabItem<T extends string> = {
  key: T;
  label: string;
  count?: number;
};

type EventSlotTabsProps<T extends string> = {
  items: Array<EventSlotTabItem<T>>;
  activeKey: T;
  onSelect: (key: T) => void;
  theme: AppTheme;
};

export function EventSlotTabs<T extends string>({ items, activeKey, onSelect, theme }: EventSlotTabsProps<T>) {
  return (
    <View style={[styles.wrap, { borderBottomColor: theme.colors.border }]}>
      {items.map((item) => {
        const active = item.key === activeKey;

        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            key={item.key}
            onPress={() => onSelect(item.key)}
            style={[styles.tabButton, active && { borderBottomColor: theme.colors.accent }]}
          >
            <Text style={[styles.tabLabel, { color: active ? theme.colors.text : theme.colors.secondary }]}>
              {item.label}
            </Text>
            {item.count && item.count > 0 ? (
              <Text
                style={[
                  styles.tabCount,
                  {
                    backgroundColor: active ? theme.colors.activeTab : theme.colors.elevated,
                    color: active ? theme.colors.accent : theme.colors.secondary
                  }
                ]}
              >
                {item.count}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    flexWrap: "wrap"
  },
  tabButton: {
    alignItems: "center",
    borderBottomColor: "transparent",
    borderBottomWidth: 2,
    flexDirection: "row",
    gap: 6,
    marginBottom: -1,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: "500"
  },
  tabCount: {
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 2
  }
});
