# EventSlot System Audit

Date: 2026-07-15
Scope: registration-link simplicity, public form UX, attendee email continuity, waitlist promotion flow, volunteer-slot limits, payment visibility, and light/dark mode readiness.

## Objective Tracker

1. Objective: Keep one-time pass and paid-event flows small and non-bulky.
   Expected outcome: users first see a short decision card with simple next actions, not a large payment block.
   Status: done for the main attendee-facing pass and paid-event states.
   Evidence:
   - `components/billing/EventPassSelector.tsx`
   - `app/(attendee)/[username]/RegistrationForm.tsx`
   - `components/billing/BillingPausedNotice.tsx`

2. Objective: Make organizer/public layouts spread content better instead of clustering on one side.
   Expected outcome: key cards and actions fill space more evenly on mobile and desktop.
   Status: partially done and improved in the highest-traffic surfaces.
   Evidence:
   - `app/(organizer)/dashboard/events/[slug]/page.tsx`
   - `app/(attendee)/[username]/RegistrationForm.tsx`

3. Objective: Let attendees save progress with email and return later.
   Expected outcome: reopening the same link restores unfinished progress for the same email.
   Status: done.
   Evidence:
   - `app/(attendee)/[username]/RegistrationForm.tsx`
   - `app/api/register/draft/route.ts`
   - `prisma/schema.prisma`

4. Objective: Let attendees receive a copy of their responses by email.
   Expected outcome: attendee can opt in and receives their submitted answers by email.
   Status: done.
   Evidence:
   - `app/(attendee)/[username]/RegistrationForm.tsx`
   - `app/api/register/route.ts`
   - `lib/email.ts`

5. Objective: Notify waitlisted attendees when they are promoted.
   Expected outcome: promoted attendee gets an email telling them they now have a spot and can proceed to their ticket flow.
   Status: done for the free waitlist-promotion path.
   Evidence:
   - `app/api/registrations/[registrationId]/route.ts`
   - `lib/email.ts`

6. Objective: Support limited slots for volunteer/service-position options.
   Expected outcome: organizer can set per-option limits such as Media 10, Protocol 50, Service 100 and the system enforces them.
   Status: done.
   Evidence:
   - `app/(organizer)/create/page.tsx`
   - `app/(organizer)/edit/[slug]/page.tsx`
   - `lib/registrationQuestionOptions.ts`
   - `app/api/register/route.ts`

7. Objective: Keep payment tools hidden until launch.
   Expected outcome: organizers see a simple coming-soon / working-on-it state instead of usable payment tools.
   Status: mostly done for dashboard entry points; broader payment-adjacent surfaces still need final consistency checks.
   Evidence:
   - `app/(organizer)/dashboard/payments/page.tsx`
   - `app/(organizer)/dashboard/billing/page.tsx`
   - `app/(organizer)/dashboard/_shell.tsx`
   - `components/billing/PaymentMaintenanceBanner.tsx`

8. Objective: Provide dark and light theme options across the whole system, with dark as default and a sun/moon icon at the top.
   Expected outcome: both public and organizer shells default to dark, expose a top-of-screen sun/moon toggle, and render correctly in light mode.
   Status: partially done; toggles and many core surfaces are complete, but full-system light-mode coverage is still not complete.
   Evidence:
   - `components/Nav.tsx`
   - `app/(organizer)/dashboard/_shell.tsx`
   - `app/layout.tsx`
   - `app/globals.css`

## Completed in this round

- One-time event pass UI is now collapsible and starts in a much smaller state for compact flows.
  Evidence:
  - `components/billing/EventPassSelector.tsx`

- Public registration form now supports attendee email-based draft save and resume.
  Evidence:
  - `app/(attendee)/[username]/RegistrationForm.tsx`
  - `app/api/register/draft/route.ts`
  - `prisma/schema.prisma`

- Attendees can request an emailed copy of their submitted responses.
  Evidence:
  - `app/(attendee)/[username]/RegistrationForm.tsx`
  - `app/api/register/route.ts`
  - `lib/email.ts`

- Waitlist-promotion emails now carry ticket-download flow information from the free waitlist promotion path.
  Evidence:
  - `app/api/registrations/[registrationId]/route.ts`
  - `lib/email.ts`

- Organizers can define per-option slot limits for select and checkbox questions.
  Evidence:
  - `app/(organizer)/create/page.tsx`
  - `app/(organizer)/edit/[slug]/page.tsx`
  - `app/api/register/route.ts`
  - `app/api/registrations/[registrationId]/route.ts`
  - `lib/registrationQuestionOptions.ts`

- The organizer event create/edit registration-question builders now use theme-aware styling in their main question cards, option-limit inputs, multi-select/required toggles, add-question controls, and adjacent poster/helper surfaces.
  Evidence:
  - `app/(organizer)/create/page.tsx`
  - `app/(organizer)/edit/[slug]/page.tsx`

- Shared global theme tokens now define the previously referenced `surface-2`, `surface-muted`, and `border-subtle` variables so light/dark styling resolves consistently across surfaces that already consume those tokens.
  Evidence:
  - `app/globals.css`

- The organizer event create flow now uses theme-aware styling in its first-screen heading, rollout notice, template cards, event-type chooser, primary event-details card, virtual-meeting helper/input surfaces, lower scheduling/contact fields, capacity guidance, paid-tier shell, and post-create success state.
  Evidence:
  - `app/(organizer)/create/page.tsx`

- The organizer event edit flow now uses theme-aware styling in its loading shell, error shell, heading, save-state banner, paid-tier shell, and main event-details card inputs.
  Evidence:
  - `app/(organizer)/edit/[slug]/page.tsx`

- Public paid-event messaging is now shorter and less bulky.
  Evidence:
  - `app/(attendee)/[username]/RegistrationForm.tsx`

- The paid-event notice inside the public registration form now uses a smaller maintenance state with shorter copy so payment messaging does not dominate the attendee flow.
  Evidence:
  - `app/(attendee)/[username]/RegistrationForm.tsx`
  - `lib/billingNotice.ts`

- The compact one-time pass selector now starts in a smaller, decision-first state with a single recommended pass summary plus `Continue` and `Learn more` actions instead of exposing the full pricing stack immediately.
  Evidence:
  - `components/billing/EventPassSelector.tsx`

- The organizer event-detail header and registration-link actions now spread more naturally on mobile, with the primary report/share/link actions filling width more evenly instead of clustering to one side.
  Evidence:
  - `app/(organizer)/dashboard/events/[slug]/page.tsx`

- A persisted dark/light mode toggle now exists for marketing navigation, with early hydration before first paint.
  Evidence:
  - `app/globals.css`
  - `app/layout.tsx`
  - `components/Nav.tsx`

- A persisted dark/light mode toggle now also exists in the authenticated organizer dashboard shell, with shell chrome following theme tokens.
  Evidence:
  - `app/(organizer)/dashboard/_shell.tsx`
  - `lib/themeClient.ts`
  - `components/Nav.tsx`

- The organizer dashboard overview, billing page, and payments page now use theme-aware text and surface styling in their highest-visibility sections.
  Evidence:
  - `app/(organizer)/dashboard/page.tsx`
  - `app/(organizer)/dashboard/billing/page.tsx`
  - `app/(organizer)/dashboard/payments/page.tsx`

- Organizer notifications and profile pages now use theme-aware styling in their highest-visibility surfaces and controls.
  Evidence:
  - `app/(organizer)/dashboard/notifications/page.tsx`
  - `app/(organizer)/dashboard/profile/page.tsx`

- Organizer team management now uses theme-aware styling in its main list views, invite flow, loading states, and access/removal modals.
  Evidence:
  - `app/(organizer)/dashboard/team/page.tsx`

- Organizer insights and the report-download upsell modal now use theme-aware styling in their main shells, charts/cards, and modal chrome.
  Evidence:
  - `app/(organizer)/dashboard/insights/page.tsx`
  - `components/ReportDownloadModal.tsx`

- Organizer community surfaces now use theme-aware styling in badges, invite/referral cards, leaderboard tabs, podium rows, and empty states.
  Evidence:
  - `app/(organizer)/dashboard/community/page.tsx`

- Scanner entry, manual verification, ticket settings, and attendee confirmation ticket surfaces now use theme-aware styling in their main cards and controls.
  Evidence:
  - `components/scanner/ScannerHome.tsx`
  - `components/scanner/ManualTicketVerifier.tsx`
  - `components/tickets/TicketSettingsCard.tsx`
  - `components/tickets/ConfirmationTicket.tsx`

- Live scanner experiences now use theme-aware styling in the quick-scan and deep-scan camera, upload, and manual-lookup views.
  Evidence:
  - `components/scanner/QuickScan.tsx`
  - `components/scanner/DeepScan.tsx`

- The organizer event-detail page now uses theme-aware styling in its top-level shells, header actions, analytics/reporting tab, manual-registration flow, feedback/team tabs, registration table chrome, QR modal, waitlist tools, walk-in analytics, and event-AI Q&A surfaces.
  Evidence:
  - `app/(organizer)/dashboard/events/[slug]/page.tsx`

- The organizer event-detail page now also uses theme-aware styling in additional event-settings, walk-in overview, duplicate-scan, capacity, waitlist-intelligence, recent-registration sections, and report-preview surfaces.
  Evidence:
  - `app/(organizer)/dashboard/events/[slug]/page.tsx`

- Draft-save and volunteer option-limit flows now have basic automated route coverage.
  Evidence:
  - `__tests__/api/register-draft.test.ts`
  - `__tests__/api/register-option-limits.test.ts`

- Response-copy delivery and registration-edit option-limit rejection now have focused automated route coverage.
  Evidence:
  - `__tests__/api/register-response-copy.test.ts`
  - `__tests__/api/registration-edit-option-limits.test.ts`

- The public registration form now uses theme-aware surface styling in key attendee-facing cards.
  Evidence:
  - `app/(attendee)/[username]/RegistrationForm.tsx`

- Public-form saved-progress restore, clear-draft behavior, and light-theme shell rendering now have focused UI coverage.
  Evidence:
  - `__tests__/components/RegistrationForm.test.tsx`

- The compact one-time pass selector now has focused UI coverage for its collapsed first view and on-demand expansion path.
  Evidence:
  - `__tests__/components/EventPassSelector.test.tsx`

- Payment-maintenance messaging is now centralized across paid-event registration, subscriptions, PAYG, and one-time passes.
  Evidence:
  - `lib/billingNotice.ts`
  - `components/billing/BillingPausedNotice.tsx`
  - `app/(attendee)/[username]/RegistrationForm.tsx`
  - `components/billing/EventPassSelector.tsx`
  - `components/billing/SubscriptionCheckoutPage.tsx`
  - `components/billing/PaygSettingsCard.tsx`

- The public registration form now uses cleaner attendee section cards and wider layout spacing to better match the requested simpler form style.
  Evidence:
  - `app/(attendee)/[username]/RegistrationForm.tsx`

- The attendee confirmation, waitlist, and duplicate-check states now use shorter, clearer copy in the main public registration flow.
  Evidence:
  - `app/(attendee)/[username]/RegistrationForm.tsx`

- The attendee draft-save and response-copy surfaces now use clearer visual cues, and the duplicate-check modal now uses calmer theme-aware styling inside the public registration flow.
  Evidence:
  - `app/(attendee)/[username]/RegistrationForm.tsx`

- The attendee-facing registration shell is now slightly wider, uses cleaner preview/image framing, and has simpler saved-progress/supporting copy around the core form flow.
  Evidence:
  - `app/(attendee)/[username]/RegistrationForm.tsx`

- The public registration form now has stronger label-to-field associations across attendee questions and key attendee-facing toggles.
  Evidence:
  - `app/(attendee)/[username]/RegistrationForm.tsx`

- Shared organizer billing surfaces now use theme-aware styling in the subscription checkout flow, report-download purchase card, and payment-maintenance banner.
  Evidence:
  - `components/billing/SubscriptionCheckoutPage.tsx`
  - `components/billing/ReportDownloadsCard.tsx`
  - `components/billing/PaymentMaintenanceBanner.tsx`

- Additional billing widgets now use theme-aware styling in the pricing selector, event-pass selector, and M-Pesa payment modal.
  Evidence:
  - `components/billing/PricingPlanSelector.tsx`
  - `components/billing/EventPassSelector.tsx`
  - `components/billing/MpesaPaymentModal.tsx`

- Shared billing-launch messaging now uses theme-aware styling in the reusable coming-soon banner used across billing/admin surfaces.
  Evidence:
  - `components/billing/BillingComingSoonBanner.tsx`

- Password-recovery auth flows now use theme-aware surfaces and inputs in the forgot-password and reset-password screens.
  Evidence:
  - `app/(auth)/forgot-password/page.tsx`
  - `app/(auth)/reset-password/page.tsx`

- The main sign-in and sign-up auth screens now also use theme-aware shells, inputs, dividers, helper copy, and consent surfaces.
  Evidence:
  - `app/(auth)/signin/page.tsx`
  - `app/(auth)/signup/page.tsx`

- The public event/profile shell now uses theme-aware styling in closed-state cards, FAQ framing, organizer profile cards, and event-card listings.
  Evidence:
  - `app/[username]/page.tsx`

- Shared attendee/public chrome now uses theme-aware styling in the public event top bar, marketing footer, attendee registration lookup card, and reusable coming-soon panel.
  Evidence:
  - `components/events/PublicEventTopBar.tsx`
  - `components/MarketingFooter.tsx`
  - `components/attendance/ConfirmAttendance.tsx`
  - `components/ui/ComingSoon.tsx`

- Additional attendee/public helper flows now use theme-aware styling in the public walk-in event shell, virtual-event join gate, and organiser contact-preview editor.
  Evidence:
  - `components/events/PublicWalkInEventPage.tsx`
  - `components/JoinEventButton.tsx`
  - `components/events/EventWhatsAppInput.tsx`

- The walk-in attendee journey now also uses theme-aware styling inside the actual check-in form, success card, share actions, and quick-return helpers.
  Evidence:
  - `components/events/WalkInCheckinForm.tsx`

- The public event invitation hero, FAQ accordion, and floating organiser-contact action now also follow the same theme-aware attendee/event styling.
  Evidence:
  - `components/events/EventInvitationCard.tsx`
  - `components/events/EventFAQDisplay.tsx`
  - `components/events/WhatsAppFloatingButton.tsx`

- Nearby event helper/editor widgets now also use theme-aware styling in the FAQ editor, calendar-add helper, Google Calendar connection card, and mobile install prompt.
  Evidence:
  - `components/events/EventFAQEditor.tsx`
  - `components/AddToCalendarButton.tsx`
  - `components/GoogleCalendarConnect.tsx`
  - `components/MobileInstallButton.tsx`

## Verified constraints and current behavior

- TypeScript compiles successfully with increased Node memory.
  Evidence:
  - `node --max-old-space-size=4096 .\node_modules\typescript\bin\tsc --noEmit`

- Prisma schema is valid and client generation succeeds.
  Evidence:
  - `npx prisma generate`

- Focused automated coverage now passes for draft save/resume/delete and limited-option registration rejection.
  Evidence:
  - `npx jest __tests__/api/register-draft.test.ts __tests__/api/register-option-limits.test.ts --runInBand`

- Focused automated coverage now also passes for response-copy dispatch and registration-edit limited-option rejection.
  Evidence:
  - `npx jest __tests__/api/register-response-copy.test.ts __tests__/api/registration-edit-option-limits.test.ts --runInBand`

- Focused component coverage now passes for public-form draft restore, clear-draft flow, and light-theme shell rendering.
  Evidence:
  - `npx jest __tests__/components/RegistrationForm.test.tsx __tests__/components/ConfirmAttendance.test.tsx --runInBand`

- Focused attendee-lookup coverage still passes after the latest theme-aware cleanup of the registration lookup card.
  Evidence:
  - `npx jest __tests__/components/ConfirmAttendance.test.tsx --runInBand`

- Focused public-form coverage still passes after the latest attendee-shell simplification pass.
  Evidence:
  - `npx jest __tests__/components/RegistrationForm.test.tsx --runInBand`

- Focused public-form coverage still passes after the latest attendee success, waitlist, and duplicate-check copy simplification.
  Evidence:
  - `npx jest __tests__/components/RegistrationForm.test.tsx --runInBand`

- Focused public-form coverage still passes after the latest draft-save, response-copy, and duplicate-check surface polish.
  Evidence:
  - `npx jest __tests__/components/RegistrationForm.test.tsx --runInBand`

- Focused public-form coverage still passes after the latest paid-event notice simplification in the attendee flow.
  Evidence:
  - `npx jest __tests__/components/RegistrationForm.test.tsx --runInBand`

- Focused one-time pass coverage now passes for the new compact summary-first flow.
  Evidence:
  - `npx jest __tests__/components/EventPassSelector.test.tsx --runInBand`

- Public-form UI coverage now also verifies confirmed-success and waitlist-success attendee outcomes, including waitlist follow-up email capture.
  Evidence:
  - `npx jest __tests__/components/RegistrationForm.test.tsx --runInBand`

- Public-form coverage now uses label-based field queries for attendee question submission paths, confirming those associations work in practice.
  Evidence:
  - `npx jest __tests__/components/RegistrationForm.test.tsx --runInBand`

- Public-form coverage now verifies multi-attendee draft restoration and re-save behavior, including attendee count and preserved attendee emails.
  Evidence:
  - `npx jest __tests__/components/RegistrationForm.test.tsx --runInBand`

- Public-form coverage now verifies draft payload updates when attendees are added and removed after restore.
  Evidence:
  - `npx jest __tests__/components/RegistrationForm.test.tsx --runInBand`

- Payment collection is still intentionally blocked in the attendee registration form.
  Evidence:
  - `app/(attendee)/[username]/RegistrationForm.tsx`
  - copy includes `Paid-event checkout is temporarily unavailable.`

- A fresh TypeScript verification attempt is currently blocked by missing generated `.next/dev/types` files referenced by `tsconfig.json`, rather than by a confirmed type error in the edited public/theme files.
  Evidence:
  - `node --max-old-space-size=4096 .\node_modules\typescript\bin\tsc --noEmit`
  - current failure references missing files under `.next/dev/types/**/*.ts`

- Focused hardcoded-color and mojibake cleanup checks now pass for the latest public walk-in, join, and attendee-helper surfaces touched in this round.
  Evidence:
  - `rg -n "#141414|#F0EDE6|rgba\\(240,237,230|#2A2A2A|#A3A3A3|â|Â|ðŸ" components/events/PublicWalkInEventPage.tsx components/events/EventWhatsAppInput.tsx components/JoinEventButton.tsx`

- Focused hardcoded-color and mojibake cleanup checks now also pass for the rewritten walk-in check-in detail experience.
  Evidence:
  - `rg -n "#141414|#F0EDE6|rgba\\(240,237,230|#2A2A2A|#A3A3A3|â|Â|ðŸ" components/events/WalkInCheckinForm.tsx`

- Focused hardcoded-color and mojibake cleanup checks now also pass for the remaining public event invitation/help widgets touched in the latest pass.
  Evidence:
  - `rg -n "#141414|#F0EDE6|rgba\\(240,237,230|#2A2A2A|#A3A3A3|â|Â|ðŸ" components/events/EventInvitationCard.tsx components/events/EventFAQDisplay.tsx components/events/WhatsAppFloatingButton.tsx`

- Focused hardcoded-color and mojibake cleanup checks now also pass for the latest event-side helper/editor widgets touched in the current pass.
  Evidence:
  - `rg -n "#141414|#F0EDE6|rgba\\(240,237,230|#2A2A2A|#A3A3A3|â|Â|ðŸ" components/events/EventFAQEditor.tsx components/AddToCalendarButton.tsx components/GoogleCalendarConnect.tsx components/MobileInstallButton.tsx`

## Remaining gaps

### 1. Full light mode is not yet complete

Status: not complete

Why:
- The app now has theme tokens, early hydration, and a navigation toggle, but most UI surfaces still use hardcoded dark inline colors instead of shared variables.
- A search for dark-specific hardcoded values still returns a large footprint.

Evidence:
- `app/globals.css` defines both themes, but many components still bypass tokens.
- `app/layout.tsx` hydrates the initial theme before paint.
- `components/Nav.tsx` provides a persisted public-navigation toggle.
- `app/(organizer)/dashboard/_shell.tsx` provides a persisted organizer-dashboard toggle.
- `app/(organizer)/create/page.tsx` now follows theme tokens in its heading, rollout notice, template picker, event-type chooser, event-details shell, poster card, registration-question builder, walk-in fallback card, lower scheduling/contact fields, capacity guidance, and post-create success state, but a few selected/active paid-state accents and some older helper strings still remain.
- `app/(organizer)/edit/[slug]/page.tsx` now follows theme tokens in its loading/error states, heading, save banner, event-details shell, paid-tier shell, poster card, and registration-question builder, but a few selected/active paid-state accents and some older helper strings still remain.
- `app/(organizer)/dashboard/page.tsx`, `billing/page.tsx`, and `payments/page.tsx` now partially follow theme tokens in core surfaces.
- `app/(organizer)/dashboard/notifications/page.tsx`, `profile/page.tsx`, `team/page.tsx`, `insights/page.tsx`, and `community/page.tsx` now partially follow theme tokens in high-traffic organizer flows.
- `app/(organizer)/dashboard/events/[slug]/page.tsx` now follows theme tokens across nearly all first-screen organizer flows plus analytics/reporting, manual-registration, feedback, team, waitlist, walk-in analytics, event AI/Q&A, and several event-settings/reporting sections, but a few secondary detail surfaces and older related pages still need conversion.
- `app/(auth)/signin/page.tsx`, `app/(auth)/signup/page.tsx`, `app/(auth)/forgot-password/page.tsx`, and `app/(auth)/reset-password/page.tsx` now follow theme tokens in their primary shells and form inputs, while older related auth helpers and secondary widgets may still need conversion.
- `app/[username]/page.tsx`, `components/events/PublicEventTopBar.tsx`, `components/MarketingFooter.tsx`, `components/attendance/ConfirmAttendance.tsx`, `components/ui/ComingSoon.tsx`, `components/events/PublicWalkInEventPage.tsx`, `components/events/WalkInCheckinForm.tsx`, `components/JoinEventButton.tsx`, `components/events/EventWhatsAppInput.tsx`, `components/events/EventInvitationCard.tsx`, `components/events/EventFAQDisplay.tsx`, `components/events/WhatsAppFloatingButton.tsx`, `components/events/EventFAQEditor.tsx`, `components/AddToCalendarButton.tsx`, `components/GoogleCalendarConnect.tsx`, and `components/MobileInstallButton.tsx` now follow theme tokens in their primary public-facing and adjacent event-helper surfaces, while older shared widgets and deeper dashboard/admin surfaces still need conversion.
- `components/scanner/ScannerHome.tsx`, `components/scanner/ManualTicketVerifier.tsx`, `components/scanner/QuickScan.tsx`, `components/scanner/DeepScan.tsx`, `components/tickets/TicketSettingsCard.tsx`, and `components/tickets/ConfirmationTicket.tsx` now follow theme tokens in their primary surfaces, while older related pages and less-used widgets still need conversion.
- Hardcoded dark color usage remains widespread across `app` and `components`.

Recommendation:
1. Replace high-traffic hardcoded inline colors with CSS variables in shared components first.
2. Finish the organizer event-create and event-edit flows so the question-builder polish is matched by the surrounding setup cards and helper panels.
3. Continue converting deeper dashboard views, remaining shared widgets outside the public event/attendee journey, secondary auth/helpers/widgets, and remaining billing/admin surfaces in that order.
4. Move remaining direct `#0A0A0A`, `#141414`, and `#F0EDE6` usage behind theme tokens.

### 2. Draft-save and volunteer-limit features do not yet have complete automated coverage

Status: substantially complete

Why:
- Route coverage now exists for:
  - draft load/save/delete
  - volunteer option-capacity rejection
  - response-copy email trigger
  - registration edit rejection when a limited option is full
- UI coverage now exists for:
  - public-form draft restoration behavior
  - clear-draft behavior
  - light-theme public-form shell rendering
  - confirmed-success rendering
  - waitlist-success rendering with follow-up email capture
- multi-attendee draft restore and re-save behavior
- draft payload updates after attendee add/remove editing
- Coverage is still missing for:
  - broader end-to-end interaction coverage beyond the current focused public-form scenarios

Evidence:
- `__tests__/api/register-draft.test.ts`
- `__tests__/api/register-option-limits.test.ts`
- `__tests__/api/register-response-copy.test.ts`
- `__tests__/api/registration-edit-option-limits.test.ts`
- `__tests__/components/RegistrationForm.test.tsx`

Recommendation:
1. Extend accessibility-oriented coverage to the remaining custom-styled consent controls and any other attendee-field edge cases.
2. Continue polishing any remaining attendee-facing copy/encoding rough edges in the success and draft-status messages outside the main registration shell.

### 3. Light-mode groundwork exists, but there is no user-facing toggle yet

Status: complete for public navigation and organizer dashboard shell, incomplete for full product-wide accessibility

Evidence:
- `app/layout.tsx` hydrates theme before paint.
- `components/Nav.tsx` exposes a persisted toggle.
- `app/(organizer)/dashboard/_shell.tsx` exposes the same persisted toggle inside authenticated organizer flows.
- `lib/themeClient.ts` centralizes theme application logic for both surfaces.

Recommendation:
1. Continue replacing hardcoded dark styles inside organizer dashboard pages so the toggle affects page content as strongly as the shell.
2. Prioritize older payments/reporting detail surfaces, attendee-facing public pages, and any leftover event-detail edge surfaces next.
3. Reuse the same shared theme setter anywhere else a separate app shell exists, including admin if needed.

### 4. Payment availability messaging is still distributed across multiple surfaces

Status: materially improved, but not yet fully normalized everywhere

Why:
- A shared billing-paused notice now covers:
  - paid-event registration
  - event-pass checkout
  - subscription checkout
  - PAYG overflow billing
- Some older payment-adjacent surfaces outside these main flows may still carry custom wording or hardcoded dark styling.

Evidence:
- `lib/billingNotice.ts`
- `components/billing/BillingPausedNotice.tsx`
- `components/billing/EventPassSelector.tsx`
- `components/billing/SubscriptionCheckoutPage.tsx`
- `components/billing/PaygSettingsCard.tsx`
- `app/(attendee)/[username]/RegistrationForm.tsx`
- `components/billing/ReportDownloadsCard.tsx`
- `components/billing/PaymentMaintenanceBanner.tsx`

Recommendation:
1. Reuse the same helper on any remaining payment-adjacent screens that still contain one-off launch-preview copy.
2. Keep any future maintenance wording anchored to the same shared helper.
3. Continue replacing any remaining hardcoded dark styling in less-used billing widgets as they surface.

### 5. Public-form styling is improved, but it is not yet fully Google-Forms-like

Status: partially addressed

Why:
- Footer, clear form, response-copy option, draft email, and attendee section cards are now closer to the requested pattern.
- The overall form shell is now wider and calmer, but it still retains EventSlot's visual language rather than fully matching a Google Forms flow.
- The organizer-side question setup is also cleaner now, especially around option chips and per-option volunteer-slot inputs, but the surrounding event-create flow still needs the same simplification pass.
- The one-time pass chooser is now much smaller on first view, but the expanded purchase state still keeps more product and billing language than a true Google-Forms-style minimalist flow.

Recommendation:
1. Move question sections onto lighter, individually separated cards when light mode is implemented.
2. Simplify spacing and reduce decorative chrome around the registration shell.
3. Standardize question spacing and help text for mobile-first readability.

## Suggested next priorities

1. Convert more public and dashboard surfaces from hardcoded dark inline colors to theme tokens.
   Current momentum is best in attendee-facing public-form polish plus leftover payments/reporting detail widgets next.
2. Add submit-success and multi-attendee UI coverage for the public form.
3. Centralize payment launch/maintenance messaging.
4. Continue reducing hardcoded dark inline styles across public and dashboard pages.
