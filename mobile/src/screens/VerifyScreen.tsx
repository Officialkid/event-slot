import { StyleSheet, Text, TextInput, View } from "react-native";

import { AppTheme } from "../theme";

type ScreenProps = {
  theme: AppTheme;
};

export function VerifyScreen({ theme }: ScreenProps) {
  return (
    <View style={styles.stack}>
      <Text style={[styles.heading, { color: theme.colors.text }]}>Verify Tickets</Text>
      <Text style={[styles.subcopy, { color: theme.colors.secondary }]}>
        Native verification will support camera scanning, manual ticket lookup, and verifier access codes.
      </Text>

      <View style={[styles.scanCard, { backgroundColor: theme.colors.hero, borderColor: theme.colors.border }]}>
        <Text style={[styles.scanIcon, { color: theme.colors.accent }]}>SCAN</Text>
        <Text style={[styles.scanTitle, { color: theme.colors.text }]}>Camera scanner placeholder</Text>
        <Text style={[styles.scanText, { color: theme.colors.secondary }]}>
          The next milestone adds camera permissions and QR parsing without affecting the web verifier.
        </Text>
      </View>

      <View style={[styles.lookupCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.label, { color: theme.colors.muted }]}>MANUAL LOOKUP</Text>
        <TextInput
          placeholder="Enter ticket code"
          placeholderTextColor={theme.colors.muted}
          style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.input }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 14
  },
  heading: {
    fontSize: 32,
    fontWeight: "900"
  },
  subcopy: {
    fontSize: 15,
    lineHeight: 23
  },
  scanCard: {
    alignItems: "center",
    borderRadius: 28,
    borderWidth: 1,
    gap: 12,
    padding: 26
  },
  scanIcon: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 2.4
  },
  scanTitle: {
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center"
  },
  scanText: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center"
  },
  lookupCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 18
  },
  label: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2
  },
  input: {
    borderRadius: 18,
    borderWidth: 1,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14
  }
});

