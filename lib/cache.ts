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
