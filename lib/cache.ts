import { LRUCache } from 'lru-cache'

type CacheOptions = {
  ttl?: number
  max?: number
}

export function createCache<T extends object>(options: CacheOptions = {}) {
  return new LRUCache<string, T>({
    max: options.max || 100,
    ttl: options.ttl || 1000 * 60 * 5,
  })
}

export const eventListCache = createCache<Record<string, unknown>>({ ttl: 1000 * 60 * 2, max: 50 })
export const dashboardStatsCache = createCache<Record<string, unknown>>({ ttl: 1000 * 60, max: 100 })
export const publicEventCache = createCache<Record<string, unknown>>({ ttl: 1000 * 60 * 5, max: 200 })

/** Purge all cached data for a given user (e.g., after event mutation). */
export function purgeUserCache(userId: string, email: string | null) {
  for (const key of eventListCache.keys()) {
    if (key.startsWith(`my-events:${userId}:`)) eventListCache.delete(key)
  }
  dashboardStatsCache.delete(`dashboard-stats:${userId}:${email ?? 'none'}`)
}
