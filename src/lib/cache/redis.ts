import Redis from 'ioredis'

// Redis client singleton — reused across requests
let redis: Redis | null = null

function getRedis(): Redis {
  if (!redis) {
    const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null // Stop retrying after 3 attempts
        return Math.min(times * 200, 2000)
      },
      lazyConnect: true,
    })
    redis.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message)
    })
  }
  return redis
}

// ── Cache helpers with TTL ──────────────────────────

const DEFAULT_TTL = 3600 // 1 hour

/**
 * Get cached value or fetch from source
 */
export async function cached<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = DEFAULT_TTL
): Promise<T> {
  try {
    const r = getRedis()
    const raw = await r.get(key)
    if (raw) {
      return JSON.parse(raw) as T
    }
  } catch {
    // Redis down — fall through to fetch
  }

  // Cache miss — fetch from source
  const data = await fetchFn()

  // Save to cache (non-blocking)
  try {
    const r = getRedis()
    r.setex(key, ttl, JSON.stringify(data)).catch(() => {})
  } catch {
    // Redis down — ignore
  }

  return data
}

/**
 * Invalidate cache key
 */
export async function invalidate(key: string): Promise<void> {
  try {
    const r = getRedis()
    await r.del(key)
  } catch {
    // Redis down — ignore
  }
}

/**
 * Invalidate all keys matching pattern
 */
export async function invalidatePattern(pattern: string): Promise<void> {
  try {
    const r = getRedis()
    const keys = await r.keys(pattern)
    if (keys.length > 0) {
      await r.del(...keys)
    }
  } catch {
    // Redis down — ignore
  }
}

// ── Pre-built cache keys ──────────────────────────

export const CACHE_KEYS = {
  businessSettings: (bizId: string) => `biz:${bizId}:settings`,
  businessInfo: (bizId: string) => `biz:${bizId}:info`,
  aiPersona: (bizId: string) => `biz:${bizId}:persona`,
  contactByWaId: (bizId: string, waId: string) => `biz:${bizId}:contact:${waId}`,
  todayAppointments: (bizId: string, date: string) => `biz:${bizId}:apts:${date}`,
}

export const CACHE_TTL = {
  SETTINGS: 3600,      // 1 hour — settings rarely change
  PERSONA: 3600,       // 1 hour
  CONTACT: 300,        // 5 minutes — contacts can change
  APPOINTMENTS: 60,    // 1 minute — appointments change frequently
}
