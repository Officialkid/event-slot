import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";

import { eventSlotLogo } from "../brand";
import { AppTheme } from "../theme";
import { fontFamily } from "../typography";

type SplashScreenProps = {
  theme: AppTheme;
};

export function SplashScreen({ theme }: SplashScreenProps) {
  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.page }]}>
      <View style={[styles.glow, { backgroundColor: theme.colors.accentSoft }]} />
      <View style={[styles.card, { backgroundColor: theme.colors.hero, borderColor: theme.colors.border }]}>
        <View style={styles.brandLockup}>
          <Image source={eventSlotLogo} style={styles.logo} resizeMode="contain" />
          <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>EVENTSLOT</Text>
        </View>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Event<Text style={{ color: theme.colors.accent }}>Slot</Text>
        </Text>
        <Text style={[styles.tagline, { color: theme.colors.secondary }]}>Smarter Events. Better Experiences.</Text>
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="small" color={theme.colors.accent} />
        </View>
        <Text style={[styles.version, { color: theme.colors.muted }]}>Version 1.2.1</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    overflow: "hidden",
    padding: 24
  },
  glow: {
    borderRadius: 999,
    height: 220,
    opacity: 0.65,
    position: "absolute",
    width: 220
  },
  card: {
    alignItems: "center",
    borderRadius: 32,
    borderWidth: 1,
    gap: 14,
    maxWidth: 560,
    paddingHorizontal: 28,
    paddingVertical: 32,
    width: "100%"
  },
  brandLockup: {
    alignItems: "center",
    gap: 10
  },
  logo: {
    borderRadius: 24,
    height: 88,
    width: 88
  },
  eyebrow: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2.8
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: 34,
    fontWeight: "400"
  },
  tagline: {
    fontFamily: fontFamily.body,
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center"
  },
  loaderWrap: {
    paddingTop: 4
  },
  version: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2
  }
});
