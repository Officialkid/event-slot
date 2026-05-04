# EventSlot - Test Results

Test date: May 4, 2026
Tester: Local workspace audit + command validation
Scope: Current open-access model and report-download payment architecture

## Commands Executed
- npx tsc --noEmit -> PASS
- npm run test -- --runInBand -> PASS (4/4 suites)
- npm run lint -> PASS

## Current Snapshot
- Core feature model: Open access (no plan-tier gates)
- Paid action model: Report file download bundles only
- AI provider routing: Groq primary, OpenRouter fallback, Claude used in report path fallback chain

## Code-Verified Checks

### Access and Gating
- Pricing route behavior: PASS (redirect away from legacy pricing page)
- Dashboard sales UI removal: PASS (workspace-first layout retained)
- Insights page legacy upgrade wall: RESOLVED in code
- Team invite plan-gate messaging: RESOLVED in code

### Report Download Flow
- Free report preview endpoint path exists: PASS
- Paid report file download path exists: PASS
- Dedicated purchase endpoint exists: PASS
- Dedicated verification endpoint exists: PASS
- Report download wallet models exist in Prisma schema: PASS

### Stability and Quality
- TypeScript compile check: PASS
- Unit tests: PASS
- Lint status: PASS

## Requires Live Environment Verification

The following are not marked as failing, but require live keys/services and browser execution:
- Paystack purchase -> verify -> balance increment -> DOCX download end-to-end
- AI fallback behavior under real provider failures (Groq -> OpenRouter, report path fallback)
- Cloud Run smoke checks against deployed environment

## Notes
- This file supersedes earlier plan-tier and credits-gate assumptions from prior audit cycles.
- Use this as the active baseline for current product behavior.
