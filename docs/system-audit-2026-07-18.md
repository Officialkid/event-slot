# EventSlot System Audit - July 18, 2026

This note tracks the current state of the ongoing EventSlot revamp work, with a focus on what is now live, what has been implemented locally and deployed, and what still needs follow-through.

## Verified live on Saturday, July 18, 2026

- Public homepage no longer shows the old payment-marketing wording.
- `/signin` and `/signup` include the Google Terms and Privacy consent wording.
- Billing purchase endpoints are paused behind the current coming-soon flow.
- Event dashboard export area now uses the clearer export wording:
  - `Export CSV data`
  - `Export PDF responses`
  - `Prepare AI report export`
- Light mode on the signed-in dashboard is materially improved:
  - sidebar labels are readable
  - install prompt text is readable
  - profile page content is readable
  - insights page cards and metrics are readable

## Implemented and deployed in this pass

### Theme and UI clarity

- Replaced several hardcoded lime-on-light dashboard shell colors with theme-aware accent colors.
- Updated shared dashboard surface classes to respect light-theme text and border tokens.
- Improved table header, table row hover, and progress bar contrast in shared global styles.
- Updated the EventSlot wordmark in the dashboard shell to use the active theme accent instead of a fixed bright lime.

### Report/export wording

- Support/assistant guidance now points organisers to the Export centre and `Prepare AI report export` instead of the older `Generate Report` wording.
- AI report CTA text in the assistant route now matches the deployed event dashboard wording.

## Build and deployment evidence

- `npx tsc --noEmit` passed on July 18, 2026.
- `npm run build` passed on July 18, 2026.
- Cloud Build deploy `7f4a2bfc-4089-4c38-b7d6-353733e8dec4` completed successfully on July 18, 2026.

## Still not fully closed

### SMTP rollout

- SMTP code paths and deployment config exist.
- Production SMTP is still not proven complete until the required `SMTP_*` secrets are present in GCP and a real send flow is verified.
- Waitlist promotion email verification remains dependent on that production SMTP completion.

### Full signed-in audit

- The platform still needs a broader page-by-page signed-in audit covering:
  - admin pages
  - team invitation and scoped event visibility
  - account deletion flows
  - event creation and editing
  - registration draft restore by email
  - ticket verification flows

### Scale and resilience

- The system has not yet been proven for `100,000+` registrations in a week.
- That still requires a dedicated load test covering:
  - registration submit
  - draft save and resume
  - event page reads
  - waitlist promotion
  - email queue behavior
  - database indexes
  - middleware and rate limiting

## Recommended next focus

1. Complete production SMTP secret setup and verify real outbound email.
2. Run a structured signed-in audit of admin, organizer, and team-member flows.
3. Prepare a dedicated load-test plan and execute it against the highest-risk registration paths.
