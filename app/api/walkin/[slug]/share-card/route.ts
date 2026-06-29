import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import {
  formatWalkInLongDayLabel,
  getWalkInDayKey,
  getWalkInDayPosition,
  getWalkInDayRange,
} from "@/lib/walkInEvents"

export const runtime = "nodejs"

const WALK_IN_TIME_ZONE = "Africa/Nairobi"

function parseDayIndex(rawDay: string | null, totalDays: number) {
  if (!rawDay) return null
  const parsed = Number(rawDay)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > totalDays) return null
  return parsed
}

function parsePositiveInt(rawValue: string | null) {
  if (!rawValue) return null
  const parsed = Number(rawValue)
  if (!Number.isInteger(parsed) || parsed < 1) return null
  return parsed
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function wrapSvgText(text: string, maxCharsPerLine: number) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return [""]

  const lines: string[] = []
  let current = ""

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= maxCharsPerLine) {
      current = candidate
      continue
    }
    if (current) lines.push(current)
    current = word
  }

  if (current) lines.push(current)
  return lines.slice(0, 4)
}

function buildShareCardSvg(params: {
  title: string
  dayLabel: string
  attendeeName: string
  checkinNumber: number | null
}) {
  const titleLines = wrapSvgText(params.title, 18)
  const titleTspans = titleLines
    .map((line, index) => {
      const dy = index === 0 ? 0 : 86
      return `<tspan x="72" dy="${dy}">${escapeXml(line)}</tspan>`
    })
    .join("")

  const attendeeName = escapeXml(params.attendeeName || "Event guest")
  const dayLabel = escapeXml(params.dayLabel)
  const checkinLine = params.checkinNumber
    ? `<text x="72" y="1328" fill="#C8F55A" font-size="30" font-weight="700">Check-in number #${params.checkinNumber}</text>`
    : ""

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920" role="img" aria-label="Walk-in share card">
  <rect width="1080" height="1920" fill="#0A0A0A" />
  <rect x="0" y="0" width="1080" height="1920" fill="url(#bg)" />
  <rect x="60" y="60" width="960" height="1800" rx="36" fill="none" stroke="rgba(200,245,90,0.18)" />

  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0A0A0A" />
      <stop offset="100%" stop-color="#111722" />
    </linearGradient>
  </defs>

  <circle cx="84" cy="98" r="10" fill="#C8F55A" />
  <text x="110" y="106" fill="#C8F55A" font-size="26" font-weight="700">EventSlot</text>

  <text x="72" y="236" fill="#C8F55A" font-size="30" font-weight="700">Welcome to</text>
  <text x="72" y="348" fill="#F0EDE6" font-size="78" font-weight="700">
    ${titleTspans}
  </text>
  <text x="72" y="690" fill="#C8F55A" font-size="34" font-weight="600">${dayLabel}</text>

  <rect x="72" y="1038" width="936" height="380" rx="28" fill="rgba(255,255,255,0.05)" stroke="rgba(200,245,90,0.2)" />
  <text x="72" y="1112" fill="rgba(240,237,230,0.72)" font-size="26">Checked in attendee</text>
  <text x="72" y="1196" fill="#F0EDE6" font-size="52" font-weight="700">${attendeeName}</text>
  ${checkinLine}
  <text x="72" y="1392" fill="rgba(240,237,230,0.82)" font-size="28">Thanks for being part of this moment.</text>

  <text x="540" y="1738" fill="#F0EDE6" font-size="24" font-weight="700" text-anchor="middle">Powered by EventSlot</text>
  <text x="540" y="1780" fill="rgba(240,237,230,0.78)" font-size="20" text-anchor="middle">Check us out at www.eventsslot.com</text>
</svg>`
}

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await props.params
    const { searchParams } = new URL(req.url)
    const requestedDay = searchParams.get("day")
    const attendeeName = (searchParams.get("name") ?? "").trim().slice(0, 56)
    const checkinNumber = parsePositiveInt(searchParams.get("spot"))
    const shouldDownload = searchParams.get("download") === "1"

    const event = await prisma.event.findUnique({
      where: { slug },
      select: {
        title: true,
        accessType: true,
        eventDate: true,
        eventEndAt: true,
      },
    })

    if (!event || event.accessType !== "WALK_IN") {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    const dayRange = getWalkInDayRange({
      eventDate: event.eventDate,
      eventEndAt: event.eventEndAt,
      timeZone: WALK_IN_TIME_ZONE,
    })

    if (dayRange.length === 0) {
      return NextResponse.json({ error: "Walk-in dates are not configured" }, { status: 400 })
    }

    const todayKey = getWalkInDayKey(new Date(), WALK_IN_TIME_ZONE)
    const todayIndex = dayRange.findIndex((dayKey) => dayKey === todayKey)
    const fallbackDayIndex = todayIndex >= 0 ? todayIndex + 1 : 1
    const dayIndex = parseDayIndex(requestedDay, dayRange.length) ?? fallbackDayIndex
    const dayKey = dayRange[dayIndex - 1]
    const dayPosition = getWalkInDayPosition({
      dayKey,
      eventDate: event.eventDate,
      eventEndAt: event.eventEndAt,
      timeZone: WALK_IN_TIME_ZONE,
    })

    const dayLabel = `${dayPosition && dayPosition.total > 1 ? `Day ${dayPosition.index} of ${dayPosition.total} - ` : ""}${formatWalkInLongDayLabel(dayKey, WALK_IN_TIME_ZONE)}`
    const svg = buildShareCardSvg({
      title: event.title,
      dayLabel,
      attendeeName,
      checkinNumber,
    })

    const response = new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "private, no-store",
      },
    })

    if (shouldDownload) {
      response.headers.set("Content-Disposition", `attachment; filename="${slug}-walkin-poster.svg"`)
    }

    return response
  } catch (error) {
    console.error("[WALKIN SHARE CARD]", error)
    return NextResponse.json({ error: "Unable to generate share card." }, { status: 500 })
  }
}
