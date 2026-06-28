const DEFAULT_TTL = 60_000

export function getCached<T>(key: string, ttl = DEFAULT_TTL): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw) as { data: T; ts: number }
    if (Date.now() - ts > ttl) { sessionStorage.removeItem(key); return null }
    return data
  } catch { return null }
}

export function setCached<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return
  try { sessionStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })) }
  catch {}
}

export function invalidateCache(key: string): void {
  if (typeof window === 'undefined') return
  try { sessionStorage.removeItem(key) } catch {}
}
