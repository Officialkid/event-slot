import { ImageResponse } from "next/og"
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

    const response = new ImageResponse(
      (
        <div
          style={{
            background: "#0A0A0A",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            color: "#F0EDE6",
            padding: "72px",
            fontFamily: "sans-serif",
          }}
        >
          <div style={{ color: "#C8F55A", fontSize: 24, marginBottom: 24 }}>
            EventSlot
          </div>
          <div
            style={{
              fontSize: 78,
              fontWeight: 700,
              lineHeight: 1.1,
              marginBottom: 24,
            }}
          >
            {event.title}
          </div>
          <div
            style={{
              color: "#C8F55A",
              fontSize: 34,
              marginBottom: 20,
            }}
          >
            {dayPosition && dayPosition.total > 1 ? `Day ${dayPosition.index} of ${dayPosition.total} - ` : ""}
            {formatWalkInLongDayLabel(dayKey, WALK_IN_TIME_ZONE)}
          </div>
          <div style={{ fontSize: 32, marginBottom: 16 }}>
            Checked in attendee: {attendeeName || "Event guest"}
          </div>
          {checkinNumber ? (
            <div style={{ color: "#C8F55A", fontSize: 28, marginBottom: 16 }}>
              Check-in number #{checkinNumber}
            </div>
          ) : null}
          <div style={{ fontSize: 24 }}>
            Powered by EventSlot
          </div>
          <div style={{ fontSize: 20, marginTop: 8 }}>
            Check us out at www.eventsslot.com
          </div>
        </div>
      ),
      {
        width: 1080,
        height: 1920,
      },
    )

    response.headers.set("Cache-Control", "private, no-store")
    if (shouldDownload) {
      response.headers.set(
        "Content-Disposition",
        `attachment; filename="${slug}-walkin-poster.png"`,
      )
    }
    return response
  } catch (error) {
    console.error("[WALKIN SHARE CARD]", error)
    return NextResponse.json({ error: "Unable to generate share card." }, { status: 500 })
  }
}
