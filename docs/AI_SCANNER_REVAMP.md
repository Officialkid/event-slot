# AI Scanner Complete Revamp (Priority 3)

Date: 2026-05-25

## 1. Baseline assessment before changes

### `app/(organizer)/dashboard/events/[slug]/page.tsx`
- Existing scan/check-in behavior before revamp:
  - Manual verification only from three text inputs:
    - Ticket code
    - Scanned code pasted as text
    - Email/name identity
  - Calls `POST /api/events/[slug]/verify-ticket`.
  - Displays a result card with success/error/already-used states and basic attendee details.
- Existing error states before revamp:
  - Generic client-side network fallback: `Unable to verify ticket right now.`
  - Server-provided errors shown in the result card.

### `app/api/events/[slug]/verify-ticket/route.ts`
- Existing scanner verification API before revamp:
  - Supports multiple inputs:
    - `ticketCode` (Ticket model path)
    - `code` (confirmation code / scanned URL)
    - `identity` (email or name)
    - signed QR payload path via `verifyQRPayload`.
  - Marks ticket/registration as checked-in when valid.
  - Logs outcomes to `EntryLog`.
- Existing result states before revamp:
  - Valid
  - Already scanned
  - Ticket not found
  - Invalid signature / wrong event / not confirmed
- Existing error state before revamp:
  - Catch returned raw internal error message in API response.

### `components/JoinEventButton.tsx`
- Existing attendee-side scanner-related fallback:
  - Uses name/email lookup and then calls `POST /api/events/[slug]/verify-entry`.
  - Not organizer scanner UI, but part of event-entry verification surface.

### `app/api/events/[slug]/verify-entry/route.ts`
- Existing attendee verification path:
  - Validates signed QR and fallback lookup ticket IDs.
  - Applies event time-window checks and returns join/meeting-link outcomes.

### `lib/ticket-qr.ts`
- Existing QR contract:
  - Generates and verifies signed payload: `ticketId:eventId:userId:signature`.
  - Verification used by scanner-related routes.

## 2. New architecture implemented

Implemented a two-mode organizer scanner with shared camera surface and mode-specific post-scan flow:

- Quick Scan mode:
  - Camera-first speed flow with auto-reset overlays.
  - One scan -> verify call -> result flash -> reset.
- Deep Scan mode:
  - Full profile lookup flow.
  - Organizer can mark attended, add note, skip, and export session history.

Additional input options implemented in both modes (as requested):
- Scan ticket (camera)
- Upload ticket image
- Enter ticket code manually
- Enter email/name manually

## 3. New/updated files

### New scanner UI components
- `components/scanner/ScannerHome.tsx`
  - Mode selection screen (Quick / Deep).
- `components/scanner/QuickScan.tsx`
  - Fast verification flow with overlay states and vibration feedback.
- `components/scanner/DeepScan.tsx`
  - Profile workflow, note capture, mark/skip actions, CSV export.
- `components/scanner/qr-utils.ts`
  - QR normalization, image QR decoding, CSV download helper.

### New deep-scan APIs
- `app/api/events/[slug]/attendee-profile/route.ts` (GET)
  - Loads full attendee profile by scanned/uploaded/manual code.
  - Supports slug-or-id event resolution.
  - Supports owner/team/token auth checks.
  - Returns:
    - attendee name/email/status
    - registration date
    - mapped custom answers
    - previous scanner notes (from `EntryLog` note entries)

- `app/api/events/[slug]/attendee-profile/mark-attended/route.ts` (POST)
  - Marks attendee attended (`Ticket.scannedAt`, `Registration.checkedIn`, `Registration.checkedInAt`).
  - Persists optional note to `EntryLog` (`NOTE: ...`).

### Organizer dashboard integration
- Updated `app/(organizer)/dashboard/events/[slug]/page.tsx`
  - Replaced old manual verify block with `ScannerHome` in the Verify Ticket tab.

## 4. Runtime behavior now

### Quick Scan mode
- Input methods:
  - Camera scan
  - Upload image
  - Manual ticket code
  - Manual email/name
- API:
  - Uses `POST /api/events/[slug]/verify-ticket`.
- Visual result states:
  - Valid (green)
  - Already used (red, longer delay)
  - Not found (red)
  - Error (yellow)
- Reset behavior:
  - Auto-reset to scanning state after short delay.

### Deep Scan mode
- Input methods:
  - Camera scan
  - Upload image
  - Manual code/email/name
- APIs:
  - `GET /api/events/[slug]/attendee-profile`
  - `POST /api/events/[slug]/attendee-profile/mark-attended`
- Display after scan:
  - Attendee identity + status badge
  - Registration metadata
  - Custom answers
  - Previous notes
  - Note input + actions: mark attended / skip / next attendee
- Export:
  - Session history CSV export.

## 5. Current note model compatibility

The database currently has no dedicated `RegistrationNote` model.
To provide deep-scan note history immediately without schema migration:
- Notes are persisted and retrieved via `EntryLog.failReason` with `NOTE:` prefix.

This keeps deployment light and avoids blocking on schema rollout.
