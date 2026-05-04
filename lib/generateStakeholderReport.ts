import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx"
import { askAI } from "./ai"

const LIME = "7AB648"
const NAVY = "0D1B2A"
const WHITE = "FFFFFF"
const GREY = "888888"
const BORDER = { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" }
const NO_BD = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }

export interface StakeholderReportData {
  period: "weekly" | "monthly" | "yearly"
  periodLabel: string
  generatedAt: Date

  newUsers: number
  totalUsers: number
  newEvents: number
  totalEvents: number
  newRegistrations: number
  totalRegistrations: number
  activeEvents: number
  reportDownloadsPurchased: number
  revenueKsh: number

  prevNewUsers: number
  prevNewEvents: number
  prevNewRegistrations: number

  topEvents: Array<{
    title: string
    registrations: number
    capacity: number | null
    organizer: string
  }>

  errorCount: number
  topErrors: Array<{ route: string; count: number; message: string }>
  failedEmailCount: number

  freeUsers: number
  proUsers: number
  businessUsers: number
}

function pct(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? "+100%" : "0%"
  const change = ((current - previous) / previous) * 100
  return (change >= 0 ? "+" : "") + change.toFixed(1) + "%"
}

function headerRow(labels: string[], widths: number[]) {
  return new TableRow({
    tableHeader: true,
    children: labels.map((label, i) =>
      new TableCell({
        width: { size: widths[i], type: WidthType.DXA },
        shading: { fill: NAVY, type: ShadingType.CLEAR },
        borders: { top: NO_BD, bottom: NO_BD, left: NO_BD, right: NO_BD },
        margins: { top: 100, bottom: 100, left: 120, right: 120 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: label, font: "Arial", size: 18, bold: true, color: WHITE })],
          }),
        ],
      }),
    ),
  })
}

function dataRow(values: string[], widths: number[], shade = false) {
  return new TableRow({
    children: values.map((value, i) =>
      new TableCell({
        width: { size: widths[i], type: WidthType.DXA },
        shading: { fill: shade ? "F5F7FA" : WHITE, type: ShadingType.CLEAR },
        borders: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [
          new Paragraph({
            alignment: i > 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
            children: [new TextRun({ text: value, font: "Arial", size: 19, color: "333333" })],
          }),
        ],
      }),
    ),
  })
}

export async function generateStakeholderReport(data: StakeholderReportData): Promise<Buffer> {
  const recommendationsText =
    (await askAI({
      system:
        "You are an expert business analyst writing a stakeholder report for a SaaS platform. Write in professional, concise English. Provide 3-4 specific, actionable recommendations based on the data provided.",
      prompt: `EventSlot platform data for ${data.periodLabel}:
- New users: ${data.newUsers} (${pct(data.newUsers, data.prevNewUsers)} vs previous period)
- New events: ${data.newEvents} (${pct(data.newEvents, data.prevNewEvents)} vs previous)
- New registrations: ${data.newRegistrations} (${pct(data.newRegistrations, data.prevNewRegistrations)} vs previous)
- Active events: ${data.activeEvents}
- System errors: ${data.errorCount}
- Failed emails: ${data.failedEmailCount}
- Revenue: KSh ${data.revenueKsh}

Write 3-4 specific recommendations for the platform team based on this data.
Keep each recommendation to 2-3 sentences. Focus on growth, reliability, and user experience.`,
      taskType: "qa",
      maxTokens: 400,
    })) ??
    "Recommendations could not be generated automatically. Please review the metrics above and identify areas for improvement."

  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 22 } } },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 36, bold: true, font: "Arial", color: NAVY },
          paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0 },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 28, bold: true, font: "Arial", color: "2A4A6A" },
          paragraph: { spacing: { before: 300, after: 160 }, outlineLevel: 1 },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LIME, space: 4 } },
                spacing: { before: 0, after: 160 },
                children: [
                  new TextRun({ text: "EventSlot", font: "Arial", size: 18, bold: true, color: NAVY }),
                  new TextRun({ text: `  ·  Stakeholder Report  ·  ${data.periodLabel}`, font: "Arial", size: 18, color: GREY }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                border: { top: { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD", space: 4 } },
                spacing: { before: 160, after: 0 },
                children: [
                  new TextRun({ text: "Confidential  ·  EventSlot  ·  www.eventsslot.com  ·  Page ", font: "Arial", size: 16, color: GREY }),
                  new TextRun({ children: [PageNumber.CURRENT] }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 1440, after: 80 },
            children: [
              new TextRun({ text: "Event", font: "Arial", size: 80, bold: true, color: NAVY }),
              new TextRun({ text: "Slot", font: "Arial", size: 80, bold: true, color: LIME }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 200 },
            children: [
              new TextRun({
                text: `${data.period.charAt(0).toUpperCase() + data.period.slice(1)} Stakeholder Report`,
                font: "Arial",
                size: 32,
                color: GREY,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            border: {
              top: { style: BorderStyle.SINGLE, size: 4, color: LIME, space: 8 },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: LIME, space: 8 },
            },
            spacing: { before: 200, after: 200 },
            children: [new TextRun({ text: data.periodLabel.toUpperCase(), font: "Arial", size: 24, bold: true, color: NAVY, allCaps: true })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 0 },
            children: [
              new TextRun({
                text: `Generated ${data.generatedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`,
                font: "Arial",
                size: 20,
                color: GREY,
              }),
            ],
          }),
          new Paragraph({ pageBreakBefore: true, children: [] }),

          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: "Executive Summary", font: "Arial", size: 36, bold: true, color: NAVY })],
          }),
          new Paragraph({
            spacing: { before: 80, after: 200 },
            children: [
              new TextRun({
                text: `This report covers EventSlot platform activity for ${data.periodLabel}. The platform currently has ${data.totalUsers.toLocaleString()} registered organizers, ${data.totalEvents.toLocaleString()} events created, and ${data.totalRegistrations.toLocaleString()} total registrations processed since launch.`,
                font: "Arial",
                size: 22,
                color: "333333",
              }),
            ],
          }),

          new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [3120, 2080, 2080, 2080],
            rows: [
              headerRow(["Metric", "This Period", "Previous Period", "Change"], [3120, 2080, 2080, 2080]),
              dataRow(["New Users", String(data.newUsers), String(data.prevNewUsers), pct(data.newUsers, data.prevNewUsers)], [3120, 2080, 2080, 2080]),
              dataRow(["New Events", String(data.newEvents), String(data.prevNewEvents), pct(data.newEvents, data.prevNewEvents)], [3120, 2080, 2080, 2080], true),
              dataRow(
                ["New Registrations", String(data.newRegistrations), String(data.prevNewRegistrations), pct(data.newRegistrations, data.prevNewRegistrations)],
                [3120, 2080, 2080, 2080],
              ),
              dataRow(["Revenue (KSh)", String(data.revenueKsh), "—", "—"], [3120, 2080, 2080, 2080], true),
            ],
          }),
          new Paragraph({ spacing: { before: 260, after: 0 }, children: [] }),

          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: "Chart Notes (Text)", font: "Arial", size: 28, bold: true, color: "2A4A6A" })],
          }),
          new Paragraph({
            spacing: { before: 60, after: 120 },
            children: [
              new TextRun({
                text: `Growth trend narrative: Users changed ${pct(data.newUsers, data.prevNewUsers)}, events changed ${pct(data.newEvents, data.prevNewEvents)}, and registrations changed ${pct(data.newRegistrations, data.prevNewRegistrations)} compared with the previous period.`,
                font: "Arial",
                size: 22,
                color: "333333",
              }),
            ],
          }),
          new Paragraph({ pageBreakBefore: true, children: [] }),

          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: "Platform Overview", font: "Arial", size: 36, bold: true, color: NAVY })],
          }),
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [4680, 4680],
            rows: [
              headerRow(["Metric", "Value"], [4680, 4680]),
              dataRow(["Total Registered Users", data.totalUsers.toLocaleString()], [4680, 4680]),
              dataRow(["Total Events Created", data.totalEvents.toLocaleString()], [4680, 4680], true),
              dataRow(["Total Registrations", data.totalRegistrations.toLocaleString()], [4680, 4680]),
              dataRow(["Active Events Right Now", String(data.activeEvents)], [4680, 4680], true),
              dataRow(["Report Downloads Purchased", String(data.reportDownloadsPurchased)], [4680, 4680]),
              dataRow(["Total Revenue This Period", `KSh ${data.revenueKsh.toLocaleString()}`], [4680, 4680], true),
            ],
          }),
          new Paragraph({ spacing: { before: 300, after: 0 }, children: [] }),

          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: "Plan Mix", font: "Arial", size: 28, bold: true, color: "2A4A6A" })],
          }),
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [3120, 3120, 3120],
            rows: [
              headerRow(["Free", "Pro", "Business"], [3120, 3120, 3120]),
              dataRow([String(data.freeUsers), String(data.proUsers), String(data.businessUsers)], [3120, 3120, 3120]),
            ],
          }),
          new Paragraph({ spacing: { before: 300, after: 0 }, children: [] }),

          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: "Top Events This Period", font: "Arial", size: 28, bold: true, color: "2A4A6A" })],
          }),
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [3600, 1800, 1800, 2160],
            rows: [
              headerRow(["Event", "Registrations", "Capacity", "Organizer"], [3600, 1800, 1800, 2160]),
              ...data.topEvents.slice(0, 10).map((event, i) =>
                dataRow(
                  [
                    event.title,
                    String(event.registrations),
                    event.capacity ? String(event.capacity) : "Unlimited",
                    event.organizer,
                  ],
                  [3600, 1800, 1800, 2160],
                  i % 2 === 0,
                ),
              ),
            ],
          }),
          new Paragraph({ spacing: { before: 300, after: 0 }, children: [] }),
          new Paragraph({ pageBreakBefore: true, children: [] }),

          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: "System Health", font: "Arial", size: 36, bold: true, color: NAVY })],
          }),
          new Paragraph({
            spacing: { before: 80, after: 200 },
            children: [
              new TextRun({
                text: `${data.errorCount} API errors were logged during this period. ${data.failedEmailCount} emails failed to deliver.`,
                font: "Arial",
                size: 22,
                color: data.errorCount > 50 ? "CC3333" : "226633",
              }),
            ],
          }),

          ...(data.topErrors.length > 0
            ? [
                new Paragraph({
                  heading: HeadingLevel.HEADING_2,
                  children: [new TextRun({ text: "Top Error Routes", font: "Arial", size: 28, bold: true, color: "2A4A6A" })],
                }),
                new Table({
                  width: { size: 9360, type: WidthType.DXA },
                  columnWidths: [3120, 1560, 4680],
                  rows: [
                    headerRow(["Route", "Count", "Last Error"], [3120, 1560, 4680]),
                    ...data.topErrors.slice(0, 5).map((error, i) =>
                      dataRow([error.route, String(error.count), error.message.slice(0, 80)], [3120, 1560, 4680], i % 2 === 0),
                    ),
                  ],
                }),
              ]
            : [
                new Paragraph({
                  spacing: { before: 80, after: 80 },
                  children: [new TextRun({ text: "No significant errors recorded this period.", font: "Arial", size: 22, color: "226633" })],
                }),
              ]),

          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: "Challenges & Issues", font: "Arial", size: 28, bold: true, color: "2A4A6A" })],
          }),
          new Paragraph({
            spacing: { before: 60, after: 220 },
            children: [
              new TextRun({
                text:
                  data.topErrors.length > 0
                    ? `Primary reliability concerns are concentrated around ${data.topErrors[0]?.route ?? "unknown routes"}. Email flow contributed ${data.failedEmailCount} failed operations and should be monitored for provider and retry issues.`
                    : "No major reliability challenges were detected from error logs in this reporting window.",
                font: "Arial",
                size: 22,
                color: "333333",
              }),
            ],
          }),
          new Paragraph({ pageBreakBefore: true, children: [] }),

          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: "Recommendations", font: "Arial", size: 36, bold: true, color: NAVY })],
          }),
          new Paragraph({
            spacing: { before: 0, after: 80 },
            children: [new TextRun({ text: "AI-generated based on platform data:", font: "Arial", size: 19, color: GREY, italics: true })],
          }),
          new Paragraph({
            spacing: { before: 80, after: 200 },
            children: [new TextRun({ text: recommendationsText, font: "Arial", size: 22, color: "333333" })],
          }),

          new Paragraph({
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: LIME, space: 8 } },
            spacing: { before: 400, after: 200 },
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "EventSlot  ·  www.eventsslot.com  ·  Confidential", font: "Arial", size: 20, color: GREY })],
          }),
        ],
      },
    ],
  })

  return Packer.toBuffer(doc)
}