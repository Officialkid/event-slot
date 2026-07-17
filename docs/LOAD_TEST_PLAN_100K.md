# EventSlot 100,000 Registrations/Week Readiness Plan

Last updated: 2026-07-16

## Objective

Prove whether EventSlot can safely handle an event that receives more than 100,000 registrations in one week without guessing.

100,000 registrations/week is about 14,286 registrations/day, 595/hour, or 0.17/second on average. Real campaigns do not arrive evenly, so the test target should include peak bursts at 5x, 20x, and 50x average load.

## What Must Be Tested

1. Public event page reads at campaign-launch traffic.
2. Registration draft save and restore by attendee email.
3. Final registration submit through `POST /api/register`.
4. Waitlist placement and promotion behavior when capacity is reached.
5. Email behavior for confirmation, response copy, waitlist, and waitlist promotion.
6. Database indexes and query plans for event registrations, drafts, tickets, waitlist, and event analytics.
7. Rate limits and abuse protections so normal traffic is not blocked but bots are slowed down.
8. Cloud Run scaling, cold starts, memory, CPU, DB connection usage, and error rates.

## Existing Strengths

- `Registration` is indexed by `eventId/status`, `eventId/submittedAt`, and `eventId/waitlistPosition`.
- `RegistrationDraft` has a unique key on `eventId/email` plus an `email` index, which supports attendee progress restore.
- Registration submit already has rate limiting.
- Draft save/restore is separate from final submit, so unfinished forms do not create registrations.
- Checkout is now explicitly paused while payments are coming soon, reducing traffic and support risk from paid flows.

## Tooling Added

Use `scripts/load-test-registration.mjs` for controlled local/staging tests.

Example dry run:

```bash
node scripts/load-test-registration.mjs --event-slug=test-event --mode=all --duration=60 --rps=1
```

Example local run:

```bash
node scripts/load-test-registration.mjs --base-url=http://localhost:3000 --event-slug=test-event --payload-file=./load-payload.json --mode=all --duration=300 --rps=10 --run
```

Example waitlist-promotion run against a staging/test event:

```bash
node scripts/load-test-registration.mjs --base-url=http://localhost:3000 --event-slug=test-event --dashboard-token=TEST_DASHBOARD_TOKEN --mode=promote --capacity-start=51 --duration=60 --rps=1 --run
```

`--mode=promote` calls `PATCH /api/events/[slug]/capacity` with increasing capacity values. It mutates the event and can trigger promotion emails, so only use it on a dedicated load-test event.

Production safety:

```bash
ALLOW_PRODUCTION_LOAD_TEST=true node scripts/load-test-registration.mjs --base-url=https://www.eventsslot.com --event-slug=test-event --payload-file=./load-payload.json --duration=60 --rps=1 --run
```

Only use production with a dedicated test event and explicit approval.

## Pass Criteria

- Error rate stays below 1% during sustained load.
- p95 latency stays under 2 seconds for page reads and draft saves.
- p95 latency stays under 4 seconds for final registration submit.
- No duplicate registration-number or ticket/confirmation-code collisions.
- Waitlist positions remain sequential and correct.
- Email sending does not block registration completion.
- Database connection usage remains below the configured pool limit.
- Cloud Run scales without repeated cold-start failures.

## Remaining Work Before Claiming Capacity

- Run the script against a staging event with realistic questions.
- Add a queue or background worker for emails if registration submit is slowed by SMTP/provider latency.
- Capture database metrics during the test, especially connection count and slow queries.
- Run the focused waitlist-promotion load-test mode after SMTP secrets are configured.
- Confirm draft restore and final submit from the mobile UI in a signed-in/browser test session.
