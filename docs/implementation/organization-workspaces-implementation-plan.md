# EventSlot Organization Workspaces — Master Implementation Plan

**Specification Authority:** *EventSlot Organization Workspaces — Complete Product, Architecture & Engineering Specification (Version 1.0, 11 November 2026)*  
**Target Environment:** EventSlot Next.js 16 Web Application (`event-slot/`)  
**Status:** In Progress (Plan Established, Implementation Active)

---

## 1. Executive Summary & Goals

EventSlot is evolving from a single-organizer model to a multi-tenant B2B platform supporting both individual event organizers and organizations (such as *I Speak Society*, *The Disruptors Movement*, churches, universities, and corporate event teams).

### Core Invariants
1. **One User Identity, Multiple Workspaces:** A single account can own personal events and participate in multiple organizations with independent roles in each.
2. **Explicit Workspace Context & Event Ownership:** Events created in the Personal workspace are personally owned. Events created in an Organization workspace belong to the Organization. The creating user (`creatorId`) is preserved separately from the owner (`organizationId` or `organizerId`). Switching workspaces never silently transfers ownership.
3. **Fixed Roles & Centralized Permissions:** Fixed roles (**Owner**, **Admin**, **Event Manager**) with server-authoritative permission checks on every protected endpoint and server action.
4. **Zero-Login Gate Verifier Preserved:** Gate verification via `/verify-tickets/[slug]` and `verifierCode` remains lightweight, tokenized, zero-login, and scoped strictly to assigned events.
5. **Durable Organization Identity & Audience Following:** Attendees follow the *Organization* on organization-owned events, not individual team coordinators. Follow records and counts are strictly segregated.
6. **Governed Finances:** Financial governance model is designed upfront, but live payouts/settlements remain disabled until external provider and legal/compliance gates are satisfied. Zero simulated or fabricated payout flows.
7. **Legacy Event Safety:** All existing events remain personal. Eligible events can be explicitly transferred through an authorized, audited workflow.
8. **ESA Alignment:** EventSlot Assistant respects the active workspace and revalidates permissions at execution time.

---

## 2. Requirements Traceability Matrix

| Spec Section | Requirement | Application Component / File | Verification / Test |
| :--- | :--- | :--- | :--- |
| **§6, §7** | User identity & multiple workspaces | `prisma/schema.prisma` (`Organization`, `OrganizationMember`), `app/api/me/workspaces/route.ts`, `components/dashboard/WorkspaceSelector.tsx` | `__tests__/api/organizationWorkspaces.test.ts` |
| **§7, App A** | Role & Permission Policy | `lib/organizationPermissions.ts`, `lib/auth/rbac.ts` | `__tests__/lib/organizationPermissions.test.ts` |
| **§8** | Workspace-aware event creation | `lib/events/event-creation-service.ts`, `app/api/events/route.ts` | `__tests__/api/organizationEventCreation.test.ts` |
| **§8** | Eligible event transfer | `app/api/events/[slug]/transfer/route.ts`, `lib/events/event-transfer-service.ts` | `__tests__/api/eventTransfer.test.ts` |
| **§9** | Organization profile & handle reservation | `app/api/organizations/route.ts`, `app/api/organizations/[handle]/route.ts`, `app/org/[handle]/page.tsx` | `__tests__/api/organizationProfiles.test.ts` |
| **§9** | Profile publication & verification requests | `app/api/organizations/[handle]/publish/route.ts`, `app/api/organizations/[handle]/verification/route.ts` | `__tests__/api/organizationVerification.test.ts` |
| **§10** | Invitations (Email & Secure Links) | `app/api/organizations/[handle]/invitations/route.ts`, `app/api/invitations/[token]/accept/route.ts`, `app/invite/[token]/page.tsx` | `__tests__/api/organizationInvitations.test.ts` |
| **§10** | Membership management & removal | `app/api/organizations/[handle]/members/[memberId]/route.ts` | `__tests__/api/organizationMembers.test.ts` |
| **§11** | Organization following & notifications | `prisma/schema.prisma` (`OrganizationFollower`), `app/api/organizations/[handle]/follow/route.ts`, `components/following/FollowButton.tsx` | `__tests__/api/organizationFollow.test.ts` |
| **§12** | Scoped gate verification | `app/api/events/[slug]/verify-ticket/route.ts`, `app/verify-tickets/[slug]/page.tsx` | `__tests__/api/scopedGateVerification.test.ts` |
| **§13** | Organization analytics & reporting | `app/api/organizations/[handle]/analytics/route.ts`, `components/organization/OrganizationAnalyticsDashboard.tsx` | `__tests__/api/organizationAnalytics.test.ts` |
| **§14** | Financial governance foundation | `prisma/schema.prisma` (`OrganizationFinanceProfile`), `app/api/organizations/[handle]/finance/route.ts` | `__tests__/api/organizationFinance.test.ts` |
| **§15** | ESA workspace awareness & drafting | `lib/assistant/context-resolver.ts`, `lib/assistant/confirmation-executor.ts` | `__tests__/lib/assistantOrganizationContext.test.ts` |
| **§16** | Frontend Organization Dashboard & UX | `app/(organizer)/dashboard/organization/page.tsx`, `components/organization/*` | Jest component tests & Playwright |
| **§20** | Organization audit logging | `prisma/schema.prisma` (`OrganizationAuditLog`), `lib/organizationAudit.ts` | `__tests__/lib/organizationAudit.test.ts` |

---

## 3. Database Architecture & Schema Changes

### 3.1 New Enums
```prisma
enum OrganizationRole {
  OWNER
  ADMIN
  EVENT_MANAGER
}

enum OrganizationMemberStatus {
  ACTIVE
  SUSPENDED
  REMOVED
}

enum OrganizationPublicationStatus {
  DRAFT
  PUBLISHED
  SUSPENDED
  ARCHIVED
}

enum OrganizationVerificationStatus {
  UNVERIFIED
  PENDING
  VERIFIED
  REJECTED
  REVOKED
}

enum OrganizationInvitationType {
  EMAIL
  LINK
}

enum OrganizationInvitationStatus {
  PENDING
  ACCEPTED
  EXPIRED
  REVOKED
  DECLINED
}

enum OrganizationFinanceStatus {
  UNCONFIGURED
  PENDING_REVIEW
  ENABLED
  RESTRICTED
  DISABLED
}

enum EventTransferStatus {
  PENDING
  APPROVED
  COMPLETED
  REJECTED
  CANCELLED
}
```

### 3.2 New Models
1. **`Organization`**: Identity, handle (lowercase unique slug), publication status, verification status, contact info, branding, timestamps.
2. **`OrganizationMember`**: Connects `Organization` and `User` with `role`, `status`, and inviter attribution. Unique on `[organizationId, userId]`.
3. **`OrganizationInvitation`**: Secure hashed token, type (`EMAIL` or `LINK`), role, usage limits, expiration, and status.
4. **`OrganizationFollower`**: Segregated user-to-organization follow relationship. Unique on `[followerId, organizationId]`.
5. **`OrganizationAuditLog`**: Append-only log recording actor, action, target, and before/after metadata.
6. **`OrganizationVerificationRequest`**: Evidence tracking, reviewer identity, timestamps, and decision notes.
7. **`OrganizationFinanceProfile`**: Separation of event owner and financial beneficiary. Gated in `UNCONFIGURED` state pending provider verification.
8. **`EventTransferRequest`**: Multi-step audited transfer between personal and organization ownership.

### 3.3 Changes to Existing Models
- **`Event`**:
  - `organizationId String?` (nullable foreign key to `Organization`)
  - `creatorId String?` (nullable foreign key to `User`, tracking who clicked create)
  - `organization Organization? @relation(fields: [organizationId], references: [id])`
  - `creator User? @relation("EventCreator", fields: [creatorId], references: [id])`
  - Invariant: If `organizationId` is null, event is personal (`organizerId` is user). If `organizationId` is present, event is organization-owned.

---

## 4. Permission Model & Security Rules

### Fixed Role Matrix
| Permission Key | Owner | Admin | Event Manager | Gate Verifier |
| :--- | :---: | :---: | :---: | :---: |
| `view_org_settings` | Yes | Yes | Basic only | No |
| `edit_org_profile` | Yes | Yes | No | No |
| `publish_org_profile` | Yes | No | No | No |
| `view_members` | Yes | Yes | Team list | No |
| `invite_members` | Yes | Yes (Admin/EM) | No | No |
| `revoke_invites` | Yes | Yes | No | No |
| `remove_members` | Yes | Yes (Non-Owner) | No | No |
| `change_member_role` | Yes | Yes (Non-Owner) | No | No |
| `transfer_ownership` | Yes | No | No | No |
| `view_all_events` | Yes | Yes | Yes (All Org) | No |
| `create_event` | Yes | Yes | Yes | No |
| `edit_event` | Yes | Yes | Assigned / Own | No |
| `publish_event` | Yes | Yes | If granted / Yes | No |
| `cancel_event` | Yes | Yes | No | No |
| `transfer_event` | Yes | No | No | No |
| `view_registration_counts`| Yes | Yes | Yes | No |
| `view_attendee_details` | Yes | Yes | Restricted/Granted | Min Ticket Data |
| `export_attendee_list` | Yes | Yes | No (Strict) | No |
| `perform_checkin` | Yes | Yes | Yes | Yes (Assigned) |
| `manage_verifier_access` | Yes | Yes | Yes | No |
| `view_org_analytics` | Yes | Yes | Aggregated only | No |
| `export_org_reports` | Yes | Yes | No | No |
| `view_audit_log` | Yes | Yes | No | No |
| `view_finance_summary` | Yes | No (Strict) | No | No |
| `configure_settlement` | Yes (Governed) | No | No | No |

---

## 5. Implementation Execution Phases

- **Phase 1: Database Foundation & Prisma Migration**  
  Add enums, models, relations, and apply migration via Prisma.
- **Phase 2: Authorization Engine & Workspace Context**  
  Implement `lib/organizationPermissions.ts`, update `/api/me/workspaces/route.ts` and `WorkspaceSelector.tsx`.
- **Phase 3: Organization Lifecycle & Profiles**  
  Endpoints and UI for org creation, handle reservation, profile editing, publishing, and verification requests.
- **Phase 4: Membership & Invitations**  
  Email invitations, cryptographic link generation, acceptance flow (`/invite/[token]`), member removal, and audit logging.
- **Phase 5: Event Ownership & Workspace Creation**  
  Update `createEventDomainService`, list organization events, support eligible event transfer.
- **Phase 6: Organization Following & Audience**  
  Segregated `OrganizationFollower` API, update `FollowButton.tsx`, audience notifications.
- **Phase 7: Organization Analytics & Scoped Gate Verification**  
  Cross-event aggregation, role-filtered attendee reports, tokenized verifier preservation.
- **Phase 8: Financial Governance & ESA Integration**  
  Gated finance profile, assistant workspace awareness and draft revalidation.
- **Phase 9: Comprehensive Test Suite & Static Audits**  
  Unit tests, integration tests, negative authorization tests, build and type check verification.
- **Phase 10: Final Documentation & Release Report**  
  `docs/implementation/organization-workspaces-implementation-report.md`.
