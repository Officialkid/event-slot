import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { EventSlotField } from "../components/EventSlotField";
import { EventSlotMessageCard } from "../components/EventSlotMessageCard";
import { EventSlotPageHeader } from "../components/EventSlotPageHeader";
import { EventSlotPanel } from "../components/EventSlotPanel";
import { NativeBillingSnapshot } from "../domain/billing";
import { loadNativeBillingSnapshot, pollNativePlanUpgradeStatus, startNativePlanUpgrade } from "../services/billing";
import { fontFamily, typeScale } from "../typography";
import { NativeScreenProps } from "./types";

type BillingScreenProps = NativeScreenProps;

export function BillingScreen({ navigate, session, theme }: BillingScreenProps) {
  const [snapshot, setSnapshot] = useState<NativeBillingSnapshot | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState("standard");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "polling" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [pollAttempt, setPollAttempt] = useState(0);

  useEffect(() => {
    loadNativeBillingSnapshot(session)
      .then((nextSnapshot) => {
        setSnapshot(nextSnapshot);
        const recommendedPlan = nextSnapshot.availablePlans.find((plan) => plan.featured)?.id ?? nextSnapshot.availablePlans[0]?.id ?? "standard";
        setSelectedPlanId(recommendedPlan);
      })
      .catch(() => {
        setMessage("Billing could not be loaded right now.");
        setStatus("error");
      });
  }, [session]);

  const selectedPlan = useMemo(
    () => snapshot?.availablePlans.find((plan) => plan.id === selectedPlanId) ?? null,
    [selectedPlanId, snapshot]
  );

  useEffect(() => {
    if (status !== "polling" || !snapshot?.lastPayment || snapshot.lastPayment.status !== "pending") {
      return;
    }

    const timer = setTimeout(() => {
      pollNativePlanUpgradeStatus(snapshot, snapshot.lastPayment!.id)
        .then((nextSnapshot) => {
          setSnapshot(nextSnapshot);
          setPollAttempt(nextSnapshot.lastPayment?.pollCount ?? 0);

          if (nextSnapshot.lastPayment?.status === "completed") {
            setStatus("success");
            setMessage(`${nextSnapshot.currentPlan} is now active on this device preview.`);
            return;
          }

          setMessage(
            `Waiting for M-Pesa confirmation on ${nextSnapshot.lastPayment?.phone}. Polling status every 3 seconds. Attempt ${Math.max(
              nextSnapshot.lastPayment?.pollCount ?? 0,
              1
            )}.`
          );
        })
        .catch((error: unknown) => {
          setStatus("error");
          setMessage(error instanceof Error ? error.message : "The payment status could not be confirmed.");
        });
    }, 3000);

    return () => clearTimeout(timer);
  }, [snapshot, status]);

  const handleUpgrade = () => {
    if (!snapshot || !selectedPlan) {
      return;
    }

    setStatus("sending");
    setPollAttempt(0);
    setMessage(`Sending an M-Pesa prompt for ${selectedPlan.priceLabel}. Check your phone.`);

    setTimeout(() => {
      startNativePlanUpgrade(snapshot, selectedPlan.id, phone)
        .then((nextSnapshot) => {
          setSnapshot(nextSnapshot);
          if (nextSnapshot.lastPayment?.status === "pending") {
            setStatus("polling");
            setMessage(`STK push sent to ${phone.trim()}. Polling payment status every 3 seconds.`);
            return;
          }

          setStatus("success");
          setMessage(`${nextSnapshot.currentPlan} is now active on this device preview.`);
        })
        .catch((error: unknown) => {
          setStatus("error");
          setMessage(error instanceof Error ? error.message : "The payment prompt could not be started.");
        });
    }, 900);
  };

  if (!snapshot) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.page, padding: 16 }}>
        <EventSlotMessageCard
          title="Loading billing"
          caption="Preparing your current plan, payment preview, and upgrade options."
          theme={theme}
          tone="hero"
        />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
      <EventSlotPageHeader
        theme={theme}
        title="Billing and plan"
        caption="Plan state, recent payment details, and upgrade preview for EventSlot mobile."
        backLabel="Back to profile"
        onBackPress={() => navigate({ name: "profile" })}
      />

      <EventSlotPanel theme={theme} tone="hero" style={styles.currentPlanCard}>
        <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>CURRENT PLAN</Text>
        <Text style={[styles.planName, { color: theme.colors.text }]}>{snapshot.currentPlan}</Text>
        <Text style={[styles.caption, { color: theme.colors.secondary }]}>
          {snapshot.billingCycleLabel} | Renewal {snapshot.renewalDateLabel}
        </Text>
        <View style={styles.metricRow}>
          <MetricChip label="Wallet balance" value={`${session.tokenBalance.toLocaleString()} tokens`} theme={theme} />
          <MetricChip label="PAYG" value={snapshot.paygEnabled ? "Enabled" : "Disabled"} theme={theme} />
        </View>
      </EventSlotPanel>

      <EventSlotPanel theme={theme} style={styles.panel}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Upgrade with M-Pesa</Text>
        <Text style={[styles.caption, { color: theme.colors.secondary }]}>
          This native flow now stages the STK push, keeps the plan pending while status checks run every 3 seconds, and only activates the upgrade after confirmation.
        </Text>

        <View style={styles.planGrid}>
          {snapshot.availablePlans.map((plan) => {
            const selected = selectedPlanId === plan.id;
            return (
              <Pressable
                key={plan.id}
                accessibilityRole="button"
                onPress={() => setSelectedPlanId(plan.id)}
                style={[
                  styles.planCard,
                  {
                    backgroundColor: selected ? theme.colors.hero : theme.colors.input,
                    borderColor: selected ? theme.colors.accent : theme.colors.border
                  }
                ]}
              >
                <Text style={[styles.planCardTitle, { color: theme.colors.text }]}>{plan.name}</Text>
                <Text style={[styles.planPrice, { color: theme.colors.accent }]}>{plan.priceLabel}</Text>
                <Text style={[styles.planMeta, { color: theme.colors.secondary }]}>{plan.insightQuotaLabel}</Text>
                <Text style={[styles.planMeta, { color: theme.colors.secondary }]}>{plan.attendeeCapLabel}</Text>
                <Text style={[styles.planMeta, { color: theme.colors.secondary }]}>{plan.payoutWindowLabel}</Text>
              </Pressable>
            );
          })}
        </View>

        <EventSlotField
          label="M-Pesa number"
          value={phone}
          onChangeText={setPhone}
          placeholder="07xx xxx xxx"
          theme={theme}
          keyboardType="phone-pad"
          helperText="The live version will trigger an STK push and poll payment status every few seconds."
        />

        {message ? (
          <EventSlotMessageCard
            title={
              status === "success"
                ? "Payment completed"
                : status === "error"
                  ? "Payment issue"
                  : status === "polling"
                    ? "Check your phone"
                    : "Payment pending"
            }
            caption={message}
            theme={theme}
            tone={status === "success" ? "hero" : "surface"}
          />
        ) : null}

        {status === "polling" ? (
          <Text style={[styles.pollingNote, { color: theme.colors.secondary }]}>
            Status poll {Math.max(pollAttempt, 1)} is in progress. This preview checks every 3 seconds until payment is confirmed.
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={handleUpgrade}
          style={[styles.primaryButton, { backgroundColor: theme.colors.accent, opacity: status === "sending" || status === "polling" ? 0.7 : 1 }]}
        >
          <Text style={styles.primaryButtonText}>
            {status === "sending"
              ? "Sending STK push..."
              : status === "polling"
                ? "Waiting for phone confirmation..."
                : `Send STK push${selectedPlan ? ` - ${selectedPlan.priceLabel}` : ""}`}
          </Text>
        </Pressable>

        {status === "error" ? (
          <Pressable accessibilityRole="button" onPress={handleUpgrade} style={[styles.secondaryButton, { borderColor: theme.colors.border }]}>
            <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>Retry payment prompt</Text>
          </Pressable>
        ) : null}
      </EventSlotPanel>

      <EventSlotPanel theme={theme} style={styles.panel}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Last payment</Text>
        {snapshot.lastPayment ? (
          <View style={styles.paymentCard}>
            <Text style={[styles.paymentAmount, { color: theme.colors.text }]}>{snapshot.lastPayment.amountLabel}</Text>
            <Text style={[styles.caption, { color: theme.colors.secondary }]}>
              {snapshot.lastPayment.planName} plan | {snapshot.lastPayment.paidAtLabel}
            </Text>
            <Text style={[styles.caption, { color: theme.colors.secondary }]}>Paid from {snapshot.lastPayment.phone}</Text>
            <Text style={[styles.caption, { color: theme.colors.secondary }]}>
              {snapshot.lastPayment.paymentReference} | {snapshot.lastPayment.status === "completed" ? "Completed" : "Awaiting confirmation"}
            </Text>
          </View>
        ) : (
          <EventSlotMessageCard
            title="No paid plan yet"
            caption="The free plan is active. Your first successful STK push will appear here."
            theme={theme}
          />
        )}
      </EventSlotPanel>

      <EventSlotPanel theme={theme} style={styles.panel}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>PAYG controls</Text>
        <Text style={[styles.caption, { color: theme.colors.secondary }]}>
          Cap monitoring, warning thresholds, and automatic pause controls are available in the dedicated PAYG settings screen.
        </Text>
        <Pressable accessibilityRole="button" onPress={() => navigate({ name: "payg" })} style={[styles.secondaryButton, { borderColor: theme.colors.border }]}>
          <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>Open PAYG settings</Text>
        </Pressable>
      </EventSlotPanel>
    </ScrollView>
  );
}

function MetricChip({ label, value, theme }: { label: string; value: string; theme: BillingScreenProps["theme"] }) {
  return (
    <View style={[styles.metricChip, { backgroundColor: theme.colors.input, borderColor: theme.colors.border }]}>
      <Text style={[styles.metricLabel, { color: theme.colors.muted }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: theme.colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: 16,
    padding: 16,
    paddingBottom: 40
  },
  currentPlanCard: {
    gap: 10
  },
  eyebrow: {
    ...typeScale.label
  },
  planName: {
    ...typeScale.pageTitle
  },
  caption: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 20
  },
  metricRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  metricChip: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    minWidth: 150,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.3
  },
  metricValue: {
    fontSize: 14,
    fontWeight: "700"
  },
  panel: {
    gap: 14
  },
  sectionTitle: {
    ...typeScale.sectionTitle
  },
  planGrid: {
    gap: 12
  },
  planCard: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 6,
    padding: 16
  },
  planCardTitle: {
    ...typeScale.bodyStrong
  },
  planPrice: {
    fontFamily: fontFamily.medium,
    fontSize: 22,
    fontWeight: "900"
  },
  planMeta: {
    fontSize: 13,
    lineHeight: 18
  },
  pollingNote: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 19
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 18,
    paddingVertical: 15
  },
  primaryButtonText: {
    color: "#0A0A0A",
    fontFamily: fontFamily.medium,
    fontSize: 14,
    fontWeight: "900"
  },
  paymentCard: {
    gap: 6
  },
  paymentAmount: {
    ...typeScale.bodyStrong
  },
  secondaryButton: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 15
  },
  secondaryButtonText: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    fontWeight: "900"
  }
});
