# Production Admin Audit - July 8, 2026

## Verified live on revision `eventslot-web-00158-jnj`

- Admin overview revenue block renders correctly in the sideways layout.
- Production overview shows:
  - `Estimated MRR: $0`
  - `Credit Revenue: $2,000`
- Platform Health no longer treats the stale duplicate Resend/code-path issues as active breakages.
- Platform Health still correctly reports the current external blocker:
  - `Sender domain eventsslot.com is not added in Resend.`
- Launch Checklist is live and currently shows `23/26 checks passed`.
- Current failing launch checks are environment/setup related:
  - `UPSTASH_REDIS_REST_URL` missing
  - `UPSTASH_REDIS_REST_TOKEN` missing

## Verified live product constraints

### Google Calendar

- The app-side flow already handles Google testing/access-blocked states.
- The blocker for all users is Google OAuth publication, not missing redirect/callback code.
- Until the OAuth consent screen is published or verified, only approved test users can connect.

### Payments

- Organizer payments page loads in production.
- End-to-end live payout has not been proven yet because the tested account had no withdrawable balance.
- `/api/admin/test/payments` in production still reports missing seeded test fixtures, so payment test tooling is not fully usable in prod yet.

### Countries

- Production countries page currently shows:
  - `112 total users`
  - `1 tracked user`
  - `111 unknown users`
  - `1% coverage`
- Country capture exists for signed-in users, but older users still require backfill and/or new sessions.

### Users admin

- Production `Users` page currently exposes only:
  - `All`
  - `Free`
- The production table currently renders visible plan values as `FREE`, which means higher plan visibility/management is not yet represented accurately in the live admin UI.

### Org Feedback admin

- Production `Org Feedback` currently renders only assistant-rating summary cards.
- It does not currently expose the organizer feedback inbox items already returned by the admin feedback API.

### Messages admin

- Production `Messages` currently uses the label `Announcements (4)` for `ADMIN_BROADCAST` records.
- Live content confirms that at least one of those records is actually bulk email HTML content, not a clean public announcement.
- This means the current production admin still conflates:
  - public announcements
  - email broadcasts
  - message-style admin surfaces

## Local code fixes already present

## Local verification status

- `npx tsc --noEmit` passes
- `npm test -- --runInBand` passes
- `npm run build` passes
- Targeted regression coverage added for the signed-in country capture route
- Jest status:
  - `15` test suites passed
  - `112` tests passed

### Admin access consistency

- Older admin APIs that only trusted the email whitelist were normalized around shared access logic.
- Super-admin role-based access is now handled more consistently across admin routes.

### Reports

- Event/admin report generation includes payment/commercial sections in preview and document output.
- This fixes the earlier complaint that report output did not include payments/newer format sections.
- Stakeholder-report monetisation narrative no longer claims unimplemented premium features are already live.

### Countries admin

- Country backfill now supports:
  - existing user country fields
  - consistent organizer event country
  - consistent attendee registration country matched by email
- Signed-in country capture no longer falls back to `US` on detection failure.
- Failed country detection also no longer overwrites a previously known user country with `UNKNOWN`.
- Countries admin copy was updated to match the actual backfill behavior.

### Comms / Broadcast / Messages separation

- Public comms feed now filters to announcement-style records instead of leaking bulk email broadcast HTML into the comms board.
- Admin messages view now distinguishes:
  - announcements
  - email broadcasts
  - user feedback / platform message surfaces

### Conversations / sidebar freshness

- Admin sidebar flagged conversation badge now refreshes instead of only fetching once.
- Conversations/admin text cleanup was also applied.

### Users admin

- Admin users page now reflects actual plan values instead of flattening everything to `free`.
- Plan management supports:
  - `free`
  - `standard`
  - `pro`
  - `business`
- Invalid plan writes are rejected server-side.

### System updates parser hardening

- Admin updates parser now tolerates:
  - real em dash
  - mojibake dash
  - plain hyphen
- This prevents the System Updates surface from going stale if changelog header encoding varies.

### Health and payments UI cleanup

- Platform Health now renders stale entries with a clean `Historical` label instead of broken mojibake text.
- Organizer payments UI now uses clean separators and fallback text in event summaries and transaction rows.
- Admin payment-test UI now has clearer unavailable-state messaging when seeded test fixtures are missing, plus cleaned status/copy separators.

## EMB / embed / unused-or-not-yet-realized surfaces

The strongest match for `EMB` in the current repository is the embed/widget and adjacent premium-branding surface.

### Documented or implied, but not implemented

- Event embed widget for external sites
- `eventslot-widget` script/snippet flow
- `widget.js` public asset / hosted embed entrypoint
- Custom domain per event or organizer
- Branded event pages / custom branding implementation
- SMS campaigns
- Priority support surface

### Evidence

- Roadmap/docs promise embed and branding capabilities.
- Older plan/config language suggested custom-domain capability existed.
- `lib/plans.ts` now sets `canUseCustomDomain: false` to match the actual current implementation state.
- `lib/plans.ts` now sets `canRemoveBranding: false` to match the absence of organizer-controlled branding removal.
- Subscription and one-time pass copy no longer advertises custom branding, custom domains, or recurring events as if they are currently available.
- Older stakeholder-report copy previously described branding-related premium features as already live; this has now been corrected locally.
- No real implementation was found in `app/`, `components/`, `lib/`, or `public/` for:
  - `widget.js`
  - `eventslot-widget`
  - actual custom-domain routing/serving
  - organizer-controlled page branding

## AI provider reality

- Current provider chain is:
  - `groq`
  - `openrouter`
  - optional `claude` fallback
- Anthropic/Claude is not the primary provider path.
- No `AnthroDrop` integration exists in the repo today.
- Supporting `AnthroDrop` would require a new provider adapter rather than a config flip.

## Still requires deployment or external setup

### Needs deployment

- Admin messages separation improvements
- Org feedback page improvements
- Users plan visibility/management fixes
- System updates parser hardening
- Countries capture/data-quality safeguards
- Platform Health label cleanup
- Organizer payments and payment-test UI copy cleanup
- Any local admin copy/UX cleanup not yet visible in production

### Needs external setup

- Finish Resend domain/DNS connection after Cloudflare-authenticated Domain Connect approval
- Publish or verify Google OAuth consent screen for all-user Google Calendar access
- Add missing Upstash Redis environment variables if required for production readiness
- Run/observe country backfill and allow returning users to refresh country capture
