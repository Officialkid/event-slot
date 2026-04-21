export async function markFeatureUsed(featureName: string): Promise<void> {
  await fetch("/api/onboarding", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usedFeature: featureName }),
  }).catch(() => {})
}
