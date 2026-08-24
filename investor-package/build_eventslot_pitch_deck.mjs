import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const outputDir = path.resolve("investor-package");
const finalPptx = path.join(outputDir, "EventSlot_Investor_Pitch_Deck.pptx");

const metrics = {
  asOf: "August 6, 2026",
  users: 120,
  events: 45,
  registrations: 482,
  activeEvents: 13,
  organizersWithEvents: 27,
  organizersWith30PlusConfirmed: 4,
  proUsers: 1,
  freeUsers: 119,
  topEvents: [
    ["Disruptors Convention 7", 92],
    ["Disruptors Convention 6", 91],
    ["Children's Day Carnival", 50],
    ["Tum Sports Tournament", 38],
  ],
};

const funds = [
  ["Product and engineering", 28000],
  ["Growth and customer acquisition", 25000],
  ["Customer support and operations", 14000],
  ["Security and compliance", 12000],
  ["Cloud and infrastructure", 13000],
  ["Reserve and working capital", 8000],
];

const theme = {
  canvas: "#FFFFFF",
  ink: "#000000",
  muted: "#5B616B",
  panel: "#EDEDED",
  rule: "#B8BCC4",
  accent: "#6DCBF4",
  accentStrong: "#3D8DFF",
  panelDark: "#D9DDE3",
};

const frame = { left: 52, top: 38, width: 1176, height: 644 };

function addText(slide, text, left, top, width, height, style = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    position: { left, top, width, height },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    fontFace: "Helvetica Neue",
    color: style.color ?? theme.ink,
    fontSize: style.fontSize ?? 18,
    bold: style.bold ?? false,
    alignment: style.alignment ?? "left",
    valign: style.valign ?? "top",
    breakLine: style.breakLine ?? true,
  };
  return shape;
}

function addPanel(slide, left, top, width, height, fill = theme.panel, radius = "rounded-md") {
  return slide.shapes.add({
    geometry: "rect",
    position: { left, top, width, height },
    fill,
    line: { style: "solid", fill: theme.rule, width: 1 },
    borderRadius: radius,
  });
}

function addRule(slide, left, top, width) {
  slide.shapes.add({
    geometry: "rect",
    position: { left, top, width, height: 2 },
    fill: theme.rule,
    line: { style: "solid", fill: theme.rule, width: 0 },
  });
}

function addTitle(slide, eyebrow, title, subtitle) {
  addText(slide, eyebrow, frame.left, frame.top, 260, 24, {
    fontSize: 12,
    bold: true,
    color: theme.muted,
  });
  addText(slide, title, frame.left, frame.top + 44, 820, 90, {
    fontSize: 38,
    bold: true,
  });
  if (subtitle) {
    addText(slide, subtitle, frame.left, frame.top + 130, 880, 54, {
      fontSize: 21,
      color: theme.muted,
    });
  }
}

function addFooter(slide, slideNum, note = "EventSlot investor deck") {
  addText(slide, note, frame.left, 688, 500, 16, {
    fontSize: 10,
    color: theme.muted,
  });
  addText(slide, String(slideNum), 1195, 688, 20, 16, {
    fontSize: 10,
    color: theme.muted,
    alignment: "right",
  });
}

function addBulletList(slide, items, left, top, width, startY = 0) {
  let y = top + startY;
  for (const item of items) {
    addText(slide, "•", left, y, 18, 24, { fontSize: 19, bold: true });
    addText(slide, item, left + 18, y - 2, width - 18, 40, {
      fontSize: 18,
      color: theme.ink,
    });
    y += 38;
  }
}

async function buildDeck() {
  await fs.mkdir(outputDir, { recursive: true });

  const presentation = Presentation.create({
    slideSize: { width: 1280, height: 720 },
  });

  const slides = [];

  // 1 Cover
  {
    const slide = presentation.slides.add();
    slide.background.fill = theme.canvas;
    addText(slide, "EVENTSLOT", frame.left, 40, 180, 24, {
      fontSize: 12,
      bold: true,
      color: theme.muted,
    });
    addText(
      slide,
      "A working event operations platform for organizers",
      frame.left,
      132,
      760,
      120,
      { fontSize: 52, bold: true }
    );
    addText(
      slide,
      "Raising USD 100,000 for 10% equity to turn early usage into repeatable growth and paid conversion.",
      frame.left,
      286,
      650,
      80,
      { fontSize: 24, color: theme.muted }
    );
    addPanel(slide, 838, 104, 346, 458, theme.panel);
    addText(slide, "Round", 870, 136, 120, 28, { fontSize: 14, bold: true, color: theme.muted });
    addText(slide, "USD 100,000", 870, 168, 240, 46, { fontSize: 32, bold: true });
    addText(slide, "Pre-money valuation", 870, 246, 180, 24, { fontSize: 14, bold: true, color: theme.muted });
    addText(slide, "USD 900,000", 870, 276, 220, 36, { fontSize: 28, bold: true });
    addText(slide, "Post-money valuation", 870, 348, 180, 24, { fontSize: 14, bold: true, color: theme.muted });
    addText(slide, "USD 1,000,000", 870, 378, 240, 36, { fontSize: 28, bold: true });
    addText(slide, "Runway target", 870, 450, 120, 24, { fontSize: 14, bold: true, color: theme.muted });
    addText(slide, "12 months base,\nstretchable toward 18 months", 870, 480, 250, 72, {
      fontSize: 18,
      bold: true,
    });
    addFooter(slide, 1, "EventSlot | Nairobi, Kenya | August 2026");
    slides.push(slide);
  }

  // 2 Problem
  {
    const slide = presentation.slides.add();
    slide.background.fill = theme.canvas;
    addTitle(
      slide,
      "THE PROBLEM",
      "Event organizers still run one event across too many disconnected tools",
      "The result is manual work, weak visibility, and a messy attendee experience."
    );
    const left = 52;
    const top = 228;
    const colW = 270;
    const gap = 24;
    const cards = [
      ["Registration", "Google Forms or messages collect names, but operations remain manual."],
      ["Communication", "WhatsApp becomes the default inbox, with no clean event record."],
      ["Payments", "Mobile money confirmation is often handled manually and reconciled late."],
      ["Attendance", "Check-in happens on paper, spreadsheets, or improvised lists."],
    ];
    cards.forEach((card, i) => {
      const x = left + i * (colW + gap);
      addPanel(slide, x, top, colW, 270);
      addText(slide, card[0], x + 18, top + 20, colW - 36, 28, {
        fontSize: 22,
        bold: true,
      });
      addRule(slide, x + 18, top + 60, colW - 36);
      addText(slide, card[1], x + 18, top + 84, colW - 36, 150, {
        fontSize: 18,
        color: theme.muted,
      });
    });
    addFooter(slide, 2);
    slides.push(slide);
  }

  // 3 Solution
  {
    const slide = presentation.slides.add();
    slide.background.fill = theme.canvas;
    addTitle(
      slide,
      "THE SOLUTION",
      "EventSlot gives organizers one operating workflow from setup to event-day control",
      "Instead of switching between tools, organizers can create, manage, verify, and review events in one place."
    );
    const steps = [
      ["1. Create", "Set up event details, registration flow, questions, and capacity."],
      ["2. Share", "Publish one event link attendees can use to register."],
      ["3. Manage", "Track registrations, waitlists, attendee records, and operational status."],
      ["4. Deliver", "Support verification, event-day attendance handling, and reporting."],
    ];
    let y = 236;
    steps.forEach((step, i) => {
      addPanel(slide, 72, y, 1136, 82, i % 2 === 0 ? theme.panel : "#F7F7F7");
      addText(slide, step[0], 94, y + 19, 170, 30, { fontSize: 24, bold: true });
      addText(slide, step[1], 290, y + 17, 860, 40, { fontSize: 20, color: i === 3 ? theme.ink : theme.muted });
      y += 96;
    });
    addFooter(slide, 3);
    slides.push(slide);
  }

  // 4 Traction
  {
    const slide = presentation.slides.add();
    slide.background.fill = theme.canvas;
    addTitle(
      slide,
      "TRACTION",
      `EventSlot already has live usage, even though monetization is still early`,
      `Verified platform snapshot as of ${metrics.asOf}.`
    );
    const tiles = [
      ["Users", String(metrics.users)],
      ["Events created", String(metrics.events)],
      ["Registrations processed", String(metrics.registrations)],
      ["Active events", String(metrics.activeEvents)],
      ["Organizers with events", String(metrics.organizersWithEvents)],
      ["Paid users", String(metrics.proUsers)],
    ];
    tiles.forEach((tile, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const x = 72 + col * 376;
      const y = 220 + row * 150;
      addPanel(slide, x, y, 344, 118);
      addText(slide, tile[0], x + 18, y + 18, 220, 22, { fontSize: 15, bold: true, color: theme.muted });
      addText(slide, tile[1], x + 18, y + 50, 220, 44, { fontSize: 34, bold: true });
    });
    addText(
      slide,
      "What these numbers mean: EventSlot has real organizer and attendee activity, but this is still an early-validation business, not yet a mature revenue company.",
      72,
      548,
      1080,
      48,
      { fontSize: 19, color: theme.muted }
    );
    addFooter(slide, 4);
    slides.push(slide);
  }

  // 5 Usage evidence table
  {
    const slide = presentation.slides.add();
    slide.background.fill = theme.canvas;
    addTitle(
      slide,
      "USAGE EVIDENCE",
      "The product is already supporting real events with meaningful attendance volume",
      ""
    );
    const usageTable = slide.tables.add({
      rows: 5,
      columns: 3,
      left: 72,
      top: 210,
      width: 1136,
      height: 340,
      columnWidths: [760, 160, 216],
      values: [
        ["Event", "Confirmed attendees", "What it shows"],
        [metrics.topEvents[0][0], String(metrics.topEvents[0][1]), "Large organizer event handled live"],
        [metrics.topEvents[1][0], String(metrics.topEvents[1][1]), "Repeat-like usage at meaningful size"],
        [metrics.topEvents[2][0], String(metrics.topEvents[2][1]), "Broader event-type applicability"],
        [metrics.topEvents[3][0], String(metrics.topEvents[3][1]), "Operational relevance beyond one niche"],
      ],
    });
    usageTable.styleOptions = { headerRow: true, bandedRows: true };
    usageTable.borders.assign({ style: "solid", fill: theme.rule, width: 1 });
    for (let c = 0; c < 3; c += 1) {
      usageTable.getCell(0, c).fill = theme.panel;
      usageTable.getCell(0, c).text.style = {
        fontFace: "Helvetica Neue",
        fontSize: 16,
        bold: true,
        color: theme.ink,
      };
    }
    for (let r = 1; r < 5; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        usageTable.getCell(r, c).text.style = {
          fontFace: "Helvetica Neue",
          fontSize: 15,
          color: c === 2 ? theme.muted : theme.ink,
        };
      }
    }
    addText(
      slide,
      "This is still early traction, but it is better than a concept story: real organizers have already trusted EventSlot with live event operations.",
      72,
      586,
      1100,
      42,
      { fontSize: 18, color: theme.muted }
    );
    addFooter(slide, 5);
    slides.push(slide);
  }

  // 6 Customer focus
  {
    const slide = presentation.slides.add();
    slide.background.fill = theme.canvas;
    addTitle(
      slide,
      "BEACHHEAD MARKET",
      "EventSlot should focus first on organizer segments with repeated coordination pain",
      "The early opportunity is not every event organizer. It is the organizer who needs structure and repeats the workflow."
    );
    const segments = [
      ["Churches and ministry teams", "High coordination needs, repeated events, volunteer-heavy operations."],
      ["Universities and student organizations", "Multiple events, capacity issues, check-in and communication needs."],
      ["Training providers", "Registration, payments, attendance, and follow-up all matter."],
      ["Independent community organizers", "Need one workflow instead of improvised admin across several tools."],
    ];
    segments.forEach((seg, idx) => {
      const x = idx < 2 ? 72 : 650;
      const y = idx % 2 === 0 ? 232 : 402;
      addPanel(slide, x, y, 558, 134);
      addText(slide, seg[0], x + 18, y + 18, 340, 28, { fontSize: 22, bold: true });
      addText(slide, seg[1], x + 18, y + 58, 500, 52, { fontSize: 18, color: theme.muted });
    });
    addFooter(slide, 6);
    slides.push(slide);
  }

  // 7 Why now
  {
    const slide = presentation.slides.add();
    slide.background.fill = theme.canvas;
    addTitle(
      slide,
      "WHY NOW",
      "Event organization is becoming digital, but the workflow is still fragmented",
      "EventSlot exists because organizers increasingly expect digital coordination, yet many still operate with disconnected tools."
    );
    addBulletList(slide, [
      "Organizers want one link, one dashboard, and one source of truth.",
      "Attendees increasingly expect fast confirmation and smoother event-day flow.",
      "Mobile payments and digital registration behaviors are more normal than they were a few years ago.",
      "Communities, churches, universities, and training providers run recurring events but often lack purpose-built operating software."
    ], 88, 250, 560);
    addPanel(slide, 730, 236, 438, 338);
    addText(slide, "What this means commercially", 756, 262, 310, 26, {
      fontSize: 22,
      bold: true,
    });
    addRule(slide, 756, 298, 364);
    addText(
      slide,
      "The opening is not just ticketing. It is operational software for organizers who need registration, control, and visibility without enterprise complexity.",
      756,
      326,
      350,
      150,
      { fontSize: 20 }
    );
    addText(
      slide,
      "That is the gap EventSlot is trying to own early.",
      756,
      494,
      330,
      36,
      { fontSize: 21, bold: true, color: theme.accentStrong }
    );
    addFooter(slide, 7);
    slides.push(slide);
  }

  // 8 Business model
  {
    const slide = presentation.slides.add();
    slide.background.fill = theme.canvas;
    addTitle(
      slide,
      "BUSINESS MODEL",
      "The goal of this round is to prove which revenue streams convert first",
      "EventSlot already has a paid path, but it still needs stronger commercial validation."
    );
    const blocks = [
      ["Paid organizer plans", "Convert organizers who need more capacity, more control, or premium workflows."],
      ["Premium features", "Reporting, advanced workflow controls, or team-grade tools that solve real organizer pain."],
      ["Transaction-linked revenue", "Use paid-event workflows to create revenue tied to event activity."],
      ["Institutional packages", "Over time, sell structured packages to repeat organizer groups and institutions."],
    ];
    blocks.forEach((block, idx) => {
      const x = idx < 2 ? 72 : 650;
      const y = idx % 2 === 0 ? 242 : 402;
      addPanel(slide, x, y, 558, 128, idx === 0 ? theme.panel : "#F7F7F7");
      addText(slide, block[0], x + 18, y + 18, 350, 26, { fontSize: 22, bold: true });
      addText(slide, block[1], x + 18, y + 54, 510, 46, { fontSize: 18, color: theme.muted });
    });
    addFooter(slide, 8);
    slides.push(slide);
  }

  // 9 Go to market
  {
    const slide = presentation.slides.add();
    slide.background.fill = theme.canvas;
    addTitle(
      slide,
      "GO-TO-MARKET",
      "The first growth engine should be focused, founder-led, and segment-specific",
      "At this stage, repeatable customer understanding matters more than broad awareness spend."
    );
    const cols = [
      ["Phase 1", "Founder-led validation", ["Direct outreach", "Live demos", "Hands-on onboarding", "Pilot-style event support"]],
      ["Phase 2", "Beachhead expansion", ["Church/community clusters", "University groups", "Training providers", "Referral-driven growth"]],
      ["Phase 3", "Commercial discipline", ["Paid conversion", "Partner channels", "Stronger onboarding assets", "Support and retention loops"]],
    ];
    cols.forEach((col, idx) => {
      const x = 72 + idx * 376;
      addPanel(slide, x, 244, 344, 324, idx === 1 ? theme.panel : "#F7F7F7");
      addText(slide, col[0], x + 18, 266, 140, 22, { fontSize: 14, bold: true, color: theme.muted });
      addText(slide, col[1], x + 18, 296, 300, 52, { fontSize: 24, bold: true });
      addBulletList(slide, col[2], x + 18, 360, 300);
    });
    addFooter(slide, 9);
    slides.push(slide);
  }

  // 10 Use of funds with chart
  {
    const slide = presentation.slides.add();
    slide.background.fill = theme.canvas;
    addTitle(
      slide,
      "USE OF FUNDS",
      "This round is designed to buy 12 months of disciplined execution",
      "The spending logic is simple: strengthen product, acquire organizers, support customers, and build operating credibility."
    );
    slide.charts.add("bar", {
      position: { left: 72, top: 238, width: 620, height: 340 },
      categories: ["Product", "Growth", "Support", "Security", "Cloud", "Reserve"],
      series: [{ name: "USD allocation", values: funds.map((x) => x[1]), fill: theme.accentStrong }],
      hasLegend: false,
      dataLabels: { showValue: true, position: "outEnd" },
      xAxis: { visible: false },
      yAxis: {
        majorGridlines: { style: "solid", fill: "#E1E4E8", width: 1 },
      },
    });
    addPanel(slide, 736, 238, 432, 340);
    addText(slide, "Allocation logic", 762, 262, 220, 26, { fontSize: 22, bold: true });
    addRule(slide, 762, 298, 360);
    [
      "Product gets the largest share because product quality still drives conversion and retention.",
      "Growth spend is targeted toward organizer acquisition, demos, onboarding, and partnerships.",
      "Security, support, and infrastructure stay in the plan because investors expect operational seriousness.",
    ].forEach((text, idx) => {
      const y = 324 + idx * 80;
      addText(slide, String(idx + 1), 762, y, 22, 22, { fontSize: 14, bold: true, color: theme.muted });
      addText(slide, text, 790, y - 2, 332, 52, { fontSize: 17, color: theme.ink });
    });
    addFooter(slide, 10);
    slides.push(slide);
  }

  // 11 Milestones
  {
    const slide = presentation.slides.add();
    slide.background.fill = theme.canvas;
    addTitle(
      slide,
      "12-MONTH MILESTONES",
      "This round should prove that EventSlot can become a repeatable commercial business",
      "The outcome is not just more activity. It is stronger organizer retention, clearer monetization, and a better next-round story."
    );
    const milestones = [
      ["Product", "Improve reliability, event-day operations, and the quality of organizer workflows."],
      ["Growth", "Increase active organizers and repeat event creation in focused segments."],
      ["Revenue", "Turn early product value into more paid conversions and clearer pricing proof."],
      ["Operations", "Tighten support response, security posture, and reporting discipline."],
      ["Fundraising readiness", "Build a cleaner case for a stronger follow-on round."]
    ];
    let y = 232;
    milestones.forEach((m, idx) => {
      addPanel(slide, 72, y, 1136, 72, idx % 2 === 0 ? theme.panel : "#F7F7F7");
      addText(slide, m[0], 92, y + 19, 230, 28, { fontSize: 22, bold: true });
      addText(slide, m[1], 320, y + 17, 830, 34, { fontSize: 18, color: theme.muted });
      y += 86;
    });
    addFooter(slide, 11);
    slides.push(slide);
  }

  // 12 Round
  {
    const slide = presentation.slides.add();
    slide.background.fill = theme.canvas;
    addTitle(
      slide,
      "THE ROUND",
      "EventSlot is raising USD 100,000 to move from working product to stronger commercial proof",
      ""
    );
    addPanel(slide, 72, 224, 340, 250, theme.panel);
    addText(slide, "Raise", 96, 252, 120, 22, { fontSize: 14, bold: true, color: theme.muted });
    addText(slide, "USD 100,000", 96, 282, 220, 42, { fontSize: 34, bold: true });
    addText(slide, "Pre-money", 96, 346, 120, 22, { fontSize: 14, bold: true, color: theme.muted });
    addText(slide, "USD 900,000", 96, 374, 220, 34, { fontSize: 28, bold: true });
    addText(slide, "Equity", 96, 426, 120, 22, { fontSize: 14, bold: true, color: theme.muted });
    addText(slide, "10%", 96, 454, 120, 34, { fontSize: 28, bold: true });
    addPanel(slide, 446, 224, 762, 250, "#F7F7F7");
    addText(
      slide,
      "Why this round now",
      476,
      252,
      240,
      26,
      { fontSize: 22, bold: true }
    );
    addBulletList(slide, [
      "The product already works and has live usage.",
      "The company now needs focused capital to turn early adoption into stronger repeatability and paid demand.",
      "A small, disciplined round fits the stage better than pretending EventSlot is already at full seed-scale maturity."
    ], 476, 304, 670);
    addText(
      slide,
      "Target runway: 12 months base, stretchable toward 18 months with disciplined execution.",
      72,
      548,
      1080,
      32,
      { fontSize: 21, bold: true, color: theme.accentStrong }
    );
    addFooter(slide, 12);
    slides.push(slide);
  }

  // 13 Close
  {
    const slide = presentation.slides.add();
    slide.background.fill = theme.canvas;
    addText(slide, "EVENTSLOT", 52, 40, 180, 24, {
      fontSize: 12,
      bold: true,
      color: theme.muted,
    });
    addText(
      slide,
      "A working product.\nReal organizer usage.\nA focused round to prove the business can scale.",
      52,
      154,
      760,
      220,
      { fontSize: 48, bold: true }
    );
    addText(
      slide,
      "Raising USD 100,000 at a USD 900,000 pre-money valuation.",
      52,
      418,
      700,
      40,
      { fontSize: 24, color: theme.muted }
    );
    addPanel(slide, 856, 164, 300, 238, theme.panel);
    addText(slide, "What this unlocks", 880, 190, 200, 24, { fontSize: 20, bold: true });
    addBulletList(slide, [
      "Stronger product reliability",
      "More active organizers",
      "Cleaner paid conversion proof",
      "Better next-round readiness"
    ], 880, 230, 230);
    addText(slide, "daniel@eventslot\nNairobi, Kenya", 52, 584, 280, 56, {
      fontSize: 20,
      bold: true,
    });
    addFooter(slide, 13, "EventSlot | Investor package");
    slides.push(slide);
  }

  for (const [index, slide] of slides.entries()) {
    slide.speakerNotes.textFrame.setText(`[Sources]
- Internal EventSlot traction snapshot as of ${metrics.asOf}; investor-package/data-room/traction_snapshot.json
- Internal round terms and use-of-funds assumptions prepared for this investor package
`);
    slide.speakerNotes.setVisible(true);
    const stem = `deck-slide-${String(index + 1).padStart(2, "0")}`;
    const png = await presentation.export({ slide, format: "png", scale: 1 });
    await fs.writeFile(path.join(outputDir, `${stem}.png`), new Uint8Array(await png.arrayBuffer()));
  }

  const montage = await presentation.export({ format: "webp", montage: true, scale: 1 });
  await fs.writeFile(path.join(outputDir, "deck-montage.webp"), new Uint8Array(await montage.arrayBuffer()));

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(finalPptx);
}

buildDeck().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
