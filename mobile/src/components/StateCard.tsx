import { StyleSheet, Text, View } from "react-native";

import { NativeUiStatePattern, NativeUiStateTone } from "../domain/uiStates";
import { AppTheme } from "../theme";
import { fontFamily, typeScale } from "../typography";

type StateCardProps = {
  state: NativeUiStatePattern;
  theme: AppTheme;
};

export function StateCard({ state, theme }: StateCardProps) {
  const tone = getToneStyle(state.tone, theme);

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: tone.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: tone.background }]}>
        <Text style={[styles.iconText, { color: tone.color }]}>{tone.icon}</Text>
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{state.title}</Text>
        <Text style={[styles.message, { color: theme.colors.secondary }]}>{state.message}</Text>
        <Text style={[styles.expectation, { color: theme.colors.muted }]}>{state.qaExpectation}</Text>
      </View>
      <Text style={[styles.action, { backgroundColor: theme.colors.activeTab, color: tone.color }]}>
        {state.actionLabel}
      </Text>
    </View>
  );
}

function getToneStyle(tone: NativeUiStateTone, theme: AppTheme) {
  if (tone === "success") {
    return { color: theme.colors.success, border: "rgba(34, 197, 94, 0.28)", background: "rgba(34, 197, 94, 0.12)", icon: "OK" };
  }

  if (tone === "error") {
    return { color: theme.colors.error, border: "rgba(255, 107, 107, 0.3)", background: "rgba(255, 107, 107, 0.12)", icon: "!" };
  }

  if (tone === "warning") {
    return { color: "#D68A00", border: "rgba(214, 138, 0, 0.3)", background: "rgba(214, 138, 0, 0.12)", icon: "?" };
  }

  if (tone === "loading") {
    return { color: theme.colors.accent, border: theme.colors.border, background: theme.colors.activeTab, icon: "..." };
  }

  return { color: theme.colors.muted, border: theme.colors.border, background: theme.colors.elevated, icon: "-" };
}

const styles = StyleSheet.create({
  action: {
    borderRadius: 999,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 7,
    textAlign: "center"
  },
  card: {
    alignItems: "center",
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    padding: 16
  },
  copy: {
    flex: 1,
    gap: 4,
    minWidth: 190
  },
  expectation: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    lineHeight: 18
  },
  iconText: {
    fontSize: 13,
    fontWeight: "900"
  },
  iconWrap: {
    alignItems: "center",
    borderRadius: 18,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  message: {
    ...typeScale.body
  },
  title: {
    ...typeScale.bodyStrong
  }
});
