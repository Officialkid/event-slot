"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Calendar, MapPin, ArrowRight, Compass, Sparkles } from "lucide-react"

interface DiscoveryEvent {
  id: string
  title: string
  slug: string
  imageUrl: string | null
  eventDate: string | null
  location: string | null
  isPaid: boolean
  ticketPrice: number | null
  category: string | null
  organizerDisplayName?: string | null
  organizerUsername?: string | null
}

interface EventDiscoveryCardsProps {
  currentSlug?: string
  organizerId?: string | null
  organizerName?: string | null
  category?: string | null
}

export function EventDiscoveryCards({
  currentSlug,
  organizerId,
  organizerName,
  category,
}: EventDiscoveryCardsProps) {
  const [moreFromOrganiser, setMoreFromOrganiser] = useState<DiscoveryEvent[]>([])
  const [eventsYouMayLike, setEventsYouMayLike] = useState<DiscoveryEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let cancelled = false

    async function loadRecommendations() {
      try {
        const params = new URLSearchParams()
        if (currentSlug) params.set("excludeSlug", currentSlug)
        if (organizerId) params.set("organizerId", organizerId)
        if (category) params.set("category", category)

        const res = await fetch(`/api/events/recommended?${params.toString()}`)
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && data.success) {
          setMoreFromOrganiser(data.moreFromOrganiser || [])
          setEventsYouMayLike(data.eventsYouMayLike || [])
        }
      } catch (err) {
        console.error("Failed to load discovery events:", err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadRecommendations()
    return () => {
      cancelled = true
    }
  }, [currentSlug, organizerId, category])

  if (loading || (moreFromOrganiser.length === 0 && eventsYouMayLike.length === 0)) {
    return null
  }

  const formatDate = (isoString: string | null) => {
    if (!isoString) return "Date TBA"
    try {
      const d = new Date(isoString)
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
      })
    } catch {
      return "Date TBA"
    }
  }

  const renderEventCard = (evt: DiscoveryEvent, showHost = false) => {
    const targetHref = evt.organizerUsername
      ? `/${evt.organizerUsername}/${evt.slug}`
      : `/events/${evt.slug}`

    return (
      <Link
        key={evt.id}
        href={targetHref}
        className="group flex flex-col rounded-xl overflow-hidden border transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
        style={{
          backgroundColor: "var(--surface)",
          borderColor: "var(--border)",
        }}
      >
        {/* Event Image */}
        <div className="relative w-full h-36 bg-zinc-900 overflow-hidden">
          {evt.imageUrl && !failedImages[evt.id] ? (
            <Image
              src={evt.imageUrl}
              alt={evt.title}
              fill
              unoptimized
              sizes="(max-width: 640px) 100vw, 300px"
              onError={() => setFailedImages((prev) => ({ ...prev, [evt.id]: true }))}
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 15%, #18181b), #09090b)",
              }}
            >
              <Compass className="w-8 h-8" style={{ color: "var(--accent)", opacity: 0.7 }} />
            </div>
          )}

          {/* Pricing pill */}
          <div className="absolute top-2.5 right-2.5">
            <span
              className="px-2 py-0.5 rounded-full text-xs font-semibold backdrop-blur-md"
              style={{
                backgroundColor: evt.isPaid ? "rgba(0,0,0,0.75)" : "rgba(34,197,94,0.85)",
                color: "#ffffff",
              }}
            >
              {evt.isPaid ? (evt.ticketPrice ? `KES ${evt.ticketPrice.toLocaleString()}` : "Paid") : "Free"}
            </span>
          </div>

          {/* Category tag */}
          {evt.category && (
            <div className="absolute bottom-2.5 left-2.5">
              <span
                className="px-2 py-0.5 rounded text-[11px] font-medium backdrop-blur-md"
                style={{ backgroundColor: "rgba(0,0,0,0.65)", color: "rgba(255,255,255,0.9)" }}
              >
                {evt.category}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3.5 flex flex-col flex-1 justify-between gap-2.5">
          <div>
            {showHost && evt.organizerDisplayName && (
              <p className="text-xs font-medium truncate mb-1" style={{ color: "var(--text-muted)" }}>
                by {evt.organizerDisplayName}
              </p>
            )}
            <h4
              className="text-sm font-semibold line-clamp-2 group-hover:text-[var(--accent)] transition-colors"
              style={{ color: "var(--text-primary)" }}
            >
              {evt.title}
            </h4>
          </div>

          <div className="space-y-1 text-xs" style={{ color: "var(--text-muted)" }}>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>{formatDate(evt.eventDate)}</span>
            </div>
            {evt.location && (
              <div className="flex items-center gap-1.5 truncate">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{evt.location}</span>
              </div>
            )}
          </div>
        </div>
      </Link>
    )
  }

  return (
    <div className="w-full my-8 space-y-8">
      {/* 1. More from this Organiser */}
      {moreFromOrganiser.length > 0 && (
        <section aria-labelledby="more-from-host-heading">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" style={{ color: "var(--accent)" }} />
              <h3 id="more-from-host-heading" className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                More from {organizerName || "this Organiser"}
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {moreFromOrganiser.map((evt) => renderEventCard(evt, false))}
          </div>
        </section>
      )}

      {/* 2. Events You May Like */}
      {eventsYouMayLike.length > 0 && (
        <section aria-labelledby="events-you-may-like-heading">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4" style={{ color: "var(--accent)" }} />
              <h3 id="events-you-may-like-heading" className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                Events You May Like
              </h3>
            </div>
            <Link
              href="/events"
              className="inline-flex items-center gap-1 text-xs font-semibold hover:underline"
              style={{ color: "var(--accent)" }}
            >
              <span>Explore all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {eventsYouMayLike.map((evt) => renderEventCard(evt, true))}
          </div>
        </section>
      )}
    </div>
  )
}
