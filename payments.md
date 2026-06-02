# Payments Strategy for EventSlot

Date: 2026-06-02  
Updated: 2026-06-02 (v2 — 4-tier model with PAYG and tiered commission)

## Goal
Introduce four plans — **Standard (Free)**, **Plus**, **Business**, and **Custom** — plus a pay-as-you-go addon layer, such that:
- Most users choose Plus or Business (not stay on Free forever)
- Paid-event commission and subscription fees together feel like a good deal, never a double charge
- Free remains genuinely useful as a permanent entry point, not a trial

## Platform Audit Summary (what already exists)

### Billing and monetization systems already in place
- Paystack integration is present for checkout, verify, and webhook handling.
- Report download bundles are implemented and stored in dedicated wallet/transaction tables.
- Token economy is implemented for premium actions:
  - Document/report generation (20 tokens)
  - Voice transcription after monthly free quota (10 tokens)
- Credits economy also exists for feature unlocks and has its own bundles and transaction ledger.
- Subscription-plan fields still exist on User (plan, billingCycle, plan dates), but plan checkout is currently disabled in one route.

### Important current-state conflicts
- Pricing page is hidden.
- Some routes/docs reflect "plans disabled", while other code paths still support plan metadata and legacy credit unlocks.
- Report download monetization appears in both billing and report-download specific routes.
- There are 3 monetization primitives in parallel:
  - Tokens
  - Credits
  - Report download bundles

## Recommendation: Commercial Model to launch now

### 1) Plan structure
Keep plans simple and do not remove pay-as-you-go.

- Standard (monthly)
  - For solo organizers and small communities.
  - Includes all core free product functions plus monthly included usage credits.
  - Suggested baseline:
    - 10 report downloads/month included
    - 150 tokens/month included
    - 3 team members included
    - Email support

- Plus Business (monthly)
  - For teams, agencies, campuses, churches, and frequent organizers.
  - Suggested baseline:
    - 60 report downloads/month included
    - 800 tokens/month included
    - up to 10 team members
    - Priority support
    - Better analytics packaging and branded outputs

### 2) Custom charges (add-ons)
Custom charges should be explicit add-ons above each plan. Start with these:

- Additional report downloads bundle
  - Keep current bundles and expose them as add-ons for all plans.
- Additional token top-ups
  - Keep current token package structure and let users buy extra at any time.
- Seat add-on (team)
  - Charge per extra team member above included seats.
- Custom/enterprise add-ons
  - White-label or custom branding package
  - Dedicated support/SLA package
  - API/export automation package

### 3) Keep one free entry path
- Keep Free plan as lead generation with core functionality.
- Continue charging only when there is high-value usage (reports/tokens/add-ons).

## Recommended pricing logic (commercial behavior)

### Included usage first, then pay-as-you-go
- Monthly plan benefits should grant included balances first.
- When included balances are exhausted:
  - consume purchased report bundles
  - consume purchased tokens
  - otherwise prompt checkout

### Keep local market fit and flexibility
- Keep KES checkout for local users where possible.
- Keep country-based payment channels and add country-specific display messaging.

## Product packaging proposal

### Standard
- Positioning: "Everything needed to run professional events"
- Primary value: less friction, predictable monthly cost, enough included usage for regular organizers.

### Plus Business
- Positioning: "For teams and high-frequency organizers"
- Primary value: more included usage, team operations, priority handling.

### Custom charges
- Positioning: "Scale when needed"
- Primary value: no forced hard upgrade, clear usage-based expansion.

## Technical rollout plan (low-risk)

### Phase 0: Cleanup and unification (before launch)
- Choose one primary wallet term for UX (recommend: Tokens for usage credits).
- Keep legacy credits in DB for backward compatibility, but stop exposing them in new UI.
- Keep report download wallet as a separate unit initially.
- Add one billing source-of-truth service that resolves:
  - current plan
  - included balances
  - purchased balances
  - charge decision

### Phase 1: Standard and Plus Business launch
- Re-enable plan checkout endpoint with new plan keys:
  - standard_monthly, standard_annual
  - plus_business_monthly, plus_business_annual
- Add plan entitlement table/config to define included monthly amounts.
- Add monthly reset/replenish job for included balances.

### Phase 2: Add-ons and custom charges
- Keep existing report bundle purchase flow.
- Keep existing token top-up flow.
- Add seat add-on SKU.
- Add manual invoice/custom charge path for enterprise sales.

### Phase 3: Consolidate and deprecate duplicates
- Retire duplicate payment routes once one flow is confirmed stable.
- Remove legacy credit-only unlock pathways from user-facing product.
- Keep migration scripts for historical data and admin reporting continuity.

## Data and KPI recommendations
Track these from day one:
- Free to Standard conversion rate
- Standard to Plus Business upgrade rate
- ARPPU and MRR
- Token/report bundle attach rate per plan
- Churn by plan
- Revenue split:
  - subscriptions
  - report bundles
  - token top-ups
  - custom charges

## Risk controls
- Keep payment feature flag and staged rollout (internal, pilot users, full launch).
- Ensure webhook idempotency on all charge-success paths.
- Maintain audit logs for all balance changes.
- Add clear customer messaging for:
  - included monthly balances
  - overage/add-on pricing
  - reset dates

## Suggested immediate next actions
1. Approve commercial definitions for Standard and Plus Business (included balances + monthly/annual price points).
2. Decide naming and UX language for wallet units (Tokens vs Credits) and enforce one frontend terminology.
3. Implement Phase 0 cleanup, then open pilot rollout for selected organizers before public pricing page relaunch.

---

## v2: Four-Tier Model with Tiered Commission and Pay-As-You-Go

### Why four tiers (not two)

The original model had Standard and Plus Business. Adding **Plus** between Free and Business creates a natural upgrade ladder:

```
Standard (Free) → Plus → Business → Custom
```

- Standard keeps the platform accessible for solo/small-community organisers
- Plus converts occasional organisers who want more polish (brand, AI, email)
- Business converts frequent or commercial organisers — the highest lifetime value users
- Custom handles universities, corporates, NGOs, and anyone who runs 50+ events/year

The goal is to make Plus and Business so compelling that staying on Free feels like leaving money on the table. The commission structure is the lever.

---

### The 5% Commission Problem — and How to Solve It

**The issue:** If EventSlot charges a monthly subscription AND takes 5% from paid-event ticket revenue, organisers will feel conned — they pay twice. This will kill paid plan conversion.

**The solution:** Reduce the commission rate as tier increases, so upgrading *pays for itself*.

| Tier | Monthly Price | Commission on Paid Events |
|------|--------------|--------------------------|
| Standard (Free) | Free | 5% |
| Plus | KES 999/mo (~$7) | 2% |
| Business | KES 3,500/mo (~$25) | 1% |
| Custom | Annual flat fee | 0% |

**Why this works — the maths:**

Scenario: An organiser runs one paid event collecting KES 100,000 in ticket sales.

| Plan | Commission paid | Plan fee | Total cost to organiser |
|------|----------------|----------|------------------------|
| Standard | KES 5,000 | KES 0 | KES 5,000 |
| Plus | KES 2,000 | KES 999 | **KES 2,999** |
| Business | KES 1,000 | KES 3,500 | **KES 4,500** |

**Plus pays for itself** if the organiser runs a single paid event over **~KES 36,000** (commission saving of KES 1,080 > plan cost of KES 999).

**Business pays for itself** at 4+ paid events of KES 100k/month (saving KES 16,000 in commission vs Free).

**The pitch to the organiser:** "Your EventSlot subscription isn't a cost — it's a commission reduction. On your first serious paid event, it pays for itself."

---

### Plan Definitions

#### Standard — Free Forever

Target: Solo organisers, students, small communities, first-time event hosts.

| Feature | Limit |
|---------|-------|
| Active events at a time | 3 |
| Registrations per event | 100 |
| Team members per event | 1 |
| AI assistant messages/month | 10 (sampler) |
| AI event insights | 0 (must purchase or upgrade) |
| Email campaigns | 0 |
| PDF/Word reports | 0 |
| Commission on paid events | 5% |
| EventSlot branding | Shown on event pages and emails |
| Data retention | 90 days after event ends |
| Analytics | Basic (headcount, waitlist count) |
| CSV export | Yes |
| QR tickets | Yes |
| Community features | Yes (leaderboard, badges, referrals) |
| Pay-as-you-go | Available (must activate) |

---

#### Plus — KES 999/month or KES 9,990/year (save 2 months)

Target: University clubs, churches, regular community organisers, freelance event managers.

| Feature | Limit |
|---------|-------|
| Active events at a time | 15 |
| Registrations per event | 500 |
| Team members per event | 3 |
| AI assistant messages/month | 100 |
| AI event insights/month | 3 |
| Email campaigns/month | 500 sends |
| PDF/Word reports/month | 5 |
| Commission on paid events | 2% |
| EventSlot branding | Removed from event pages and emails |
| Data retention | 1 year |
| Analytics | Standard (check-in rate, waitlist funnel, referral source) |
| CSV export | Yes |
| Google Calendar sync | Yes |
| Pay-as-you-go | Available (reduced rate) |

**What makes Plus irresistible:**
1. Branding removal — events look professional and fully yours
2. Email campaigns in-platform — no Mailchimp, no copy-pasting attendee lists
3. AI insights — tells you best time to run the event, expected attendance, audience profile
4. Commission drops from 5% → 2% — this alone justifies the upgrade for paid events
5. Annual option saves 2 months of fees

---

#### Business — KES 3,500/month or KES 35,000/year (save ~2.5 months)

Target: Agencies, tech communities, corporate HR, sports organisers, campuses running multiple simultaneous events.

| Feature | Limit |
|---------|-------|
| Active events at a time | Unlimited |
| Registrations per event | 2,000 |
| Team members per event | 10 |
| AI assistant messages/month | Unlimited |
| AI event insights/month | Unlimited |
| Email campaigns/month | Unlimited sends |
| PDF/Word reports/month | Unlimited |
| Commission on paid events | 1% |
| EventSlot branding | Removed |
| Data retention | Permanent |
| Analytics | Advanced (cohort, retention, MoM trends, global cross-event tracker) |
| Google Calendar sync | Yes |
| Priority support | Yes (email, faster response SLA) |
| Pay-as-you-go | Available (lowest rate) |

**What makes Business irresistible:**
1. Unlimited events — no mental overhead of "do I have room for this event?"
2. Full AI suite — capacity prediction, cross-event global tracker, unlimited insights
3. 1% commission — running 5 × KES 100k events saves KES 20,000/month vs Free after plan fee
4. Team of 10 per event — delegate check-in, email, content, and analytics separately
5. Permanent data retention — your event history is an asset, not deleted after 90 days

---

#### Custom — Contact Sales (annual contract)

Target: Universities, large NGOs, government agencies, enterprise HR, sports federations.

- Unlimited everything from Business
- 0% commission on paid events (replaced by annual flat fee, negotiated)
- White-label option (custom domain, custom branding throughout)
- Dedicated account manager
- SLA with uptime guarantee
- SSO / SAML integration (future)
- API access for custom integrations
- Custom registration data retention policy
- Onboarding and training sessions

Pricing: Annual flat fee, negotiated per account. Starting from KES 120,000/year for institutions.

---

### Pay-As-You-Go (PAYG) Design

**Concept:** Any user on any plan can activate PAYG to use the platform beyond their tier limits without upgrading. They pay per unit at the end of the month.

**Rules:**
1. PAYG is **opt-in** — the organiser must explicitly enable it in their billing settings
2. Before activating, the organiser must add a payment method (card or M-Pesa)
3. No PAYG charges happen without an active payment method on file
4. Monthly billing statement generated on the 1st of each month
5. Optional hard cap: organiser can set a maximum PAYG spend per month (e.g., KES 2,000) — charges stop at the cap
6. Admin receives a receipt email 3 days before billing date showing the pending amount

**PAYG unit rates:**

| Unit | Standard | Plus | Business |
|------|----------|------|----------|
| Extra registration (over tier cap) | KES 6 (~$0.05) | KES 4 | KES 2 |
| Extra AI message (over monthly quota) | KES 6 | KES 4 | KES 2 |
| Extra email send (over monthly quota) | KES 3 | KES 2 | KES 1 |
| Extra PDF/Word report (over monthly quota) | KES 20 | KES 15 | KES 10 |

**Why PAYG works:**
- Prevents users from feeling blocked ("I'm 5 registrations from my cap on a viral event")
- Creates a natural upgrade trigger: if PAYG bills add up to > plan cost, the billing UI suggests upgrading
- Does not require the user to upgrade just to handle one spike event
- The reduced PAYG rates on higher tiers are another incentive to upgrade

**Upgrade nudge logic (automated):**
> "Your pay-as-you-go charges this month came to KES 1,247. For KES 999, Plus gives you 5× more capacity and 2% commission on paid events — and would have cost you KES 0 in overages this month."

This in-app message converts the PAYG billing moment into an upgrade moment.

---

### Commission + Subscription: Combined Value Table

To make it explicit to users that the subscription is not a second charge but a commission reduction:

| Scenario | On Free | On Plus (KES 999/mo) | Savings vs Free |
|----------|---------|---------------------|-----------------|
| KES 30k paid event | KES 1,500 commission | KES 600 + KES 999 plan = KES 1,599 | −KES 99 (breaks even) |
| KES 50k paid event | KES 2,500 commission | KES 1,000 + KES 999 plan = KES 1,999 | **Save KES 501** |
| KES 100k paid event | KES 5,000 commission | KES 2,000 + KES 999 plan = KES 2,999 | **Save KES 2,001** |
| KES 200k paid event | KES 10,000 commission | KES 4,000 + KES 999 plan = KES 4,999 | **Save KES 5,001** |

Show this table on the pricing page. Let the maths do the selling.

---

### What Gets Enforced at Launch vs Later

Not everything needs to be enforced on day one. Suggested rollout order:

**Phase 1 (launch):**
- Plan selection UI on pricing page (currently hidden — unhide it)
- Commission deduction at checkout (Paystack webhook deducts 5%/2%/1% based on organiser's plan)
- Registration cap enforced for Free (already partially done with 100-reg cap)
- Active event cap enforced (currently no cap — add check on event creation)

**Phase 2:**
- AI message quota enforcement per plan
- Email campaign send quota enforcement
- PAYG billing infrastructure (payment method collection, monthly invoice job)
- Upgrade nudge on quota exhaustion

**Phase 3:**
- Annual billing option
- PAYG hard cap UI
- Monthly billing statement emails
- Upgrade-nudge from PAYG billing moments

**Phase 4:**
- Custom/enterprise contract workflow
- White-label infrastructure
- Advanced analytics gating

---

### Pricing Page Copy (headline and subheadlines)

**Headline:** "The platform that pays you to upgrade"

**Subheadline:** "Every paid event you run on Plus or Business earns back more than your subscription. Commission drops from 5% to 1% — your plan fee is an investment, not a cost."

**Plus CTA:** "Start saving on commissions"  
**Business CTA:** "Unlimited events. 1% commission."  
**Custom CTA:** "Talk to us — 0% commission."

---
