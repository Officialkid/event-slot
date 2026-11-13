# EventSlot Careers & Recruitment Management System

## 1. Executive Summary & Architecture

The EventSlot Careers & Recruitment Portal is a fully integrated, non-AI recruitment platform engineered directly into the EventSlot production architecture. It delivers a modern talent acquisition experience:

- **Public Talent Discovery**: Fast, accessible, and responsive opportunity browsing across 7 distinct opportunity types, with dynamic search and filtering by department and role category.
- **Guided Multi-Step Application Flow**: 5-step application submission with real-time client validation, version-aware custom questions, and encrypted private document storage.
- **Privacy-Preserving Candidate Tracking**: Real-time progress tracker via reference code (`ES-CARE-XXXXXXXX`) and email verification, protected against user enumeration.
- **Role-Scoped Internal Recruitment Hub**: Administrative dashboard for vacancy authoring, candidate dossier evaluation, internal review notes, and stage management.
- **Temporary Reviewer Governance**: Time-bounded, least-privilege reviewer access with mandatory expiration, instant revocation, and vacancy-level scoping.
- **Zero-AI Human Evaluation Guarantee**: All applications and candidate statuses are strictly human-evaluated. No automated ranking, keyword scrapping, or AI rejection algorithms are permitted.
- **Audit & Compliance Engine**: Immutable chronological audit logging (`RecruitmentAuditLog`) capturing all administrative modifications, stage transitions, document accesses, and reviewer lifecycle events.

---

## 2. Information Architecture & URL Routing

### Public Routes
| Route | Description |
|---|---|
| `/careers` | Public careers discovery hub with search, department filtering, and opportunity pills |
| `/careers/[slug]` | Vacancy detail view with responsibilities, qualifications, and deadline banner |
| `/careers/[slug]/apply` | 5-step guided application flow with dynamic questions and document uploads |
| `/careers/confirmation` | Secure confirmation view with cryptographic reference code and clipboard copy |
| `/careers/track` | Candidate tracking portal requiring reference code and email address |

### Admin & Reviewer Routes
| Route | Description | Required Authorization |
|---|---|---|
| `/admin/recruitment` | Operational overview dashboard with recruitment KPIs and pending actions | Reviewer, Hiring Manager, or Global Admin |
| `/admin/recruitment/vacancies` | Vacancy management list with quick status toggles | Global Admin |
| `/admin/recruitment/vacancies/new` | Vacancy builder with dynamic question generator | Global Admin |
| `/admin/recruitment/vacancies/[id]/edit` | Vacancy editor for published, closed, or draft roles | Global Admin |
| `/admin/recruitment/applications` | Candidate applications inbox with search, filters, and CSV export | Reviewer, Hiring Manager, or Global Admin |
| `/admin/recruitment/applications/[id]` | Comprehensive candidate dossier, answers, notes, and documents | Scoped Reviewer or Global Admin |
| `/admin/recruitment/reviewers` | Temporary reviewer assignment, expiration, and revocation controls | Global Admin |
| `/admin/recruitment/audit` | Chronological recruitment audit trail with actor details and IP logging | Global Admin |

---

## 3. Opportunity Types & Taxonomy

EventSlot supports 7 distinct opportunity types, allowing the organization to recruit full-time professionals, contractors, student interns, open-source fellows, and event-day volunteers:

1. **Full-time (`FULL_TIME`)**: Permanent core team roles.
2. **Part-time (`PART_TIME`)**: Structured ongoing roles with flexible hours.
3. **Contract (`CONTRACT`)**: Project-based or milestone-bounded engagements.
4. **Internship (`INTERNSHIP`)**: Mentored learning opportunities for students and early-career talent.
5. **Volunteer (`VOLUNTEER`)**: Community and event-day operational contributor roles.
6. **Apprenticeship (`APPRENTICESHIP`)**: Hands-on technical skills development positions.
7. **Fellowship (`FELLOWSHIP`)**: Research, community advocacy, and innovation appointments.

---

## 4. Vacancy Lifecycle & Timezone Conventions

### Vacancy Lifecycle States
- **DRAFT**: Visible only to administrators. Allows iterative authoring before public release.
- **PUBLISHED**: Publicly accessible on `/careers`. Open for applications until deadline.
- **CLOSED**: Applications sealed. Informative notice displayed with links to other roles.
- **ARCHIVED**: Historical record hidden from discovery listings.

### Timezone Policy
All vacancy closing deadlines and submission timestamps are formatted and enforced in the **Nairobi (`Africa/Nairobi` / EAT, UTC+3)** timezone. The application server validates deadlines on submission, preventing late submissions regardless of client clock skew.

---

## 5. Guided Application System & Version-Aware Questions

### 5-Step Candidate Submission Flow
1. **Personal Information**: Full Name, Email, Phone, Location.
2. **Background & Experience**: Education, Work History summary, Core Skills, Portfolio links.
3. **Role-Specific Questions**: Rendered dynamically based on vacancy requirements. Supported types:
   - `SHORT_TEXT`: Single-line answers.
   - `LONG_TEXT`: Multi-line descriptive responses.
   - `SINGLE_CHOICE`: Radio button selection.
   - `MULTIPLE_CHOICE`: Checkbox group selection.
   - `YES_NO`: Binary boolean choices.
   - `URL`: Validated link input.
4. **Document Uploads**: Mandatory/optional resume, portfolio sample, and cover letter.
5. **Review & Consent**: Summary view with recruitment privacy agreement and submission button.

### Version-Aware Answers Preservation
When an applicant submits answers to custom questions, the server captures a snapshot containing:
```json
[
  {
    "questionId": "q_1",
    "questionLabel": "What is your experience with Next.js?",
    "questionType": "LONG_TEXT",
    "value": "Over 4 years building production Next.js apps..."
  }
]
```
If an administrator later edits or deletes questions on the vacancy, historical applicant answers remain intact and accurately labeled.

---

## 6. Cryptographic Reference Code & Candidate Tracking

### Reference Code Specifications
- **Format**: `ES-CARE-` + 8 high-entropy characters (e.g. `ES-CARE-9K4M7X2P`).
- **Safe Charset**: Excludes ambiguous glyphs (`0`, `O`, `1`, `I`, `L`) to prevent transcription errors.
- **Entropy**: \(31^8 \approx 852 \text{ billion}\) combinations.
- **Collision Resistance**: Automatic database verification loop with exponential retry.

### Non-Enumeration Security Model
To track status at `/careers/track`, a candidate must supply **both**:
1. The 16-character Reference Code.
2. The exact email address submitted.

If either value fails to match, the API returns a generic 404 response (`No application found matching the provided reference code and email address`). This guarantees that malicious actors cannot enumerate applicant emails or brute-force reference codes.

### 9 Candidate Journey Stages
1. `SUBMITTED`: Application safely stored and queued for review.
2. `UNDER_REVIEW`: Dossier being actively reviewed by hiring team.
3. `SHORTLISTED`: Profile selected for advanced evaluation.
4. `ASSESSMENT_INTERVIEW`: Interview or skills assignment scheduled.
5. `REFERENCE_CHECKS`: Verification of professional references.
6. `OFFER_MADE`: Formal employment or engagement offer extended.
7. `HIRED`: Candidate accepted offer and successfully onboarded.
8. `NOT_SELECTED`: Review concluded without an offer.
9. `WITHDRAWN`: Application withdrawn by candidate or upon request.

---

## 7. Private Document Storage & Streaming Security

Candidate resumes, portfolios, and credentials contain sensitive personally identifiable information (PII). They are strictly protected:

- **Isolated Storage**: Documents are stored in private Cloudflare R2 object storage, or when R2 is unconfigured in local development, within an isolated directory (`storage/recruitment/documents/`) situated **completely outside** the public web root (`public/`).
- **Zero Direct URLs**: Document files never have public URLs and cannot be accessed via static file routing.
- **Authenticated Streaming Route**: Documents can only be retrieved via `/api/admin/recruitment/applications/[id]/documents/[docId]`.
- **Permission Check**: The endpoint verifies that the requester has an active, unexpired reviewer assignment matching the application's vacancy, or is a global administrator.
- **Document Access Auditing**: Every document access event is logged in `RecruitmentAuditLog` with the viewer's ID, timestamp, and IP address.
- **MIME & Size Enforcement**: File size is capped at 10 MB. Only PDF, Word (`doc`, `docx`), Excel (`xls`, `xlsx`), and image (`jpeg`, `png`, `webp`) files are permitted. Executables, scripts, and archives are strictly rejected.

---

## 8. Temporary Reviewer Access Governance

To enable cross-functional hiring panels without compromising platform security, administrators can grant temporary, scoped recruitment access:

- **Least-Privilege Scoping**: Access can be scoped to a single vacancy or opened broadly across recruitment.
- **Mandatory Expiration**: Every reviewer assignment must have an explicit future `expiresAt` timestamp. The server automatically denies access the instant expiration passes.
- **Immediate Administrative Revocation**: Administrators can revoke access at any time via `POST /api/admin/recruitment/reviewers/[id]/revoke` with a mandatory reason.
- **Time Extension**: Reviewer access can be extended (+7, +14, or +30 days) with audit logging.
- **No Global Admin Privileges**: Temporary reviewers cannot access billing, event settings, user administration, or audit logs outside recruitment.

---

## 9. Rate Limiting & Abuse Prevention

Distributed rate limiting protects all public endpoints:
- **Application Submission (`careerApplicationRatelimit`)**: Maximum 5 submissions per 5 minutes per IP address.
- **Status Tracking (`careerTrackRatelimit`)**: Maximum 15 lookups per minute per IP address.
- Bounded LRU in-memory sliding window fallback ensures continuous rate limiting even during Redis connection degradation.

---

## 10. Audit Trail Specifications

All critical recruitment actions are written to `RecruitmentAuditLog`:
- `VACANCY_CREATED`: Vacancy created with title, department, type.
- `VACANCY_UPDATED`: Vacancy title, content, or status modified.
- `APPLICATION_SUBMITTED`: Candidate completed submission with reference code.
- `APPLICATION_STATUS_UPDATED`: Stage transition recorded with previous/new status and transition note.
- `INTERNAL_NOTE_ADDED`: Reviewer feedback attached to dossier.
- `DOCUMENT_ACCESSED`: Resume or candidate document streamed.
- `APPLICATIONS_CSV_EXPORTED`: Candidate data exported to CSV.
- `REVIEWER_ASSIGNED`: Temporary reviewer role and expiration date assigned.
- `REVIEWER_REVOKED`: Reviewer access revoked.
- `REVIEWER_EXTENDED`: Reviewer validity window lengthened.
