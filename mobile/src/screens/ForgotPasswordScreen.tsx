import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { EventSlotPanel } from "../components/EventSlotPanel";
import { requestPasswordReset } from "../services/auth";
import { AppTheme } from "../theme";
import { fontFamily, typeScale } from "../typography";

type ForgotPasswordScreenProps = {
  theme: AppTheme;
};

export function ForgotPasswordScreen({ theme }: ForgotPasswordScreenProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setStatus("Enter your email address so EventSlot can send the reset link.");
      return;
    }

    setSubmitting(true);
    setStatus(null);

    try {
      await requestPasswordReset({ email: trimmedEmail });
      setStatus("If that email is on EventSlot, a reset link has been sent.");
    } catch {
      setStatus("If that email is on EventSlot, a reset link has been sent.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.screen, { backgroundColor: theme.colors.page }]}
    >
      <View style={styles.content}>
        <EventSlotPanel theme={theme} style={styles.panel}>
          <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>ACCOUNT RECOVERY</Text>
          <Text style={[styles.title, { color: theme.colors.text }]}>Send a password reset link.</Text>
          <Text style={[styles.body, { color: theme.colors.secondary }]}>
            Enter the email you use for EventSlot. For security, the app shows the same confirmation message whether or not the account exists.
          </Text>
          <Text style={[styles.label, { color: theme.colors.muted }]}>EMAIL ADDRESS</Text>
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="you@eventsslot.com"
            placeholderTextColor={theme.colors.muted}
            style={[styles.input, { backgroundColor: theme.colors.input, borderColor: theme.colors.border, color: theme.colors.text }]}
            value={email}
          />
          <Pressable
            accessibilityRole="button"
            disabled={submitting}
            onPress={handleSubmit}
            style={[styles.button, { backgroundColor: theme.colors.accent, opacity: submitting ? 0.65 : 1 }]}
          >
            <Text style={styles.buttonText}>{submitting ? "Sending link..." : "Send reset link"}</Text>
          </Pressable>
          <Text style={[styles.helper, { color: theme.colors.muted }]}>
            Reset links expire after one hour.
          </Text>
          {status ? <Text style={[styles.status, { color: theme.colors.secondary }]}>{status}</Text> : null}
        </EventSlotPanel>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1
  },
  content: {
    flex: 1,
    justifyContent: "center",
    padding: 20
  },
  panel: {
    gap: 14
  },
  eyebrow: {
    ...typeScale.label
  },
  title: {
    ...typeScale.sectionTitle
  },
  body: {
    ...typeScale.body
  },
  label: {
    ...typeScale.label
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    fontFamily: fontFamily.body,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  button: {
    alignItems: "center",
    borderRadius: 16,
    paddingVertical: 14
  },
  buttonText: {
    color: "#0A0A0A",
    fontSize: 14,
    fontWeight: "900"
  },
  helper: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    lineHeight: 18
  },
  status: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 19
  }
});
