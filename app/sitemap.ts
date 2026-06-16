import type { MetadataRoute } from "next"
import prisma from "@/lib/prisma"

const BASE = "https://www.eventsslot.com"

const STATIC_ROUTES: MetadataRoute.Sitemap = [
  { url: BASE, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
  { url: `${BASE}/how-it-works`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  { url: `${BASE}/waitlist-system`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  { url: `${BASE}/for-universities`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  { url: `${BASE}/pricing`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  { url: `${BASE}/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  { url: `${BASE}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let eventEntries: MetadataRoute.Sitemap = []
  try {
    const events = await prisma.event.findMany({
      where: { archived: false, status: "active" },
      select: { slug: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    })
    eventEntries = events.map(e => ({
      url: `${BASE}/${e.slug}`,
      lastModified: e.createdAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }))
  } catch {
    // If DB is unavailable at build time, skip dynamic entries
  }

  return [...STATIC_ROUTES, ...eventEntries]
}
