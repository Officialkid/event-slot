# EventSlot Mobile Web Parity Plan

This document converts the July 27, 2026 mobile brief into the first implementation plan for the existing `mobile/` workspace.

## Source of Truth

- Web app: `https://www.eventsslot.com`
- Mobile workspace: `mobile/`
- Baseline release line: mobile `1.0.0` maps to web version `7`

## Immediate Direction

The existing Expo app already contains native scaffolding. Instead of replacing it outright, we are using it as the implementation base and tightening it toward the new spec.

## Phase 1

- Preserve the existing `mobile/` folder as the EventSlot mobile app root.
- Align shared design tokens to the required dark theme:
  - Background `#0A0A0A`
  - Lime accent `#C8F55A`
  - Surface `#111111` and `#1A1A1A`
  - Border `#27272A`
  - Primary text `#FFFFFF`
  - Secondary text `#A1A1AA`
  - Muted text `#52525B`
- Document version tagging in `CHANGELOG.md`.
- Update sign-up consent language to explicitly reflect the Kenya Data Protection Act 2019 requirement from the brief.

## Phase 2

- Introduce Expo Router structure under `mobile/app/`.
- Add shared primitives that mirror the web system:
  - `Button`
  - `Input`
  - `Card`
  - `Badge`
  - `TierBadge`
- Move auth, API, and store logic into the layout expected by the brief.

## Phase 3

- Rebuild organizer flows in parity order:
  - Sign in
  - Dashboard home
  - Events list
  - Create event
  - Event detail tabs
- Rebuild attendee-facing public event registration and paid ticket flows.

## Current Gaps To Close

- The mobile app still uses a custom shell instead of Expo Router.
- The current app still exposes a light theme path, while the brief requires dark-theme-only parity.
- Native auth uses existing native endpoints, while the brief proposes a mobile JWT route. We should reconcile those approaches before a release cut.
- Several organizer screens exist as scaffolds and still need visual parity passes against the live web app.
