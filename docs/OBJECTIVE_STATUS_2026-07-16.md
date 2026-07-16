# EventSlot Objective Status

Last updated: 2026-07-16

| Objective | Expected outcome | Status |
| --- | --- | --- |
| Hide payment functionality for now | Users should see “coming soon / working on this” instead of usable payment setup. | Improved. Dashboard-wide billing banner removed. Billing/payment pages remain informational. Legacy credit/report purchase endpoints now return coming-soon responses while checkout is disabled. |
| Remove confusing super-admin payment banner | Super admin should not see billing restriction messaging on normal dashboard pages. | Improved. The global dashboard shell no longer injects the billing launch banner. |
| Keep free event creation simple | Organizers should not be pushed into paid setup while creating a normal event. | Mostly done. Payment maintenance notices remain where needed, and paid checkout APIs are disabled. Needs final signed-in UI check. |
| Light/dark theme | Theme choice should work across the system, not only the landing page. | In progress. Several dashboard/report/email surfaces have been converted to theme tokens. Needs page-by-page visual audit. |
| Google sign-in terms/privacy consent | Users signing in with Google should agree to terms and privacy policy. | Implemented locally and previously deployed, but should be rechecked live after the latest deploy. |
| SMTP email service | Move away from Resend-only dependency and document SMTP setup. | Partially done. SMTP docs and env examples exist. Production still needs SMTP secrets and Cloud Run env wiring before switching fully. |
| Registration draft by email | Attendee email should save/restore unfinished form progress. | Implemented. Draft API stores progress by event plus email. Needs live browser confirmation on a real event. |
| Waitlist promotion email | Promoted waitlisted attendee should receive a congratulations email and proceed to ticket. | Implemented in flow, but production verification depends on working SMTP/email configuration. |
| Reports free for organizers | Authorized organizers/team/admins should generate/download reports without payment. | Implemented and deployed. Report purchase UI/routes are now guarded during payment pause. |
| Team member event access | Invited team member should only see assigned event. | Implemented in access logic. Needs live test with an invited account. |
| Account deletion | Super admin and users should be able to delete test/user accounts safely. | Improved with cleanup. Needs live super-admin deletion test. |
| Verify-ticket workflow documentation | Document current scanner/search/upload behavior and future verifier subdomain idea. | Done in `docs/VERIFY_TICKET_WORKFLOW.md`. |
| 100,000 registrations/week readiness | Do not claim capacity until load tested. | In progress. A load-test plan and guarded helper script now exist. Actual staging/prod-safe load run still required. |
