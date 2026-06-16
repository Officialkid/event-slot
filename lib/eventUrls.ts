export type PublicEventAccessType = "REGISTRATION" | "WALK_IN"

export function getPublicEventPath(slug: string, accessType: PublicEventAccessType = "REGISTRATION") {
  const normalizedSlug = slug.trim()
  return accessType === "WALK_IN" ? `/walkin/${normalizedSlug}` : `/${normalizedSlug}`
}

export function getPublicEventUrl(origin: string, slug: string, accessType: PublicEventAccessType = "REGISTRATION") {
  return `${origin.replace(/\/$/, "")}${getPublicEventPath(slug, accessType)}`
}
