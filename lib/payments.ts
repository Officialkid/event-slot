// ── Payments feature flag ─────────────────────────────────────────────────────
// Flip PAYMENTS_ENABLED=true in .env (and GCP Secret Manager) when Paystack
// integration is ready to go live.  Until then all purchase UI shows
// "Coming Soon" and no charges are processed.
export const PAYMENTS_ENABLED =
  process.env.PAYMENTS_ENABLED === "true"
