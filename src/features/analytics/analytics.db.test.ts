import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import {
  createAnalyticsStore,
  createMemoryAnalyticsStore,
} from "./analytics.db";
import { ANALYTICS_BODY_LIMIT, ANALYTICS_RETENTION } from "./analytics.schema";

export function event(time = Date.now()) {
  return {
    id: crypto.randomUUID(),
    occurredAt: time,
    event: "build_equipped" as const,
    visitorId: crypto.randomUUID(),
    sessionId: crypto.randomUUID(),
    returning: false,
    path: "/build" as const,
  };
}

describe("analytics outbox", () => {
  it("persists individual events across instances and deletes only acknowledged IDs", async () => {
    const factory = new IDBFactory();
    const first = createAnalyticsStore(factory);
    const captured = event();
    await first.add(captured);
    const second = createAnalyticsStore(factory);
    expect(await second.claim(Date.now())).toEqual([captured]);
    const later = event();
    await first.add(later);
    await second.settle([captured.id], true);
    expect(await second.claim(Date.now())).toEqual([later]);
  });
  it("atomically claims disjoint batches across tabs and recovers a crashed uploader", async () => {
    const factory = new IDBFactory();
    const a = createAnalyticsStore(factory),
      b = createAnalyticsStore(factory);
    const now = Date.now();
    const captured = event(now);
    await a.add(captured);
    const claims = await Promise.all([a.claim(now), b.claim(now)]);
    expect(claims.flat()).toEqual([captured]);
    expect(await b.claim(now + 59_000)).toEqual([]);
    expect(await b.claim(now + 60_001)).toEqual([captured]);
  });
  it("releases failed delivery for retry with the same IDs and capture times", async () => {
    const store = createAnalyticsStore(new IDBFactory());
    const captured = event();
    await store.add(captured);
    await store.claim(Date.now());
    await store.settle([captured.id], false);
    expect(await store.claim(Date.now())).toEqual([captured]);
  });
  it("caps batches by count and bytes without coalescing events", async () => {
    const store = createAnalyticsStore(new IDBFactory());
    for (let i = 0; i < 120; i++) await store.add(event());
    const claimed = await store.claim(Date.now());
    expect(claimed).toHaveLength(100);
    expect(
      new TextEncoder().encode(JSON.stringify({ events: claimed })).length,
    ).toBeLessThanOrEqual(ANALYTICS_BODY_LIMIT);
    await store.settle(
      claimed.map((e) => e.id),
      true,
    );
    expect(await store.claim(Date.now())).toHaveLength(20);
  });
  it.each(["persistent", "memory"])(
    "expires old records and honors privacy clearing in %s storage",
    async (kind) => {
      const store =
        kind === "memory"
          ? createMemoryAnalyticsStore()
          : createAnalyticsStore(new IDBFactory());
      const now = Date.now();
      await store.add(event(now - ANALYTICS_RETENTION - 1));
      const current = event(now);
      await store.add(current);
      expect(await store.claim(now)).toEqual([current]);
      await store.clear();
      expect(await store.claim(now + 61_000)).toEqual([]);
    },
  );
});
