# EventSlot Pricing Implementation Checklist

Last updated: June 18, 2026

This checklist turns the pricing and monetisation draft into concrete product work. Status values:

- `Done`: already present in product/codebase
- `Partial`: started or represented, but not complete end to end
- `Todo`: not yet implemented or not yet verified

## 1. Subscription foundation

- [x] `Done` Four plan structure exists: Free, Standard, Pro, Business
- [x] `Done` Plan pricing exists in code
- [x] `Done` Commission tiers exist in code
- [x] `Done` Plan comparison page exists
- [ ] `Todo` Annual billing discount messaging should be shown clearly in UI
- [ ] `Todo` Billing portal and plan change flow should be fully verified end to end

## 2. Limits and entitlement enforcement

- [x] `Done` Event and organiser plan metadata exists
- [x] `Done` Active event limits are enforced in parts of the app
- [ ] `Partial` Attendee-per-event limits need full page-by-page verification
- [ ] `Partial` Waitlist cap enforcement should be verified against all plans
- [ ] `Partial` Organiser seat limits need explicit UI and API verification
- [ ] `Todo` Data retention differences should be surfaced more clearly in the product

## 3. Paid event monetisation

- [x] `Done` Paid event flow exists
- [x] `Done` Commission model is represented in the app
- [ ] `Partial` Organiser-facing explanation of subscription fee vs commission should be clearer in billing UI
- [ ] `Partial` Earnings and payout visibility still need a stronger organiser dashboard surface
- [ ] `Todo` End-to-end commission verification by plan should be re-tested after payment provider changes

## 4. Feature allocation by plan

- [x] `Done` PDF tickets and QR check-in are represented in the system
- [x] `Done` Basic analytics and richer analytics surfaces exist
- [x] `Done` AI insights/reporting foundations exist
- [ ] `Partial` AI allowance by plan needs stricter metering and visible usage counters
- [ ] `Partial` Email campaigns exist in concept/routes but need full product verification
- [ ] `Partial` Custom branding needs a clearer Pro/Business gating pass
- [ ] `Todo` Event FAQ system needs verification and possible UI polish
- [ ] `Todo` Recurring events need full implementation and testing
- [ ] `Todo` API access needs Business gating and documentation
- [ ] `Todo` Priority support needs an explicit product surface

## 5. PAYG layer

- [ ] `Todo` PAYG opt-in setting
- [ ] `Todo` Saved payment method requirement before PAYG activation
- [ ] `Todo` Live PAYG usage meter in billing dashboard
- [ ] `Todo` Monthly PAYG spending cap with 80% warning and 100% stop
- [ ] `Todo` End-of-month PAYG invoicing
- [ ] `Todo` Extra attendee overage billing
- [ ] `Todo` Extra active event billing
- [ ] `Todo` Extra organiser seat billing
- [ ] `Todo` AI overage billing
- [ ] `Todo` Bulk email overage billing
- [ ] `Todo` Data retention extension billing

## 6. Recommended conversion features

- [ ] `Todo` Certificates of attendance
- [ ] `Todo` Drip email sequences
- [ ] `Todo` Organiser public profile page
- [ ] `Todo` Embed widget
- [ ] `Todo` Add-to-calendar across Google, Apple, Outlook
- [ ] `Todo` Self-cancellation by attendee
- [ ] `Todo` Notify-me waitlist for full events
- [ ] `Todo` Public event discovery / explore page
- [ ] `Todo` Offline check-in mode
- [ ] `Todo` SMS notifications
- [ ] `Todo` Referral rewards tied to pricing growth
- [ ] `Partial` M-Pesa and regional payment support is in progress and needs final end-to-end verification
- [ ] `Todo` White-label subdomain support

## 7. Immediate verification queue

- [ ] Confirm all public pricing and plan pages match the intended commercial story
- [ ] Verify all nav/footer/legal links across marketing pages
- [ ] Verify plan gating on create-event, exports, analytics, and paid events
- [ ] Verify billing dashboard language is understandable to first-time organisers
- [ ] Re-test paid checkout with current payment provider configuration
- [ ] Add product-side analytics for free-to-paid upgrade funnel

## 8. Recommended build order

1. Finish pricing/billing UI clarity and legal linking
2. Verify hard entitlement enforcement across event creation, exports, and analytics
3. Finish payment/commission visibility for organisers
4. Build PAYG foundation
5. Add highest-conversion features: certificates, drip email, discovery, add-to-calendar
