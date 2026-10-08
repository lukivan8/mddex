import {
  ANALYTICS_BATCH_SIZE,
  ANALYTICS_BODY_LIMIT,
  ANALYTICS_RETENTION,
  queuedAnalyticsSchema,
  type QueuedAnalyticsEvent,
} from "./analytics.schema";

export const ANALYTICS_DATABASE = "mddex-analytics-v1";
export const ANALYTICS_QUEUE_LIMIT = 5000;
// Longer than the upload timeout; a crashed tab's batch becomes available again.
const leaseDuration = 60_000;
type StoredEvent = QueuedAnalyticsEvent & { leaseUntil: number };
export interface AnalyticsStore {
  add(event: QueuedAnalyticsEvent): Promise<number>;
  claim(now: number): Promise<QueuedAnalyticsEvent[]>;
  settle(ids: string[], delivered: boolean): Promise<void>;
  clear(): Promise<void>;
}

function batch(records: StoredEvent[], now: number) {
  const events: QueuedAnalyticsEvent[] = [];
  let bytes = 32;
  for (const record of records) {
    if (record.leaseUntil > now) continue;
    const parsed = queuedAnalyticsSchema.safeParse({
      id: record.id,
      occurredAt: record.occurredAt,
      event: record.event,
      visitorId: record.visitorId,
      sessionId: record.sessionId,
      returning: record.returning,
      path: record.path,
      ...(record.label ? { label: record.label } : {}),
    });
    if (!parsed.success) continue;
    const size =
      new TextEncoder().encode(JSON.stringify(parsed.data)).length + 1;
    if (bytes + size > ANALYTICS_BODY_LIMIT) break;
    events.push(parsed.data);
    bytes += size;
    if (events.length === ANALYTICS_BATCH_SIZE) break;
  }
  return events;
}

export function createMemoryAnalyticsStore(): AnalyticsStore {
  const records = new Map<string, StoredEvent>();
  return {
    async add(event) {
      records.set(event.id, { ...event, leaseUntil: 0 });
      while (records.size > ANALYTICS_QUEUE_LIMIT)
        records.delete(records.keys().next().value!);
      return records.size;
    },
    async claim(now) {
      for (const [id, event] of records)
        if (event.occurredAt < now - ANALYTICS_RETENTION) records.delete(id);
      const events = batch(
        [...records.values()].sort((a, b) => a.occurredAt - b.occurredAt),
        now,
      );
      for (const event of events)
        records.get(event.id)!.leaseUntil = now + leaseDuration;
      return events;
    },
    async settle(ids, delivered) {
      for (const id of ids) {
        if (delivered) records.delete(id);
        else if (records.has(id)) records.get(id)!.leaseUntil = 0;
      }
    },
    async clear() {
      records.clear();
    },
  };
}

export function createAnalyticsStore(factory: IDBFactory): AnalyticsStore {
  async function open() {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(ANALYTICS_DATABASE, 1);
      let expired = false;
      const fail = () => {
        expired = true;
        clearTimeout(timer);
        reject(request.error ?? new Error("Analytics storage unavailable"));
      };
      const timer = setTimeout(fail, 1500);
      request.onblocked = fail;
      request.onerror = fail;
      request.onupgradeneeded = () => {
        request.result
          .createObjectStore("events", { keyPath: "id" })
          .createIndex("occurredAt", "occurredAt");
      };
      request.onsuccess = () => {
        clearTimeout(timer);
        if (expired) request.result.close();
        else {
          request.result.onversionchange = () => request.result.close();
          resolve(request.result);
        }
      };
    });
  }
  async function transaction<T>(
    run: (store: IDBObjectStore, done: (result: T) => void) => void,
  ): Promise<T> {
    const db = await open();
    try {
      return await new Promise<T>((resolve, reject) => {
        const tx = db.transaction("events", "readwrite");
        let result: T;
        tx.oncomplete = () => resolve(result);
        tx.onabort = () =>
          reject(tx.error ?? new Error("Analytics transaction aborted"));
        tx.onerror = () =>
          reject(tx.error ?? new Error("Analytics transaction failed"));
        run(tx.objectStore("events"), (value) => {
          result = value;
        });
      });
    } finally {
      db.close();
    }
  }
  return {
    add(event) {
      return transaction<number>((store, done) => {
        store.put({ ...event, leaseUntil: 0 });
        const count = store.count();
        count.onsuccess = () => {
          const excess = count.result - ANALYTICS_QUEUE_LIMIT;
          done(Math.min(count.result, ANALYTICS_QUEUE_LIMIT));
          if (excess > 0) {
            let removed = 0;
            const cursor = store.index("occurredAt").openCursor();
            cursor.onsuccess = () => {
              if (!cursor.result || removed >= excess) return;
              cursor.result.delete();
              removed++;
              cursor.result.continue();
            };
          }
        };
      });
    },
    claim(now) {
      // Claim and lease in one transaction: simultaneous tabs cannot upload the same rows.
      return transaction<QueuedAnalyticsEvent[]>((store, done) => {
        const request = store.index("occurredAt").getAll();
        request.onsuccess = () => {
          const records = request.result as StoredEvent[];
          for (const record of records)
            if (record.occurredAt < now - ANALYTICS_RETENTION)
              store.delete(record.id);
          const events = batch(
            records.filter((r) => r.occurredAt >= now - ANALYTICS_RETENTION),
            now,
          );
          for (const event of events)
            store.put({ ...event, leaseUntil: now + leaseDuration });
          done(events);
        };
      });
    },
    settle(ids, delivered) {
      return transaction<void>((store, done) => {
        for (const id of ids) {
          if (delivered) store.delete(id);
          else {
            const request = store.get(id);
            request.onsuccess = () => {
              if (request.result)
                store.put({ ...request.result, leaseUntil: 0 });
            };
          }
        }
        done(undefined);
      });
    },
    clear() {
      return transaction<void>((store, done) => {
        store.clear();
        done(undefined);
      });
    },
  };
}
