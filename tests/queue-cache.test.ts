import test from "node:test";
import assert from "node:assert/strict";
import {
  getOrSetCurrentQueuesCache,
  invalidateCurrentQueuesCache,
  getCurrentQueuesCacheStatus,
  resetCurrentQueuesCacheForTesting,
  CURRENT_QUEUES_CACHE_TTL_MS,
} from "../lib/dungeon/queue-cache";

test("Queue Cache - Returns cached result within TTL without re-fetching", async () => {
  resetCurrentQueuesCacheForTesting();

  let fetchCount = 0;
  const mockFetch = async () => {
    fetchCount++;
    return [{ id: "q1", name: "Player1", status: "waiting" }];
  };

  // 1st call: cache miss -> fetch
  const res1 = await getOrSetCurrentQueuesCache(mockFetch, 500);
  assert.equal(fetchCount, 1);
  assert.equal(res1.length, 1);
  assert.equal(res1[0].name, "Player1");

  // 2nd call: cache hit -> no fetch
  const res2 = await getOrSetCurrentQueuesCache(mockFetch, 500);
  assert.equal(fetchCount, 1, "fetchCount must remain 1 within TTL");
  assert.equal(res2.length, 1);

  const status = getCurrentQueuesCacheStatus();
  assert.equal(status.isCached, true);
  assert.equal(status.itemCount, 1);
});

test("Queue Cache - Re-fetches after TTL expiration", async () => {
  resetCurrentQueuesCacheForTesting();

  let fetchCount = 0;
  const mockFetch = async () => {
    fetchCount++;
    return [{ id: `q_${fetchCount}`, name: `Player_${fetchCount}` }];
  };

  // Very short TTL for test
  await getOrSetCurrentQueuesCache(mockFetch, 50); // 50ms TTL
  assert.equal(fetchCount, 1);

  // Wait for TTL to expire
  await new Promise((r) => setTimeout(r, 70));

  // Should fetch fresh data
  const res = await getOrSetCurrentQueuesCache(mockFetch, 50);
  assert.equal(fetchCount, 2, "Must re-fetch after TTL expiration");
  assert.equal(res[0].name, "Player_2");
});

test("Queue Cache - Invalidation purges cache immediately", async () => {
  resetCurrentQueuesCacheForTesting();

  let fetchCount = 0;
  const mockFetch = async () => {
    fetchCount++;
    return [{ id: `q_${fetchCount}`, name: `Player_${fetchCount}` }];
  };

  await getOrSetCurrentQueuesCache(mockFetch, 10000);
  assert.equal(fetchCount, 1);

  // Invalidate cache
  invalidateCurrentQueuesCache();

  const status = getCurrentQueuesCacheStatus();
  assert.equal(status.isCached, false);

  // Next call must re-fetch immediately despite 10s TTL
  const res = await getOrSetCurrentQueuesCache(mockFetch, 10000);
  assert.equal(fetchCount, 2, "Must re-fetch immediately after invalidation");
  assert.equal(res[0].name, "Player_2");
});

test("Queue Cache - Request coalescing prevents thundering herd under concurrency", async () => {
  resetCurrentQueuesCacheForTesting();

  let fetchCount = 0;
  const slowFetch = async () => {
    fetchCount++;
    await new Promise((r) => setTimeout(r, 40));
    return [{ id: "q1", name: "Player1" }];
  };

  // Launch 10 concurrent requests simultaneously
  const promises = Array.from({ length: 10 }, () =>
    getOrSetCurrentQueuesCache(slowFetch, 5000)
  );

  const results = await Promise.all(promises);

  assert.equal(fetchCount, 1, "Only 1 fetch must be executed for 10 concurrent requests");
  assert.equal(results.length, 10);
  for (const r of results) {
    assert.equal(r.length, 1);
    assert.equal(r[0].name, "Player1");
  }
});

test("Queue Cache - Stale-write race condition protection", async () => {
  resetCurrentQueuesCacheForTesting();

  let fetchCount = 0;
  const slowFetchOld = async () => {
    fetchCount++;
    await new Promise((r) => setTimeout(r, 60)); // takes 60ms
    return [{ id: "stale_q", name: "StalePlayer" }];
  };

  // 1. Request begins fetching old data
  const inFlight = getOrSetCurrentQueuesCache(slowFetchOld, 5000);

  // 2. Midway through (at 20ms), a mutation invalidates the cache!
  await new Promise((r) => setTimeout(r, 20));
  invalidateCurrentQueuesCache();

  // 3. The old fetch finishes
  await inFlight;

  // 4. Cache MUST NOT store the stale data because invalidation occurred during the fetch!
  const status = getCurrentQueuesCacheStatus();
  assert.equal(status.isCached, false, "Stale data must NOT be cached after mid-flight invalidation");

  // 5. Subsequent request must fetch fresh data
  const freshFetch = async () => {
    fetchCount++;
    return [{ id: "fresh_q", name: "FreshPlayer" }];
  };
  const freshResult = await getOrSetCurrentQueuesCache(freshFetch, 5000);
  assert.equal(freshResult[0].name, "FreshPlayer");
});

test("Queue Cache - Returns shallow copy to prevent caller mutation of cache", async () => {
  resetCurrentQueuesCacheForTesting();

  const mockFetch = async () => [
    { id: "q1", name: "Player1" },
  ];

  const first = await getOrSetCurrentQueuesCache(mockFetch, 5000);
  first.push({ id: "hacked", name: "HackedPlayer" }); // Mutate returned array

  const second = await getOrSetCurrentQueuesCache(mockFetch, 5000);
  assert.equal(second.length, 1, "Cached array must NOT be mutated by caller");
  assert.equal(second[0].name, "Player1");
});
