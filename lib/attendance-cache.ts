/**
 * In-Memory Server-Side Cache for /api/attendance
 *
 * Phase 2 - Point 3: Attendance Cost & Query Optimization
 */

interface CacheEntry {
  data: any[];
  expiresAt: number;
}

export const ATTENDANCE_CACHE_TTL_MS = 10_000; // 10 seconds

interface GlobalAttendanceCacheState {
  cacheMap: Map<string, CacheEntry>;
  inFlightMap: Map<string, Promise<any[]>>;
}

const globalCache = globalThis as unknown as {
  __attendanceCacheState?: GlobalAttendanceCacheState;
};

if (!globalCache.__attendanceCacheState) {
  globalCache.__attendanceCacheState = {
    cacheMap: new Map(),
    inFlightMap: new Map(),
  };
}

const state = globalCache.__attendanceCacheState;

export async function getOrSetAttendanceCache(
  cacheKey: string,
  fetchFn: () => Promise<any[]>,
  ttlMs = ATTENDANCE_CACHE_TTL_MS
): Promise<any[]> {
  const now = Date.now();

  // 1. Cache hit
  const entry = state.cacheMap.get(cacheKey);
  if (entry && entry.expiresAt > now) {
    return [...entry.data];
  }

  // 2. Request coalescing
  const inFlight = state.inFlightMap.get(cacheKey);
  if (inFlight) {
    const data = await inFlight;
    return [...data];
  }

  // 3. Cache miss: fetch
  const fetchPromise = (async () => {
    try {
      const data = await fetchFn();
      const fetchNow = Date.now();
      state.cacheMap.set(cacheKey, {
        data,
        expiresAt: fetchNow + ttlMs,
      });
      return data;
    } finally {
      state.inFlightMap.delete(cacheKey);
    }
  })();

  state.inFlightMap.set(cacheKey, fetchPromise);
  const result = await fetchPromise;
  return [...result];
}

export function invalidateAttendanceCache(): void {
  state.cacheMap.clear();
  state.inFlightMap.clear();
}

export function resetAttendanceCacheForTesting(): void {
  state.cacheMap.clear();
  state.inFlightMap.clear();
}
