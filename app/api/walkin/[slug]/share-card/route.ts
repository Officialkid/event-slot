import { NextRequest, NextResponse } from "next/server"
import sharp from "sharp"
import prisma from "@/lib/prisma"
import {
  formatWalkInLongDayLabel,
  getWalkInDayKey,
  getWalkInDayPosition,
  getWalkInDayRange,
} from "@/lib/walkInEvents"

export const runtime = "nodejs"

const WALK_IN_TIME_ZONE = "Africa/Nairobi"
const SHARE_CARD_FONT_STACK = "'DejaVu Sans', Arial, sans-serif"

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

function truncateText(text: string, maxLength: number) {
  const normalized = text.trim()
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 3).trimEnd()}...`
}

async function preparePosterDataUri(imageUrl: string | null) {
  if (!imageUrl) return null

  try {
    const url = new URL(imageUrl)
    if (url.protocol !== "https:" && url.protocol !== "http:") return null

    const response = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "User-Agent": "EventSlot Share Card Renderer/1.0",
      },
    })
    if (!response.ok) return null
    const contentType = response.headers.get("content-type") ?? ""
    if (!contentType.toLowerCase().startsWith("image/")) return null

    const source = Buffer.from(await response.arrayBuffer())
    if (source.byteLength > 12 * 1024 * 1024) return null

    const poster = await sharp(source)
      .rotate()
      .resize(936, 760, { fit: "cover", position: "centre" })
      .jpeg({ quality: 86 })
      .toBuffer()

    return `data:image/jpeg;base64,${poster.toString("base64")}`
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error"
    console.error("[walkin/share-card] poster fetch failed:", { imageUrl, message })
    return null
  }
}

function buildShareCardSvg(params: {
  title: string
  dayLabel: string
  attendeeName: string
  checkinNumber: number | null
  location: string | null
  posterDataUri: string | null
}) {
  const titleLines = wrapSvgText(params.title, 24).slice(0, 3)
  const titleTspans = titleLines
    .map((line, index) => {
      const dy = index === 0 ? 0 : 66
      return `<tspan x="96" dy="${dy}">${escapeXml(line)}</tspan>`
    })
    .join("")

  const attendeeName = escapeXml(truncateText(params.attendeeName || "Event guest", 28))
  const dayLabel = escapeXml(truncateText(params.dayLabel, 62))
  const location = escapeXml(truncateText(params.location || "See event page for venue details", 58))
  const checkinNumber = params.checkinNumber ? `#${params.checkinNumber}` : "Confirmed"
  const poster = params.posterDataUri
    ? `<image href="${params.posterDataUri}" x="72" y="182" width="936" height="760" preserveAspectRatio="xMidYMid slice" />`
    : `<rect x="72" y="182" width="936" height="760" fill="url(#posterFallback)" />
       <circle cx="862" cy="318" r="230" fill="#FF725E" opacity="0.45" />
       <circle cx="214" cy="804" r="260" fill="#18A999" opacity="0.4" />
       <text x="540" y="560" fill="#FFF8EB" font-family="${SHARE_CARD_FONT_STACK}" font-size="58" font-weight="800" text-anchor="middle">${escapeXml(params.title)}</text>`

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920" role="img" aria-label="Walk-in share card">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FF725E" />
      <stop offset="46%" stop-color="#F5B942" />
      <stop offset="100%" stop-color="#18A999" />
    </linearGradient>
    <linearGradient id="posterFallback" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#143642" />
      <stop offset="100%" stop-color="#0B132B" />
    </linearGradient>
    <linearGradient id="posterShade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="55%" stop-color="#071013" stop-opacity="0" />
      <stop offset="100%" stop-color="#071013" stop-opacity="0.82" />
    </linearGradient>
    <clipPath id="posterClip"><rect x="72" y="182" width="936" height="760" rx="42" /></clipPath>
    <filter id="shadow"><feDropShadow dx="0" dy="24" stdDeviation="28" flood-color="#18201D" flood-opacity="0.28" /></filter>
  </defs>

  <rect width="1080" height="1920" fill="url(#bg)" />
  <circle cx="1010" cy="80" r="230" fill="#FFF4D6" opacity="0.22" />
  <circle cx="50" cy="1880" r="260" fill="#0B5D5B" opacity="0.18" />

  <text x="72" y="108" fill="#132A2F" font-family="${SHARE_CARD_FONT_STACK}" font-size="30" font-weight="900" letter-spacing="2">EVENTSLOT</text>
  <text x="1008" y="108" fill="#132A2F" font-family="${SHARE_CARD_FONT_STACK}" font-size="24" font-weight="700" text-anchor="end">I WAS HERE</text>

  <g clip-path="url(#posterClip)" filter="url(#shadow)">
    ${poster}
    <rect x="72" y="182" width="936" height="760" fill="url(#posterShade)" />
  </g>
  <rect x="72" y="182" width="936" height="760" rx="42" fill="none" stroke="#FFF8EB" stroke-width="5" />
  <rect x="96" y="836" width="330" height="58" rx="29" fill="#F7FF58" />
  <text x="261" y="875" fill="#143642" font-family="${SHARE_CARD_FONT_STACK}" font-size="25" font-weight="900" text-anchor="middle">CHECKED IN</text>

  <rect x="48" y="990" width="984" height="750" rx="52" fill="#FFF8EB" filter="url(#shadow)" />
  <text x="96" y="1070" fill="#DB4D3F" font-family="${SHARE_CARD_FONT_STACK}" font-size="24" font-weight="900" letter-spacing="3">I ATTENDED</text>
  <text x="96" y="1150" fill="#132A2F" font-family="${SHARE_CARD_FONT_STACK}" font-size="54" font-weight="900">${titleTspans}</text>

  <line x1="96" y1="1320" x2="984" y2="1320" stroke="#132A2F" stroke-opacity="0.14" stroke-width="3" />
  <text x="96" y="1380" fill="#6B6058" font-family="${SHARE_CARD_FONT_STACK}" font-size="22" font-weight="700">ATTENDEE</text>
  <text x="96" y="1436" fill="#132A2F" font-family="${SHARE_CARD_FONT_STACK}" font-size="42" font-weight="900">${attendeeName}</text>

  <text x="780" y="1380" fill="#6B6058" font-family="${SHARE_CARD_FONT_STACK}" font-size="22" font-weight="700">REG. NUMBER</text>
  <text x="780" y="1436" fill="#DB4D3F" font-family="${SHARE_CARD_FONT_STACK}" font-size="42" font-weight="900">${checkinNumber}</text>

  <text x="96" y="1532" fill="#6B6058" font-family="${SHARE_CARD_FONT_STACK}" font-size="22" font-weight="700">WHEN</text>
  <text x="96" y="1576" fill="#132A2F" font-family="${SHARE_CARD_FONT_STACK}" font-size="27" font-weight="800">${dayLabel}</text>
  <text x="96" y="1652" fill="#6B6058" font-family="${SHARE_CARD_FONT_STACK}" font-size="22" font-weight="700">WHERE</text>
  <text x="96" y="1696" fill="#132A2F" font-family="${SHARE_CARD_FONT_STACK}" font-size="27" font-weight="800">${location}</text>

  <text x="72" y="1810" fill="#132A2F" font-family="${SHARE_CARD_FONT_STACK}" font-size="28" font-weight="900">Create. Share. Fill every slot.</text>
  <text x="72" y="1860" fill="#132A2F" font-family="${SHARE_CARD_FONT_STACK}" font-size="25" font-weight="700">Create your event at www.eventsslot.com</text>
  <circle cx="970" cy="1830" r="48" fill="#132A2F" />
  <text x="970" y="1841" fill="#F7FF58" font-family="${SHARE_CARD_FONT_STACK}" font-size="34" font-weight="900" text-anchor="middle">E</text>
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
        imageUrl: true,
        location: true,
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
    const posterDataUri = await preparePosterDataUri(event.imageUrl)
    const svg = buildShareCardSvg({
      title: event.title,
      dayLabel,
      attendeeName,
      checkinNumber,
      location: event.location,
      posterDataUri,
    })
    const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer()

    const response = new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
      },
    })

    if (shouldDownload) {
      response.headers.set("Content-Disposition", `attachment; filename="${slug}-walkin-poster.png"`)
    }

    return response
  } catch (error) {
    console.error("[WALKIN SHARE CARD]", error)
    return NextResponse.json({ error: "Unable to generate share card." }, { status: 500 })
  }
}
