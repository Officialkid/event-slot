import { Pressable, StyleSheet, Text, View } from "react-native";

import { EventSlotPanel } from "../components/EventSlotPanel";
import { EventSlotPill } from "../components/EventSlotPill";
import { eventSlotLogo } from "../brand";
import { AppTheme } from "../theme";
import { fontFamily } from "../typography";
import { Image } from "react-native";

type OnboardingScreenProps = {
  theme: AppTheme;
  stepIndex: number;
  onNext: () => void;
  onSkip: () => void;
  onFinish: () => void;
};

const onboardingSlides = [
  {
    title: "Create events with less friction.",
    body: "Set up event details, registration rules, links, maps, and attendee flow from one cleaner mobile workspace.",
    badge: "CREATE EVENTS"
  },
  {
    title: "Discover what matters faster.",
    body: "Jump into your dashboard, upcoming events, alerts, and activity without digging through cluttered screens.",
    badge: "DISCOVER EVENTS"
  },
  {
    title: "Register in seconds.",
    body: "Attendee flows are being shaped to stay simple, mobile-first, and easier to complete from any device.",
    badge: "REGISTER FAST"
  },
  {
    title: "Run QR check-in confidently.",
    body: "Verification, walk-in support, and event-day controls stay close at hand so teams can move people quickly.",
    badge: "QR CHECK-IN"
  },
  {
    title: "Understand events through analytics.",
    body: "Registrations, waitlists, exports, and organizer insights stay visible so EventSlot feels like one premium system.",
    badge: "ANALYTICS"
  }
] as const;

export function OnboardingScreen({ theme, stepIndex, onNext, onSkip, onFinish }: OnboardingScreenProps) {
  const slide = onboardingSlides[stepIndex];
  const isLast = stepIndex === onboardingSlides.length - 1;

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.page }]}>
      <EventSlotPanel theme={theme} style={styles.card}>
        <View style={styles.topRow}>
          <Image source={eventSlotLogo} style={styles.logo} resizeMode="contain" />
          <EventSlotPill label={slide.badge} theme={theme} />
        </View>

        <Text style={[styles.title, { color: theme.colors.text }]}>{slide.title}</Text>
        <Text style={[styles.body, { color: theme.colors.secondary }]}>{slide.body}</Text>

        <View style={styles.progressRow}>
          {onboardingSlides.map((item, index) => (
            <View
              key={item.badge}
              style={[
                styles.progressDot,
                {
                  backgroundColor: index === stepIndex ? theme.colors.accent : theme.colors.border,
                  opacity: index === stepIndex ? 1 : 0.6
                }
              ]}
            />
          ))}
        </View>

        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={onSkip} style={[styles.secondaryButton, { borderColor: theme.colors.border }]}>
            <Text style={[styles.secondaryText, { color: theme.colors.secondary }]}>Skip</Text>
          </Pressable>

          {isLast ? (
            <Pressable accessibilityRole="button" onPress={onFinish} style={[styles.primaryButton, { backgroundColor: theme.colors.accent }]}>
              <Text style={styles.primaryText}>Get started</Text>
            </Pressable>
          ) : (
            <Pressable accessibilityRole="button" onPress={onNext} style={[styles.primaryButton, { backgroundColor: theme.colors.accent }]}>
              <Text style={styles.primaryText}>Next</Text>
            </Pressable>
          )}
        </View>
      </EventSlotPanel>
    </View>
  );
}

export const onboardingSlideCount = onboardingSlides.length;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    padding: 20
  },
  card: {
    gap: 20,
    padding: 24
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  logo: {
    borderRadius: 14,
    height: 44,
    width: 44
  },
  title: {
    fontFamily: fontFamily.medium,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.6,
    lineHeight: 36
  },
  body: {
    fontFamily: fontFamily.body,
    fontSize: 16,
    lineHeight: 24
  },
  progressRow: {
    flexDirection: "row",
    gap: 8
  },
  progressDot: {
    borderRadius: 999,
    flex: 1,
    height: 6
  },
  actions: {
    flexDirection: "row",
    gap: 10
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 999,
    flex: 1,
    justifyContent: "center",
    minHeight: 54,
    paddingHorizontal: 18
  },
  primaryText: {
    color: "#0A0A0A",
    fontFamily: fontFamily.medium,
    fontSize: 15,
    fontWeight: "900"
  },
  secondaryButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 54,
    paddingHorizontal: 18
  },
  secondaryText: {
    fontFamily: fontFamily.medium,
    fontSize: 15,
    fontWeight: "900"
  }
});
