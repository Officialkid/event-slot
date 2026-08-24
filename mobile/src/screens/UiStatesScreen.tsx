import { StyleSheet, View } from "react-native";

import { StateCard } from "../components/StateCard";
import { EventSlotPageHeader } from "../components/EventSlotPageHeader";
import { nativeUiStatePatterns } from "../services/uiStates";
import { NativeScreenProps } from "./types";

export function UiStatesScreen({ theme }: NativeScreenProps) {
  return (
    <View style={styles.stack}>
      <EventSlotPageHeader
        theme={theme}
        title="App states"
        caption="Review the 10 reusable EventSlot mobile states for empty, loading, error, network, permission, validation, session, and success flows."
      />
      <View style={styles.list}>
        {nativeUiStatePatterns.map((state) => (
          <StateCard key={state.key} state={state} theme={theme} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 14
  },
  list: {
    gap: 12
  }
});
