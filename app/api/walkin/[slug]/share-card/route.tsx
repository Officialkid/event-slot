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

async function loadRemoteImageAsDataUrl(url: string) {
  try {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) return null

    const contentType = response.headers.get("content-type") || "image/jpeg"
    const arrayBuffer = await response.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString("base64")
    return `data:${contentType};base64,${base64}`
  } catch {
    return null
  }
}

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

    const coverImageDataUrl = event.imageUrl
      ? await loadRemoteImageAsDataUrl(event.imageUrl)
      : null

    const response = new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            position: "relative",
            overflow: "hidden",
            background: "linear-gradient(160deg, #0A0A0A 0%, #101722 50%, #0D1410 100%)",
            color: "#F0EDE6",
            fontFamily: "Geist, system-ui, sans-serif",
          }}
        >
          {coverImageDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverImageDataUrl}
              alt=""
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage:
                  "linear-gradient(135deg, rgba(200,245,90,0.12) 0 2px, transparent 2px 32px), linear-gradient(45deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 28px), linear-gradient(160deg, #0A0A0A 0%, #111722 100%)",
                opacity: 0.95,
              }}
            />
          )}

          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(5,7,10,0.24) 0%, rgba(5,7,10,0.52) 38%, rgba(5,7,10,0.78) 72%, rgba(5,7,10,0.92) 100%)",
            }}
          />

          <div
            style={{
              position: "absolute",
              top: 72,
              left: 72,
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "0.02em",
              zIndex: 2,
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                background: "#C8F55A",
                boxShadow: "0 0 0 10px rgba(200,245,90,0.08)",
              }}
            />
            <span>EventSlot</span>
          </div>

          <div
            style={{
              position: "absolute",
              left: 72,
              right: 72,
              top: 380,
              display: "flex",
              flexDirection: "column",
              gap: 28,
              alignItems: "center",
              textAlign: "center",
              zIndex: 2,
            }}
          >
            <div
              style={{
                width: 102,
                height: 102,
                borderRadius: 999,
                border: "2px solid rgba(200,245,90,0.55)",
                background: "rgba(200,245,90,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#C8F55A",
                fontSize: 42,
                fontWeight: 700,
              }}
            >
              IN
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.08, color: "#C8F55A" }}>
                Welcome to
              </div>
              <div style={{ fontSize: 44, fontWeight: 700, lineHeight: 1.08 }}>
                We are glad to have you at
              </div>
              <div
                style={{
                  fontSize: 70,
                  fontWeight: 700,
                  lineHeight: 1.03,
                  paddingLeft: 24,
                  paddingRight: 24,
                }}
              >
                {event.title}
              </div>
              <div style={{ fontSize: 34, fontWeight: 600, color: "#C8F55A" }}>
                {dayPosition && dayPosition.total > 1 ? `Day ${dayPosition.index} of ${dayPosition.total} - ` : ""}
                {formatWalkInLongDayLabel(dayKey, WALK_IN_TIME_ZONE)}
              </div>
              {attendeeName ? (
                <div style={{ fontSize: 30, fontWeight: 500, color: "rgba(240,237,230,0.82)" }}>
                  Checked in as {attendeeName}
                </div>
              ) : null}
              {checkinNumber ? (
                <div style={{ fontSize: 38, fontWeight: 700 }}>
                  Check-in number #{checkinNumber}
                </div>
              ) : null}
              <div style={{ fontSize: 28, fontWeight: 500, color: "rgba(240,237,230,0.86)" }}>
                Thanks for being part of this moment.
              </div>
            </div>
          </div>

          <div
            style={{
              position: "absolute",
              left: 72,
              right: 72,
              bottom: 68,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              zIndex: 2,
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 700 }}>Powered by EventSlot</div>
            <div style={{ fontSize: 22, color: "rgba(240,237,230,0.78)" }}>
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
