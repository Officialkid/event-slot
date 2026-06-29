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
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            background: "#0A0A0A",
            color: "#F0EDE6",
            padding: "72px",
            fontFamily: "sans-serif",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                color: "#C8F55A",
                fontSize: "26px",
                fontWeight: 700,
              }}
            >
              <div
                style={{
                  width: "18px",
                  height: "18px",
                  borderRadius: "999px",
                  background: "#C8F55A",
                }}
              />
              <div>EventSlot</div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "18px",
              }}
            >
              <div style={{ color: "#C8F55A", fontSize: "28px", fontWeight: 700 }}>
                Welcome to
              </div>
              <div style={{ fontSize: "72px", fontWeight: 700, lineHeight: 1.08 }}>
                {event.title}
              </div>
              <div style={{ color: "#C8F55A", fontSize: "34px", fontWeight: 600 }}>
                {dayPosition && dayPosition.total > 1 ? `Day ${dayPosition.index} of ${dayPosition.total} - ` : ""}
                {formatWalkInLongDayLabel(dayKey, WALK_IN_TIME_ZONE)}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              padding: "36px",
              borderRadius: "32px",
              border: "1px solid rgba(200,245,90,0.25)",
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <div style={{ fontSize: "26px", color: "rgba(240,237,230,0.72)" }}>
              Checked in attendee
            </div>
            <div style={{ fontSize: "54px", fontWeight: 700 }}>
              {attendeeName || "Event guest"}
            </div>
            {checkinNumber ? (
              <div style={{ fontSize: "34px", color: "#C8F55A", fontWeight: 700 }}>
                Check-in number #{checkinNumber}
              </div>
            ) : null}
            <div style={{ fontSize: "28px", color: "rgba(240,237,230,0.82)" }}>
              Thanks for being part of this moment.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "24px", fontWeight: 700 }}>Powered by EventSlot</div>
            <div style={{ fontSize: "22px", color: "rgba(240,237,230,0.78)" }}>
              Check us out at www.eventsslot.com
            </div>
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
