# EventSlot Deep Document Scan Proposal

This proposal is for a premium document-analysis product layer, separate from the existing event QR `Deep Scan` check-in tool.

## Why the current output feels too basic

The current downloadable event report is useful, but it is still mainly a structured export plus AI narrative. A paid document-security or document-intelligence product should go deeper than summary prose.

## Proposed product: Deep Document Scan

### 1. Executive risk page

- One-page cover verdict: `Low`, `Moderate`, `High`, or `Critical`
- Risk score with 3-5 main reasons
- Clear business recommendation: safe to share, needs review, or block

### 2. File and authorship intelligence

- Metadata extraction: creator, producer, creation/modification timestamps
- File structure analysis: pages, attachments, embedded objects, encryption flags
- Change-history signals where available
- Consistency checks between visible title, metadata, and file naming

### 3. Link and destination analysis

- Extract every URL, email, phone number, and domain from the document
- Flag suspicious domains, URL shorteners, mixed-brand links, and lookalikes
- Group links by trust level and intended action

### 4. Content risk detection

- Social-engineering and phishing language markers
- Urgency, payment-pressure, impersonation, and credential-harvest cues
- Sensitive-data exposure detection: IDs, emails, phone numbers, bank/payment references
- Brand-mismatch checks between logos, language, sender identity, and document claims

### 5. Malware / exploit readiness layer

- Detect macros, scripts, embedded files, active content, and suspicious attachments
- Mark unsupported file types for sandbox/manual review
- Store a forensic checklist for analyst follow-up

### 6. Compliance and privacy layer

- PII inventory by category
- Data-handling concerns
- Recommended sharing/redaction guidance
- Retention and disclosure warnings for teams

### 7. Report output design

- Branded cover page
- Clickable table of contents
- Severity summary table
- Technical evidence appendix
- Clear remediation roadmap with owners and timeframes

## Monetisable tiers

### Standard Scan

- Metadata
- Link extraction
- Basic risk summary
- Branded downloadable report

### Deep Scan

- Everything in Standard
- Social-engineering analysis
- PII and compliance review
- File-structure and embedded-object analysis
- Remediation roadmap

### Analyst-Grade Scan

- Everything in Deep Scan
- Multi-document comparison
- Version drift detection
- Executive summary + technical appendix
- Team review workflow and export package

## Technical roadmap

1. Parse PDF, DOCX, and image uploads
2. Extract metadata, text, tables, and links
3. Run rule-based detectors before AI enrichment
4. Add AI summarisation only after deterministic evidence is collected
5. Store findings as structured JSON plus a branded report artifact
6. Add admin QA review and false-positive override flow

## Immediate next build worth shipping

1. PDF metadata extraction
2. URL/domain extraction and trust scoring
3. PII pattern detection
4. Risk-score summary card
5. Branded DOCX/PDF report with cover page and table of contents
