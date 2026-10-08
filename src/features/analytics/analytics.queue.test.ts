import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryAnalyticsStore } from "./analytics.db";
import {
  createAnalyticsQueue,
  ANALYTICS_FLUSH_INTERVAL,
} from "./analytics.queue";
import type { QueuedAnalyticsEvent } from "./analytics.schema";

const event = (): QueuedAnalyticsEvent => ({
  id: crypto.randomUUID(),
  occurredAt: Date.now(),
  event: "build_equipped",
  visitorId: crypto.randomUUID(),
  sessionId: crypto.randomUUID(),
  returning: false,
  path: "/build",
});
afterEach(() => vi.useRealTimers());
function setup() {
  const store = createMemoryAnalyticsStore();
  const upload = vi
    .fn<(events: QueuedAnalyticsEvent[]) => Promise<boolean>>()
    .mockResolvedValue(true);
  let allowed = true,
    online = true;
  const queue = createAnalyticsQueue({
    store,
    upload,
    allowed: () => allowed,
    online: () => online,
  });
  return {
    store,
    upload,
    queue,
    optOut() {
      allowed = false;
    },
    offline() {
      online = false;
    },
    online() {
      online = true;
    },
  };
}
describe("batched analytics delivery", () => {
  it("sends many events in one periodic request and clears after acknowledgment", async () => {
    vi.useFakeTimers();
    const { queue, upload, store } = setup();
    const events = Array.from({ length: 20 }, event);
    for (const captured of events) await queue.enqueue(captured);
    expect(upload).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(ANALYTICS_FLUSH_INTERVAL);
    expect(upload).toHaveBeenCalledExactlyOnceWith(events);
    expect(await store.claim(Date.now())).toEqual([]);
    queue.stop();
  });
  it("keeps failed batches and backs off despite continued activity", async () => {
    vi.useFakeTimers();
    const { queue, upload } = setup();
    upload.mockResolvedValueOnce(false);
    const captured = event();
    await queue.enqueue(captured);
    await queue.flush();
    for (let i = 0; i < 60; i++) await queue.enqueue(event());
    await queue.flush();
    expect(upload).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(ANALYTICS_FLUSH_INTERVAL);
    expect(upload).toHaveBeenCalledTimes(2);
    expect(upload.mock.calls[1][0][0]).toEqual(captured);
    queue.stop();
  });
  it("retains offline activity and uploads when online", async () => {
    const s = setup();
    s.offline();
    const captured = event();
    await s.queue.enqueue(captured);
    await s.queue.flush();
    expect(s.upload).not.toHaveBeenCalled();
    s.online();
    await s.queue.flush();
    expect(s.upload).toHaveBeenCalledExactlyOnceWith([captured]);
    s.queue.stop();
  });
  it("retains new actions during an in-flight batch and merges simultaneous flush calls", async () => {
    const s = setup();
    let finish!: (value: boolean) => void;
    s.upload.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await s.queue.enqueue(event());
    const first = s.queue.flush();
    await vi.waitFor(() => expect(s.upload).toHaveBeenCalledTimes(1));
    const later = event();
    await s.queue.enqueue(later);
    const second = s.queue.flush();
    finish(true);
    await Promise.all([first, second]);
    await s.queue.flush();
    expect(s.upload.mock.calls[1][0]).toEqual([later]);
    s.queue.stop();
  });
  it("clears previously captured events after opt-out without uploading", async () => {
    const s = setup();
    await s.queue.enqueue(event());
    s.optOut();
    await s.queue.flush();
    expect(s.upload).not.toHaveBeenCalled();
    expect(await s.store.claim(Date.now())).toEqual([]);
    s.queue.stop();
  });
  it("uses memory if persistence fails without interrupting actions", async () => {
    const s = setup();
    vi.spyOn(s.store, "add").mockRejectedValue(new Error("Storage blocked"));
    const captured = event();
    await s.queue.enqueue(captured);
    await s.queue.flush();
    expect(s.upload).toHaveBeenCalledExactlyOnceWith([captured]);
    s.queue.stop();
  });
});
