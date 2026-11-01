import type { Slot } from './types'

export function createAvailabilityLoader(fetchSlots: (key: string) => Promise<Slot[]>, now = Date.now) {
  const cache = new Map<string, { slots: Slot[]; expires: number }>()
  const pending = new Map<string, Promise<Slot[]>>()
  return async (key: string, fresh = false): Promise<Slot[]> => {
    const cached = cache.get(key)
    if (!fresh && cached && cached.expires > now()) {
      return cached.slots
    }
    cache.delete(key)
    const existing = pending.get(key)
    if (existing) {
      return existing
    }
    const request = Promise.resolve()
      .then(() => fetchSlots(key))
      .then((slots) => {
        cache.delete(key)
        cache.set(key, { slots, expires: now() + 30000 })
        while (cache.size > 4) {
          cache.delete(cache.keys().next().value!)
        }
        return slots
      })
      .finally(() => pending.delete(key))
    pending.set(key, request)
    return request
  }
}
