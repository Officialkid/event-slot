# EventSlot Security Scan Response — 15 July 2026

This note records the engineering response to the Phantom Sentinel automated assessment dated 14 July 2026.

## Findings Reviewed

1. `No Rate Limiting on Login Endpoint` — Medium
2. `Server Version Disclosure` — Medium
3. `Missing SPF Record` — Low
4. Informational crawler findings (`Technology Stack Identified`, `Site Map`, `XSS`, `SQL Injection`)

## Engineering Response

### 1. Login abuse controls

Implemented in application code:

- Pre-auth IP throttling on the credentials callback
- Stronger login rate limit target: 5 attempts per minute per IP
- Progressive sign-in slowdowns after repeated failed attempts
- Temporary 15-minute identifier lockout after 5 failed attempts
- Failure-state reset after a successful login
- Safer limiter fallback so Redis outages do not fail open

Relevant files:

- `app/api/auth/[...nextauth]/route.ts`
- `lib/auth.ts`
- `lib/authSecurity.ts`
- `lib/ratelimit.ts`
- `prisma/schema.prisma`

### 2. Server version disclosure

Application-level hardening completed:

- Disabled the Next.js `X-Powered-By` response header via `next.config.mjs`

Residual note:

- The `Server: Google Frontend` header is managed by Google Cloud / Google Frontend infrastructure and may still appear unless hidden behind additional edge infrastructure. This is lower-value disclosure than app-server version leakage and was low-confidence in the scan.

### 3. SPF record

This item is external to application code and must be completed in DNS.

Recommended action:

- Add an SPF TXT record at the apex domain for the sending providers actually in use.
- If Google Workspace and Resend are both used, validate the final SPF string carefully to avoid multiple SPF records.

Suggested implementation pattern:

- `v=spf1 include:_spf.google.com include:spf.resend.com ~all`

Do not publish this unchanged without confirming the exact active mail providers for production.

### 4. Informational scanner gaps

The XSS and SQL findings do not confirm absence of risk. They show the crawler did not reach authenticated, API-driven, or deeper application surfaces.

Recommended follow-up:

- Run an authenticated scan with organizer and admin sessions
- Provide route inventory / API specification to the assessor
- Add manual review for state-changing endpoints and rich text / URL fields

## Status Summary

| Finding | Status |
|---|---|
| Login abuse controls | Fixed in code |
| App-layer version leakage | Reduced in code |
| SPF | Requires DNS change outside repo |
| Informational crawl coverage | Needs deeper authenticated retest |
