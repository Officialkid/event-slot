type GeocodeResult = {
  lat: number
  lon: number
}

function parseMapQuery(mapDirectionsUrl: string | null | undefined, location: string | null | undefined) {
  const trimmedLocation = location?.trim()
  const trimmedMapUrl = mapDirectionsUrl?.trim()

  if (trimmedMapUrl) {
    try {
      const url = new URL(trimmedMapUrl)
      const query = url.searchParams.get("query") || url.searchParams.get("q")
      if (query?.trim()) return query.trim()

      const coordinates = trimmedMapUrl.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
      if (coordinates) return `${coordinates[1]},${coordinates[2]}`

      const placeMatch = url.pathname.match(/\/place\/([^/]+)/)
      if (placeMatch?.[1]) {
        return decodeURIComponent(placeMatch[1].replace(/\+/g, " ")).trim()
      }
    } catch {
      // Ignore malformed URLs and fall back to the organiser-provided location text.
    }
  }

  return trimmedLocation || null
}

async function expandMapDirectionsUrl(mapDirectionsUrl: string | null | undefined): Promise<string | null> {
  const trimmedMapUrl = mapDirectionsUrl?.trim()
  if (!trimmedMapUrl) return null

  try {
    const response = await fetch(trimmedMapUrl, {
      method: "GET",
      redirect: "follow",
      cache: "force-cache",
    })

    if (response.url && response.url !== trimmedMapUrl) {
      return response.url
    }
  } catch {
    // Short Google Maps links can still be used as the action target even if the preview expansion fails.
  }

  return trimmedMapUrl
}

function parseCoordinatePair(value: string | null): GeocodeResult | null {
  if (!value) return null
  const match = value.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/)
  if (!match) return null

  const lat = Number(match[1])
  const lon = Number(match[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null

  return { lat, lon }
}

function buildStaticMapImageUrl(lat: number, lon: number) {
  const center = `${lat.toFixed(6)},${lon.toFixed(6)}`
  const marker = `${lat.toFixed(6)},${lon.toFixed(6)},red-pushpin`
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${encodeURIComponent(center)}&zoom=15&size=960x320&maptype=mapnik&markers=${encodeURIComponent(marker)}`
}

async function geocodeLocation(query: string): Promise<GeocodeResult | null> {
  const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "en",
      "User-Agent": "EventSlot/1.0 (map preview)",
    },
    // Map previews are stable enough to cache and re-use across requests.
    next: { revalidate: 60 * 60 * 24 },
  })

  if (!response.ok) return null

  const data = await response.json()
  const first = Array.isArray(data) ? data[0] : null
  if (!first) return null

  const lat = Number(first.lat)
  const lon = Number(first.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null

  return { lat, lon }
}

export async function resolveEventMapPreviewImageUrl(mapDirectionsUrl: string | null | undefined, location: string | null | undefined) {
  const expandedMapDirectionsUrl = await expandMapDirectionsUrl(mapDirectionsUrl)
  const query = parseMapQuery(expandedMapDirectionsUrl, location)
  if (!query) return null

  const directCoordinates = parseCoordinatePair(query)
  if (directCoordinates) {
    return buildStaticMapImageUrl(directCoordinates.lat, directCoordinates.lon)
  }

  const geocoded = await geocodeLocation(query)
  if (!geocoded) return null

  return buildStaticMapImageUrl(geocoded.lat, geocoded.lon)
}
