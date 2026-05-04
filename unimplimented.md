# Unimplemented / Not Working Audit

Date: 2026-05-04
Scope: Ordered remediation run completed from this workspace.

## Status
All code and docs items from the previous audit were addressed in order.

## Completed Fixes

1. Lint blocker fixed in report download modal
- File: `components/ReportDownloadModal.tsx`
- Change: Replaced location mutation (`window.location.href = ...`) with `window.location.assign(...)`.
- Result: Lint now passes.

2. Legacy Insights upgrade gate removed
- File: `app/(organizer)/dashboard/insights/page.tsx`
- Change: Removed `upgradeRequired` gate and `ComingSoon` fallback path.
- Result: Page now aligns with open-access model.

3. Legacy billing unlock endpoint deprecated
- File: `app/api/billing/unlock/route.ts`
- Change: Replaced old feature-unlock logic with explicit deprecated response (`410`, `ENDPOINT_DEPRECATED`).
- Result: Route no longer suggests active plan-gated unlock semantics.

4. Stale plan-era lint warnings cleaned
- Files:
	- `app/(organizer)/dashboard/events/[slug]/page.tsx`
	- `app/(organizer)/dashboard/team/page.tsx`
	- `app/api/events/route.ts`
	- `lib/plans.ts`
- Change: Removed unused plan leftovers and cleaned unused setters/imports/vars.
- Result: No warnings from the previous audit remain.

5. Documentation refresh completed
- Files:
	- `docs/TEST_RESULTS.md`
	- `docs/FEATURES.md`
- Change: Replaced outdated plan-gated assumptions and legacy matrices with current open-access + paid-report-download model.

## Verification Commands (Post-Fix)
- `npx tsc --noEmit` -> PASS
- `npm run lint` -> PASS
- `npm run test -- --runInBand` -> PASS (4/4 suites)

## Remaining Manual Runtime Verification
These are not confirmed broken, but need live environment execution (API keys/deployed services):

1. Paystack flow end-to-end
- Purchase -> verify -> download balance increment -> DOCX download.

2. AI provider fallback behavior under live provider failure
- Groq -> OpenRouter fallback, and report path fallback chain behavior.

3. Cloud Run smoke tests against deployed environment
- Needs deployment target, runtime env vars, and reachable service URL.

