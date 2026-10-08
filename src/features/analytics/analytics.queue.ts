import {
  createMemoryAnalyticsStore,
  type AnalyticsStore,
} from "./analytics.db";
import type { QueuedAnalyticsEvent } from "./analytics.schema";

export const ANALYTICS_FLUSH_INTERVAL = 60_000;
export const ANALYTICS_FLUSH_THRESHOLD = 50;
const maxBackoff = 5 * 60_000;

type Options = {
  store: AnalyticsStore;
  allowed: () => boolean;
  online: () => boolean;
  upload: (events: QueuedAnalyticsEvent[]) => Promise<boolean>;
};

export function createAnalyticsQueue(options: Options) {
  const fallback = createMemoryAnalyticsStore();
  let writes = Promise.resolve();
  let flushing: Promise<void> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let retryAt = 0;
  let backoff = ANALYTICS_FLUSH_INTERVAL;
  let stopped = false;

  function schedule() {
    if (stopped || timer) return;
    timer = setTimeout(
      () => {
        timer = undefined;
        void flush();
      },
      Math.max(ANALYTICS_FLUSH_INTERVAL, retryAt - Date.now()),
    );
  }
  async function clear() {
    await Promise.allSettled([options.store.clear(), fallback.clear()]);
  }
  function enqueue(event: QueuedAnalyticsEvent) {
    writes = writes
      .then(async () => {
        if (!options.allowed()) {
          await clear();
          return;
        }
        let size: number;
        try {
          size = await options.store.add(event);
        } catch {
          size = await fallback.add(event);
        }
        schedule();
        if (size >= ANALYTICS_FLUSH_THRESHOLD && Date.now() >= retryAt)
          void flush();
      })
      .catch(() => {});
    return writes;
  }
  function flush() {
    if (stopped) return Promise.resolve();
    if (flushing) return flushing;
    flushing = (async () => {
      await writes;
      if (!options.allowed()) {
        await clear();
        return;
      }
      if (!options.online() || Date.now() < retryAt) return;
      // Limit each wakeup to one batch per store; background tabs and offline
      // backlogs must not create an unbounded burst of keepalive requests.
      for (const store of [options.store, fallback]) {
        let events: QueuedAnalyticsEvent[];
        try {
          events = await store.claim(Date.now());
        } catch {
          continue;
        }
        if (!events.length) continue;
        if (!options.allowed()) {
          await clear();
          return;
        }
        let delivered = false;
        try {
          delivered = await options.upload(events);
        } catch {
          /* Network failure retains the original events. */
        }
        try {
          await store.settle(
            events.map((e) => e.id),
            delivered,
          );
        } catch {
          /* A persistent lease expires if acknowledgment cannot be saved. */
        }
        if (!delivered) {
          retryAt = Date.now() + backoff;
          backoff = Math.min(backoff * 2, maxBackoff);
          break;
        }
        retryAt = 0;
        backoff = ANALYTICS_FLUSH_INTERVAL;
      }
    })()
      .catch(() => {})
      .finally(() => {
        flushing = undefined;
        schedule();
      });
    return flushing;
  }
  return {
    enqueue,
    flush,
    start: schedule,
    stop() {
      stopped = true;
      clearTimeout(timer);
    },
  };
}
