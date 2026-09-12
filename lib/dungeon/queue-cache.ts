/**
 * In-Memory Server-Side Cache for /api/dungeon/queues?type=current
 *
 * Phase 2 - Point 1: Firebase Cost & Network Optimization
 *
 * Key Design Principles:
 * 1. TTL: 7000ms (7 seconds, within 6-8s specification)
 * 2. Concurrency Safety: Request coalescing (in-flight promise sharing) prevents
 *    cache stampede / thundering herd under heavy concurrent polling.
 * 3. Race Condition Guard: Uses a monotonic cache version counter to ensure that
 *    an in-flight fetch NEVER overwrites the cache with stale data if a mutation
 *    invalidated the cache while the fetch was in progress.
 * 4. Immutability: Returns a shallow-copied array to prevent callers from
 *    accidentally mutating cached state in place.
 * 5. Global Singleton: Uses globalThis so state persists reliably in Node.js runtime.
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  version: number;
}

export const CURRENT_QUEUES_CACHE_TTL_MS = 7000; // 7 seconds

interface GlobalQueueCacheState {
  currentQueues: CacheEntry<any[]> | null;
  inFlightPromise: Promise<any[]> | null;
  queueItems: CacheEntry<any[]> | null;
  inFlightQueueItemsPromise: Promise<any[]> | null;
  teams: CacheEntry<any[]> | null;
  inFlightTeamsPromise: Promise<any[]> | null;
  version: number;
}

const globalCache = globalThis as unknown as {
  __dungeonCurrentQueuesCacheState?: GlobalQueueCacheState;
};

if (!globalCache.__dungeonCurrentQueuesCacheState) {
  globalCache.__dungeonCurrentQueuesCacheState = {
    currentQueues: null,
    inFlightPromise: null,
    queueItems: null,
    inFlightQueueItemsPromise: null,
    teams: null,
    inFlightTeamsPromise: null,
    version: 0,
  };
}

const state = globalCache.__dungeonCurrentQueuesCacheState;

/**
 * Retrieves cached current queues if fresh (within TTL).
 * If missing, expired, or invalidated, invokes `fetchFn` and caches the result.
 * Concurrent callers share the same in-flight fetch promise.
 */
export async function getOrSetCurrentQueuesCache(
  fetchFn: () => Promise<any[]>,
  ttlMs = CURRENT_QUEUES_CACHE_TTL_MS
): Promise<any[]> {
  const now = Date.now();

  // 1. Cache Hit: still within TTL
  if (state.currentQueues && state.currentQueues.expiresAt > now) {
    return [...state.currentQueues.data];
  }

  // 2. Request Coalescing: Join existing in-flight fetch if already running
  if (state.inFlightPromise) {
    const data = await state.inFlightPromise;
    return [...data];
  }

  // 3. Cache Miss: Initiate fetch with version capture
  const fetchVersion = state.version;

  state.inFlightPromise = (async () => {
    try {
      const data = await fetchFn();
      const fetchNow = Date.now();

      // Concurrency Guard: Only update cache if no invalidation happened during the fetch
      if (state.version === fetchVersion) {
        state.currentQueues = {
          data,
          timestamp: fetchNow,
          expiresAt: fetchNow + ttlMs,
          version: fetchVersion,
        };
      }

      return data;
    } finally {
      state.inFlightPromise = null;
    }
  })();

  const result = await state.inFlightPromise;
  return [...result];
}

/**
 * Retrieves cached queue items if fresh (within TTL).
 */
export async function getOrSetQueueItemsCache(
  fetchFn: () => Promise<any[]>,
  ttlMs = CURRENT_QUEUES_CACHE_TTL_MS
): Promise<any[]> {
  const now = Date.now();

  if (state.queueItems && state.queueItems.expiresAt > now) {
    return [...state.queueItems.data];
  }

  if (state.inFlightQueueItemsPromise) {
    const data = await state.inFlightQueueItemsPromise;
    return [...data];
  }

  const fetchVersion = state.version;
  state.inFlightQueueItemsPromise = (async () => {
    try {
      const data = await fetchFn();
      const fetchNow = Date.now();
      if (state.version === fetchVersion) {
        state.queueItems = {
          data,
          timestamp: fetchNow,
          expiresAt: fetchNow + ttlMs,
          version: fetchVersion,
        };
      }
      return data;
    } finally {
      state.inFlightQueueItemsPromise = null;
    }
  })();

  const result = await state.inFlightQueueItemsPromise;
  return [...result];
}

/**
 * Retrieves cached dungeon teams if fresh (within TTL).
 */
export async function getOrSetDungeonTeamsCache(
  fetchFn: () => Promise<any[]>,
  ttlMs = CURRENT_QUEUES_CACHE_TTL_MS
): Promise<any[]> {
  const now = Date.now();

  if (state.teams && state.teams.expiresAt > now) {
    return [...state.teams.data];
  }

  if (state.inFlightTeamsPromise) {
    const data = await state.inFlightTeamsPromise;
    return [...data];
  }

  const fetchVersion = state.version;
  state.inFlightTeamsPromise = (async () => {
    try {
      const data = await fetchFn();
      const fetchNow = Date.now();
      if (state.version === fetchVersion) {
        state.teams = {
          data,
          timestamp: fetchNow,
          expiresAt: fetchNow + ttlMs,
          version: fetchVersion,
        };
      }
      return data;
    } finally {
      state.inFlightTeamsPromise = null;
    }
  })();

  const result = await state.inFlightTeamsPromise;
  return [...result];
}

/**
 * Purges the in-memory cache immediately.
 * Increments version counter so any currently in-flight fetch is discarded.
 */
export function invalidateCurrentQueuesCache(): void {
  state.version++;
  state.currentQueues = null;
  state.inFlightPromise = null;
  state.queueItems = null;
  state.inFlightQueueItemsPromise = null;
  state.teams = null;
  state.inFlightTeamsPromise = null;
}

/**
 * Diagnostic status for monitoring and test verification.
 */
export function getCurrentQueuesCacheStatus() {
  const now = Date.now();
  const entry = state.currentQueues;
  return {
    isCached: !!entry && entry.expiresAt > now,
    timestamp: entry?.timestamp ?? null,
    expiresAt: entry?.expiresAt ?? null,
    remainingMs: entry ? Math.max(0, entry.expiresAt - now) : 0,
    version: state.version,
    hasInFlight: !!state.inFlightPromise,
    itemCount: entry?.data?.length ?? 0,
  };
}

/**
 * Test helper to reset cache state to clean initial values.
 */
export function resetCurrentQueuesCacheForTesting(): void {
  state.version = 0;
  state.currentQueues = null;
  state.inFlightPromise = null;
  state.queueItems = null;
  state.inFlightQueueItemsPromise = null;
  state.teams = null;
  state.inFlightTeamsPromise = null;
}
