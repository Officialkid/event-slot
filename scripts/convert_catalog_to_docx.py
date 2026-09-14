"""
EventSlot — Markdown to DOCX Converter
Generates Docx/EventSlot_Platform_Features_and_Monetization_Catalog.docx
from docs/EVENTSLOT_PLATFORM_FEATURES_AND_MONETIZATION_CATALOG.md
"""

from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "Docx"
OUTPUT_FILE = OUTPUT_DIR / "EventSlot_Platform_Features_and_Monetization_Catalog.docx"

# Corporate EventSlot brand colors
COLOR_PRIMARY = "0F172A"      # Slate 900
COLOR_ACCENT = "15803D"       # Emerald / Green
COLOR_MUTED = "64748B"        # Slate 500
COLOR_BG_HEADER = "F1F5F9"    # Slate 100
COLOR_BG_ROW_ALT = "F8FAFC"   # Slate 50
COLOR_BORDER = "CBD5E1"       # Slate 300

def set_cell_shading(cell, fill_hex: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill_hex)
    tc_pr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=140, right=140):
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_mar = OxmlElement("w:tcMar")
    for side, val in [("top", top), ("bottom", bottom), ("left", left), ("right", right)]:
        node = OxmlElement(f"w:{side}")
        node.set(qn("w:w"), str(val))
        node.set(qn("w:type"), "dxa")
        tc_mar.append(node)
    tc_pr.append(tc_mar)

def set_run_font(run, name="Calibri", size=11, color="000000", bold=False, italic=False):
    run.font.name = name
    run._element.rPr.rFonts.set(qn("w:ascii"), name)
    run._element.rPr.rFonts.set(qn("w:hAnsi"), name)
    run.font.size = Pt(size)
    run.font.color.rgb = RGBColor.from_string(color)
    run.bold = bold
    run.italic = italic

def add_styled_heading(doc, text, level=1):
    p = doc.add_paragraph()
    p.paragraph_format.keep_with_next = True
    if level == 1:
        p.paragraph_format.space_before = Pt(18)
        p.paragraph_format.space_after = Pt(6)
        run = p.add_run(text)
        set_run_font(run, size=16, color=COLOR_PRIMARY, bold=True)
    elif level == 2:
        p.paragraph_format.space_before = Pt(14)
        p.paragraph_format.space_after = Pt(4)
        run = p.add_run(text)
        set_run_font(run, size=13, color=COLOR_ACCENT, bold=True)
    elif level == 3:
        p.paragraph_format.space_before = Pt(10)
        p.paragraph_format.space_after = Pt(3)
        run = p.add_run(text)
        set_run_font(run, size=11.5, color=COLOR_PRIMARY, bold=True)
    return p

def add_body_p(doc, text="", bold_prefix="", size=10.5, color="334155", bullet=False, italic=False):
    p = doc.add_paragraph()
    p.paragraph_format.line_spacing = 1.15
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.space_before = Pt(0)
    if bullet:
        p.paragraph_format.left_indent = Inches(0.25)
        run_bullet = p.add_run("• ")
        set_run_font(run_bullet, size=size, color=COLOR_ACCENT, bold=True)
    if bold_prefix:
        r_pre = p.add_run(bold_prefix)
        set_run_font(r_pre, size=size, color="0F172A", bold=True)
    if text:
        r_text = p.add_run(text)
        set_run_font(r_text, size=size, color=color, bold=False, italic=italic)
    return p

def main():
    doc = Document()

    # Set page margins
    sections = doc.sections
    for s in sections:
        s.top_margin = Inches(0.8)
        s.bottom_margin = Inches(0.8)
        s.left_margin = Inches(0.8)
        s.right_margin = Inches(0.8)

    # Document Header / Banner
    p_pre = doc.add_paragraph()
    p_pre.paragraph_format.space_after = Pt(2)
    r_pre = p_pre.add_run("EVENTSLOT STRATEGIC SPECIFICATION & MONETIZATION MATRIX")
    set_run_font(r_pre, size=9.5, color=COLOR_ACCENT, bold=True)

    # Main Title
    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_after = Pt(4)
    r_title = p_title.add_run("EventSlot — Comprehensive Platform Feature Catalog & Monetization Matrix")
    set_run_font(r_title, size=20, color=COLOR_PRIMARY, bold=True)

    # Subtitle / Metadata
    p_meta = doc.add_paragraph()
    p_meta.paragraph_format.space_after = Pt(14)
    r_meta = p_meta.add_run("Canonical System Inventory | Architectural Tier Classification | September 2026")
    set_run_font(r_meta, size=10, color=COLOR_MUTED, italic=True)

    # Divider line
    p_div = doc.add_paragraph()
    p_div.paragraph_format.space_after = Pt(12)
    r_div = p_div.add_run("―" * 58)
    set_run_font(r_div, size=10, color=COLOR_MUTED)

    # Section 1
    add_styled_heading(doc, "1. Executive Summary & Monetization Philosophy", level=1)
    add_body_p(doc, "EventSlot was engineered to eliminate friction between an event organizer's vision and an attendee's seat. To maximize market penetration, virality, and organizer trust, the monetization philosophy balances four strategic pillars:")
    add_body_p(doc, "Basic event creation, RSVP ticketing, HMAC-SHA256 QR generation, and standard mobile scanning remain accessible to grassroots organizers, student leaders, and community meetups without paywalls.", bold_prefix="1. Unrestricted Free Tier Core: ", bullet=True)
    add_body_p(doc, "Features that save high-volume organizers hours of labor, provide executive reporting, remove platform branding, or unlock advanced customization (Recurring Events, Multi-Event Cohort Telemetry, Verifier Codes, DeepScan).", bold_prefix="2. Value-Driven Pro Tier: ", bullet=True)
    add_body_p(doc, "High-cost infrastructure components (Cold storage vault archives beyond standard limits, high-volume email/SMS broadcasts, AI slide deck token packs).", bold_prefix="3. Usage-Based / Pay-As-You-Go Add-ons: ", bullet=True)
    add_body_p(doc, "Multi-member role governance, custom subdomains, dedicated SLA, audit log compliance, and on-premise/hybrid data retention policies for universities, corporate event series, and institutions.", bold_prefix="4. Enterprise / Institutional Tier: ", bullet=True)

    # Section 2
    add_styled_heading(doc, "2. Strategic Tier Classification Matrix", level=1)
    add_body_p(doc, "Comprehensive classification of all capabilities across Free, Pro, Add-on, and Enterprise tiers:")

    table_data = [
        ("Feature Domain", "Feature Capability", "Recommended Tier", "Monetization Mechanism"),
        ("Event Creation", "Standard Single Event (Unlimited attendees)", "FREE", "Always free core capability"),
        ("Event Creation", "Recurring Event Engine (Daily, Weekly, Monthly)", "PRO", "Monthly/Annual Subscription"),
        ("Event Creation", "Decoupled Start/End Dates & Multi-Day Slots", "FREE / PRO", "Base dates Free; Multi-day Pro"),
        ("Event Creation", "Group & Organization Booking (Churches/Teams)", "FREE / PRO", "Core free; Pro delegation tools"),
        ("Event Form", "Standard Registration Form Questions", "FREE", "Free core capability"),
        ("Event Form", "Reorderable Questions & Checkbox 'Other' Input", "FREE", "Included for optimal attendee UX"),
        ("Event Form", "Attendee File Uploads (CVs, Portfolios, IDs)", "PRO / ADD-ON", "Backed by Cloudflare R2 storage"),
        ("Check-in & Gates", "QuickScan Live Camera QR Check-in", "FREE", "Included for seamless gatekeeping"),
        ("Check-in & Gates", "DeepScan (Attendee context, notes, VIP badges)", "PRO", "Pro organizer productivity tool"),
        ("Check-in & Gates", "Verifier Access Codes (Temporary staff PINs)", "PRO", "Included in Pro team seats"),
        ("Check-in & Gates", "HMAC-SHA256 Signed QR Tickets", "FREE", "Core security across all tiers"),
        ("Communications", "Automated Transactional Confirmation Emails", "FREE", "Free transactional emails"),
        ("Communications", "Custom Email Broadcast Campaigns & Rich Text", "PRO", "Included up to quota; add-on packs"),
        ("Communications", "Automated Waitlist Escalation Engine", "FREE / PRO", "Basic Free; Auto-escalation Pro"),
        ("Analytics", "Standard Registration & Attendee Count Metrics", "FREE", "Free standard dashboard"),
        ("Analytics", "Live Telemetry Dashboard & Real-Time Velocity", "PRO", "Real-time inflow monitoring"),
        ("Analytics", "Multi-Event Cohort Telemetry (Selective grouping)", "PRO", "Cross-event portfolio analysis"),
        ("Executive Decks", "Gemini AI Executive Presentation Deck Generator", "PRO / ADD-ON", "Included in Pro (5/mo) + Token pack"),
        ("Executive Decks", "Print-Ready Executive Report (16:9 Landscape PDF)", "PRO", "Clean board committee presentation"),
        ("Data Lifecycle", "Standard Active Event Access", "FREE", "Available during active lifecycle"),
        ("Data Lifecycle", "30-Day Free Retention Window", "FREE", "Grace period before cold archive"),
        ("Data Lifecycle", "Cloudflare R2 Cold Storage Vault (Infinite)", "PRO / ADD-ON", "Pro includes 10 events; $0.50/mo add-on"),
        ("Security & Trust", "AES-256-GCM Virtual Link Encryption", "FREE", "Universal privacy safeguard"),
        ("Security & Trust", "PDPA / GDPR Explicit Consent Collection", "FREE", "Universal compliance requirement"),
        ("Team Governance", "Multi-User Roles (Collaborators, Scanners)", "PRO / ENTERPRISE", "Per seat pricing or tier quota"),
        ("Ticketing & Pay", "Free RSVPs / Zero-Commission Events", "FREE", "Free for all community organizers"),
        ("Ticketing & Pay", "Paid Ticketing & Multi-Gateway Checkout", "TRANSACTION FEE", "2.5% - 4.5% + processing fee"),
    ]

    col_widths = [1.2, 2.5, 1.3, 1.8]
    table = doc.add_table(rows=len(table_data), cols=4)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER

    for row_idx, row in enumerate(table_data):
        is_header = (row_idx == 0)
        tr = table.rows[row_idx]
        tr._tr.get_or_add_trPr().append(OxmlElement("w:cantSplit"))
        if is_header:
            tr._tr.get_or_add_trPr().append(OxmlElement("w:tblHeader"))

        for col_idx, text in enumerate(row):
            cell = tr.cells[col_idx]
            set_cell_margins(cell, top=70, bottom=70, left=90, right=90)
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER

            if is_header:
                set_cell_shading(cell, COLOR_PRIMARY)
            elif row_idx % 2 == 1:
                set_cell_shading(cell, COLOR_BG_ROW_ALT)
            else:
                set_cell_shading(cell, "FFFFFF")

            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.line_spacing = 1.05

            run = p.add_run(text)
            font_color = "FFFFFF" if is_header else ("0F172A" if col_idx == 1 else "334155")
            bold = is_header or (col_idx in (0, 2))
            set_run_font(run, size=8.5 if is_header else 8.5, color=font_color, bold=bold)

    p_after_tbl = doc.add_paragraph()
    p_after_tbl.paragraph_format.space_before = Pt(8)

    # Section 3
    add_styled_heading(doc, "3. Deep Architectural Feature Breakdown", level=1)

    add_styled_heading(doc, "3.1 Event Creation, Scheduling & Form Engine", level=2)
    add_body_p(doc, "Daily, weekly, bi-weekly, and monthly recurring event scheduling. Employs decoupled start and end dates allowing recurring series to span arbitrary timeframes without timezone drift bugs.", bold_prefix="Recurring Event Support: ", bullet=True)
    add_body_p(doc, "Organizers can turn any existing one-off event into a recurring rolling cycle directly from Edit Event without breaking existing attendee tickets or URLs.", bold_prefix="Edit Event Retrofit: ", bullet=True)
    add_body_p(doc, "Dedicated dual-mode registration supporting churches, companies, schools, NGOs, and sports teams reserving multi-seat ticket pools under one contact.", bold_prefix="Group & Organization Booking: ", bullet=True)
    add_body_p(doc, "Reorderable drag-and-drop form questions, single/multiple choice with fillable 'Other' inputs, CV/portfolio file uploads, and conditional question logic.", bold_prefix="Advanced Dynamic Form Builder: ", bullet=True)
    add_body_p(doc, "Automated AES-256-GCM encryption with initialization vector (IV) at rest; revealed only to verified ticket holders.", bold_prefix="Virtual & Hybrid Event Support: ", bullet=True)

    add_styled_heading(doc, "3.2 Gatekeeping, Ticketing & Field Operations", level=2)
    add_body_p(doc, "HMAC-SHA256 signatures embedded in every issued ticket QR code preventing counterfeiting, ticket sharing, or manual URL spoofing.", bold_prefix="Cryptographic QR Ticketing: ", bullet=True)
    add_body_p(doc, "Sub-second camera autofocus, audio chimes, and instant auto-reset designed for processing 60+ attendees per minute at venue entry gates.", bold_prefix="QuickScan Mode: ", bullet=True)
    add_body_p(doc, "Comprehensive gatekeeping interface showing custom answers, private notes, VIP designations, and multi-ticket check-in verification.", bold_prefix="DeepScan Mode: ", bullet=True)
    add_body_p(doc, "Time-limited 6-character access codes for event volunteers and gate staff, granting scanning capabilities on mobile without exposing dashboard credentials.", bold_prefix="Staff Verifier Access Codes: ", bullet=True)

    add_styled_heading(doc, "3.3 Multi-Event Cohort Telemetry & Executive Reporting", level=2)
    add_body_p(doc, "Multi-select dropdown popover allowing organizers to select specific combinations of events (e.g. Disruptors Convention + AI Meetup). Aggregates turnout percentages, ticket velocity, check-in rate, and capacity across the chosen cohort.", bold_prefix="Cohort Multi-Select Engine: ", bullet=True)
    add_body_p(doc, "Synthesizes 5 boardroom-ready executive slides (Overview, Turnout Benchmark, Inflow Velocity, Tier Engagement, Strategic Recommendations) formatted for leadership review.", bold_prefix="Gemini AI Presentation Deck Generator: ", bullet=True)
    add_body_p(doc, "Fullscreen 16:9 presentation viewer with keyboard navigation and dedicated @media print CSS formatting for landscape printing or PDF generation.", bold_prefix="16:9 Print & PDF Export: ", bullet=True)

    add_styled_heading(doc, "3.4 Data Retention, Storage & Archiving", level=2)
    add_body_p(doc, "High-resolution posters, hero banners, and attendee document uploads stored directly in Cloudflare R2 with custom domain delivery and zero egress fees.", bold_prefix="Zero-Egress Media Storage: ", bullet=True)
    add_body_p(doc, "Completed event editions automatically compress attendee rosters into structured JSON and upload to R2 vault storage, ensuring historical preservation.", bold_prefix="Cold Storage Archive Vault: ", bullet=True)
    add_body_p(doc, "isPricingRolloutActive() flag ensures 30-day expiration warnings remain hidden from public users until the business team formally activates pricing.", bold_prefix="Controlled Monetization Safeguard: ", bullet=True)

    # Section 4
    add_styled_heading(doc, "4. Monetization Tiers Recommendation", level=1)

    add_styled_heading(doc, "Tier 1: Community (Free Tier — Unlimited)", level=2)
    add_body_p(doc, "Student leaders, grassroots organizers, community meetups, churches, non-profits.", bold_prefix="Target Audience: ")
    add_body_p(doc, "Unlimited free events and registrations", bullet=True)
    add_body_p(doc, "Standard single event scheduling & dynamic form questions", bullet=True)
    add_body_p(doc, "HMAC-SHA256 signed QR tickets & QuickScan mobile check-in", bullet=True)
    add_body_p(doc, "Automated transactional email delivery", bullet=True)
    add_body_p(doc, "Standard dashboard metrics & 30-day active event data access", bullet=True)

    add_styled_heading(doc, "Tier 2: Pro Organizer ($19 - $29 / month or $199 / year)", level=2)
    add_body_p(doc, "Professional organizers, recurring event hosts, corporate trainers, event agencies.", bold_prefix="Target Audience: ")
    add_body_p(doc, "Everything in Community Free, plus:", bold_prefix="Includes: ")
    add_body_p(doc, "Recurring Events Engine (Daily, weekly, monthly rolling cycles)", bullet=True)
    add_body_p(doc, "Multi-Event Cohort Telemetry & comparative analytics", bullet=True)
    add_body_p(doc, "Gemini AI Executive Presentation Deck Generator & 16:9 PDF Export", bullet=True)
    add_body_p(doc, "DeepScan attendee inspection, note-taking & volunteer verifier codes", bullet=True)
    add_body_p(doc, "Cloudflare R2 Cold Storage Archive Vault (Permanent event preservation)", bullet=True)
    add_body_p(doc, "Attendee File Uploads (CVs, portfolios, document attachments)", bullet=True)
    add_body_p(doc, "Group & Organization Delegations management portal", bullet=True)

    add_styled_heading(doc, "Tier 3: Pay-As-You-Go Add-Ons", level=2)
    add_body_p(doc, "$5.00 per 5,000 emails", bold_prefix="Extra Email Broadcast Quota: ", bullet=True)
    add_body_p(doc, "$3.00 per 10 executive presentation decks", bold_prefix="Extra AI Deck Generations: ", bullet=True)
    add_body_p(doc, "3.5% + $0.30 per ticket (M-Pesa STK Push / Card checkout)", bold_prefix="Paid Ticket Processing Fee: ", bullet=True)

    add_styled_heading(doc, "Tier 4: Enterprise / Institutions (Custom Quote)", level=2)
    add_body_p(doc, "Custom subdomains (events.yourcompany.com), unlimited verifier staff codes, role-based team seats, dedicated account manager, live event day hotline, custom database retention, and SSO/SAML.", bullet=True)

    # Section 5
    add_styled_heading(doc, "5. Summary for Committee & Investor Presentations", level=1)
    add_body_p(doc, "Next.js 16, PostgreSQL (Neon pooled), Cloudflare R2 zero-egress vault, Google Cloud Run with automated CI/CD containerization.", bold_prefix="1. Infrastructure Maturity: ", bullet=True)
    add_body_p(doc, "Cryptographic HMAC-SHA256 signatures, AES-256-GCM encryption, PDPA/GDPR compliance guards.", bold_prefix="2. Security Architecture: ", bullet=True)
    add_body_p(doc, "Built-in Gemini AI executive committee deck generator, multi-event cohort telemetry, offline-capable verifier codes, and group booking delegations.", bold_prefix="3. Product Differentiation: ", bullet=True)
    add_body_p(doc, "Clear separation of free community core vs. premium enterprise capabilities, protected by dormant feature flags ready for instant live activation.", bold_prefix="4. Commercial Readiness: ", bullet=True)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    doc.save(OUTPUT_FILE)
    print(f"[SUCCESS] Generated DOCX at: {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
