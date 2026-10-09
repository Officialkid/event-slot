import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=140, bottom=140, left=200, right=200):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def create_disruptors_doc():
    doc = docx.Document()
    
    # Page setup - Standard Letter/A4 portrait with 0.5 inch margins
    for section in doc.sections:
        section.top_margin = Inches(0.5)
        section.bottom_margin = Inches(0.5)
        section.left_margin = Inches(0.6)
        section.right_margin = Inches(0.6)

    # 1. Eyebrow Badge
    p_badge = doc.add_paragraph()
    p_badge.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_badge.paragraph_format.space_before = Pt(4)
    p_badge.paragraph_format.space_after = Pt(4)
    run_badge = p_badge.add_run("● OFFICIAL EVENT REGISTRATION")
    run_badge.font.name = "Arial"
    run_badge.font.size = Pt(10)
    run_badge.font.bold = True
    run_badge.font.color.rgb = RGBColor(16, 185, 129)

    # 2. Main Title
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(2)
    p_title.paragraph_format.space_after = Pt(2)
    run_title = p_title.add_run("DISRUPTORS CONVENTION")
    run_title.font.name = "Arial Black"
    run_title.font.size = Pt(26)
    run_title.font.bold = True
    run_title.font.color.rgb = RGBColor(15, 23, 42)

    # 3. Subtitle / Tagline
    p_tag = doc.add_paragraph()
    p_tag.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_tag.paragraph_format.space_before = Pt(0)
    p_tag.paragraph_format.space_after = Pt(12)
    run_tag = p_tag.add_run("Navigating Corridors of Power • Weekly Movement")
    run_tag.font.name = "Arial"
    run_tag.font.size = Pt(12)
    run_tag.font.bold = True
    run_tag.font.color.rgb = RGBColor(5, 150, 105)

    # 4. Welcome Card (Table with background)
    table_welcome = doc.add_table(rows=1, cols=1)
    table_welcome.alignment = WD_TABLE_ALIGNMENT.CENTER
    table_welcome.autofit = False
    table_welcome.columns[0].width = Inches(6.8)
    cell_w = table_welcome.cell(0, 0)
    set_cell_background(cell_w, "F1F5F9")
    set_cell_margins(cell_w, top=160, bottom=160, left=240, right=240)
    
    p_w1 = cell_w.paragraphs[0]
    p_w1.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_w1.paragraph_format.space_after = Pt(4)
    run_w1 = p_w1.add_run("Welcome to the Disruptors Community!")
    run_w1.font.name = "Arial"
    run_w1.font.size = Pt(13)
    run_w1.font.bold = True
    run_w1.font.color.rgb = RGBColor(15, 23, 42)

    p_w2 = cell_w.add_paragraph()
    p_w2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_w2.paragraph_format.space_after = Pt(0)
    run_w2 = p_w2.add_run(
        "Thank you for being part of this inspiring movement. Please scan the official QR code below "
        "to complete your registration and receive your verified entrance pass."
    )
    run_w2.font.name = "Arial"
    run_w2.font.size = Pt(10)
    run_w2.font.color.rgb = RGBColor(71, 85, 105)

    # 5. Space before QR
    p_gap = doc.add_paragraph()
    p_gap.paragraph_format.space_before = Pt(10)
    p_gap.paragraph_format.space_after = Pt(2)

    # 6. QR Code Image
    script_dir = os.path.dirname(os.path.abspath(__file__))
    qr_img_path = os.path.join(script_dir, "..", "public", "documents", "disruptors-convention-qr.png")
    
    if os.path.exists(qr_img_path):
        p_qr = doc.add_paragraph()
        p_qr.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_qr.paragraph_format.space_before = Pt(0)
        p_qr.paragraph_format.space_after = Pt(6)
        run_qr = p_qr.add_run()
        run_qr.add_picture(qr_img_path, width=Inches(3.2))

    # 7. Scan Instruction Banner
    p_banner = doc.add_paragraph()
    p_banner.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_banner.paragraph_format.space_before = Pt(0)
    p_banner.paragraph_format.space_after = Pt(14)
    run_banner = p_banner.add_run("📷 SCAN WITH ANY SMARTPHONE CAMERA")
    run_banner.font.name = "Arial Black"
    run_banner.font.size = Pt(11)
    run_banner.font.color.rgb = RGBColor(15, 23, 42)

    # 8. 3-Step Instruction Box
    table_steps = doc.add_table(rows=1, cols=3)
    table_steps.alignment = WD_TABLE_ALIGNMENT.CENTER
    col_width = Inches(2.26)
    for c in table_steps.columns:
        c.width = col_width
    
    steps = [
        ("Step 1: Open Camera", "Open your camera or QR scanner on your phone."),
        ("Step 2: Point & Scan", "Point your lens directly at the QR code above."),
        ("Step 3: Access Pass", "Tap the link to submit details & get your entry ticket.")
    ]
    for idx, (title, desc) in enumerate(steps):
        cell = table_steps.cell(0, idx)
        set_cell_background(cell, "F8FAFC")
        set_cell_margins(cell, top=120, bottom=120, left=140, right=140)
        p1 = cell.paragraphs[0]
        p1.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p1.paragraph_format.space_after = Pt(2)
        r1 = p1.add_run(title)
        r1.font.name = "Arial"
        r1.font.size = Pt(9.5)
        r1.font.bold = True
        r1.font.color.rgb = RGBColor(15, 23, 42)

        p2 = cell.add_paragraph()
        p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p2.paragraph_format.space_after = Pt(0)
        r2 = p2.add_run(desc)
        r2.font.name = "Arial"
        r2.font.size = Pt(8.5)
        r2.font.color.rgb = RGBColor(100, 116, 139)

    # 9. Direct Link Box
    p_link = doc.add_paragraph()
    p_link.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_link.paragraph_format.space_before = Pt(12)
    p_link.paragraph_format.space_after = Pt(6)
    r_l1 = p_link.add_run("Or visit directly: ")
    r_l1.font.name = "Arial"
    r_l1.font.size = Pt(10)
    r_l1.font.color.rgb = RGBColor(71, 85, 105)
    r_l2 = p_link.add_run("https://eventsslot.com/disruptors-convention-fykf")
    r_l2.font.name = "Consolas"
    r_l2.font.size = Pt(10.5)
    r_l2.font.bold = True
    r_l2.font.color.rgb = RGBColor(16, 185, 129)

    # 10. Footer
    p_footer = doc.add_paragraph()
    p_footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_footer.paragraph_format.space_before = Pt(12)
    p_footer.paragraph_format.space_after = Pt(0)
    r_ft = p_footer.add_run("© Disruptors Convention • Powered by EventSlot • Fast Gate Check-in")
    r_ft.font.name = "Arial"
    r_ft.font.size = Pt(8.5)
    r_ft.font.color.rgb = RGBColor(148, 163, 184)

    output_path = os.path.join(script_dir, "..", "public", "documents", "Disruptors_Convention_Registration_Sign.docx")
    doc.save(output_path)
    print("DOCX successfully generated at:", output_path)

if __name__ == "__main__":
    create_disruptors_doc()
