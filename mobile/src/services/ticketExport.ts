import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import QRCode from "qrcode";

import { NativeEvent } from "../domain/events";
import { NativeRegistrationPreview } from "../domain/registrations";

export async function exportTicketPdf(input: {
  event: NativeEvent;
  registration: NativeRegistrationPreview;
  ticketCode: string;
}): Promise<{ shared: boolean; message: string; uri?: string }> {
  const qrCodeDataUrl = await QRCode.toDataURL(input.ticketCode, {
    color: {
      dark: "#0A0A0A",
      light: "#FFFFFF"
    },
    errorCorrectionLevel: "M",
    margin: 1,
    width: 280
  });

  const printed = await Print.printToFileAsync({
    html: buildTicketHtml(input, qrCodeDataUrl)
  });
  const exportUri = printed.uri;

  if (!(await Sharing.isAvailableAsync())) {
    return {
      shared: false,
      message: "Ticket PDF was created on-device, but sharing is unavailable on this platform.",
      uri: exportUri
    };
  }

  await Sharing.shareAsync(exportUri, {
    UTI: ".pdf",
    mimeType: "application/pdf"
  });

  return {
    shared: true,
    message: "Ticket PDF is ready to save or share.",
    uri: exportUri
  };
}

function buildTicketHtml(
  input: {
    event: NativeEvent;
    registration: NativeRegistrationPreview;
    ticketCode: string;
  },
  qrCodeDataUrl: string
) {
  const tierLabel =
    input.registration.tierLabel ?? (input.event.monetization === "paid" ? input.event.entryFeeLabel ?? "Paid entry" : "General");
  const eventMeta = [input.event.dateLabel, input.event.timeLabel, input.event.venue].filter(Boolean).join(" | ");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(input.event.title)} Ticket</title>
    <style>
      body {
        background: #0A0A0A;
        color: #FFFFFF;
        font-family: Helvetica, Arial, sans-serif;
        margin: 0;
        padding: 32px 24px;
      }
      .ticket {
        border: 1px solid #27272A;
        border-radius: 24px;
        padding: 28px;
        background: #111111;
      }
      .brand {
        color: #C8F55A;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 1.8px;
        text-transform: uppercase;
      }
      h1 {
        font-family: Georgia, "Times New Roman", serif;
        font-size: 34px;
        font-weight: 400;
        line-height: 1.1;
        margin: 18px 0 8px;
      }
      .meta {
        color: #A1A1AA;
        font-size: 14px;
        line-height: 1.5;
        margin-bottom: 18px;
      }
      .card {
        border: 1px solid #27272A;
        border-radius: 18px;
        padding: 18px;
        background: #18181B;
      }
      .row {
        margin-bottom: 10px;
      }
      .label {
        color: #A1A1AA;
        display: block;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 1.1px;
        margin-bottom: 4px;
        text-transform: uppercase;
      }
      .value {
        color: #FFFFFF;
        font-size: 16px;
        line-height: 1.4;
      }
      .tier {
        color: #C8F55A;
      }
      .qr-shell {
        margin-top: 22px;
        text-align: center;
      }
      .qr-box {
        background: #FFFFFF;
        border-radius: 20px;
        display: inline-block;
        padding: 18px;
      }
      .qr-box img {
        display: block;
        height: 180px;
        width: 180px;
      }
      .ticket-code {
        color: #C8F55A;
        font-size: 18px;
        font-weight: 700;
        letter-spacing: 2px;
        margin-top: 14px;
      }
      .footer {
        color: #71717A;
        font-size: 12px;
        line-height: 1.5;
        margin-top: 20px;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div class="ticket">
      <div class="brand">EventSlot</div>
      <h1>${escapeHtml(input.event.title)}</h1>
      <div class="meta">${escapeHtml(eventMeta)}</div>

      <div class="card">
        <div class="row">
          <span class="label">Name</span>
          <span class="value">${escapeHtml(input.registration.attendeeName)}</span>
        </div>
        ${buildOptionalRow("Email", input.registration.attendeeEmail)}
        ${buildOptionalRow("Phone", input.registration.attendeePhone)}
        <div class="row">
          <span class="label">Ticket Type</span>
          <span class="value tier">${escapeHtml(tierLabel)}</span>
        </div>
      </div>

      <div class="qr-shell">
        <div class="qr-box">
          <img alt="Ticket QR code" src="${qrCodeDataUrl}" />
        </div>
        <div class="ticket-code">${escapeHtml(input.ticketCode)}</div>
      </div>

      <div class="footer">Generated from the EventSlot mobile attendee detail screen.</div>
    </div>
  </body>
</html>`;
}

function buildOptionalRow(label: string, value?: string) {
  if (!value?.trim()) {
    return "";
  }

  return `<div class="row"><span class="label">${escapeHtml(label)}</span><span class="value">${escapeHtml(value)}</span></div>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
