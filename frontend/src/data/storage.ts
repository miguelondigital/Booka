/** The subset of the Web Storage API the app uses (injectable for tests). */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function createMemoryStorage(): StorageLike {
  const items = new Map<string, string>()
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, String(value)),
    removeItem: (key) => void items.delete(key),
  }
}

/**
 * localStorage when the browser allows it; otherwise (private mode, blocked
 * site data) an in-memory fallback so the demo still works for the session.
 */
export function browserStorage(): StorageLike {
  try {
    const probe = '__booka_probe__'
    localStorage.setItem(probe, probe)
    localStorage.removeItem(probe)
    return localStorage
  } catch {
    return createMemoryStorage()
  }
}
