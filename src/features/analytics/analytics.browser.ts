import { randomId } from "../../lib/random-id";
import type { AnalyticsEvent, AnalyticsLabel } from "./analytics.schema";
import {
  createAnalyticsStore,
  createMemoryAnalyticsStore,
} from "./analytics.db";
import { createAnalyticsQueue } from "./analytics.queue";

import { readVisitorHistory } from "./analytics.visitor";

const visitorKey = "mddex.analytics.visitor.v1";
const sessionKey = "mddex.analytics.session.v1";
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const inactivity = 30 * 60 * 1000;
type Session = { id: string; lastActive: number; returning: boolean };
let lastPage = "";
let fallbackVisitor: string | undefined;
let fallbackSession: Session | undefined;
const oncePerSession = new Set<string>();
let queue: ReturnType<typeof createAnalyticsQueue> | undefined;

export function startAnalytics() {
  if (typeof window === "undefined" || queue) return;
  let store;
  try {
    store = createAnalyticsStore(window.indexedDB);
  } catch {
    store = createMemoryAnalyticsStore();
  }
  queue = createAnalyticsQueue({
    store,
    allowed: analyticsAllowed,
    online: () => navigator.onLine !== false,
    upload: async (events) => {
      const response = await fetch("/api/analytics", {
        method: "POST",
        credentials: "omit",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events }),
        signal: AbortSignal.timeout(15_000),
      });
      return response.status === 204;
    },
  });
  const flush = () => {
    void queue!.flush();
  };
  window.addEventListener("online", flush);
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  queue.start();
}

export function analyticsAllowed() {
  return (
    typeof window !== "undefined" &&
    (import.meta.env.PROD || import.meta.env.VITE_ANALYTICS_DEBUG === "true") &&
    navigator.doNotTrack !== "1" &&
    !(navigator as Navigator & { globalPrivacyControl?: boolean })
      .globalPrivacyControl
  );
}

function identity() {
  let visitorId = fallbackVisitor;
  let session = fallbackSession;
  let seen = false;
  let persistent = false;
  try {
    const storedVisitor = localStorage.getItem(visitorKey);
    seen = !!storedVisitor && uuid.test(storedVisitor);
    visitorId = (seen ? storedVisitor! : undefined) || visitorId || randomId();
    localStorage.setItem(visitorKey, visitorId);
    persistent = true;
    const storedSession = localStorage.getItem(sessionKey);
    if (storedSession) {
      const candidate = JSON.parse(storedSession) as Partial<Session> | null;
      if (
        seen &&
        candidate &&
        typeof candidate.id === "string" &&
        uuid.test(candidate.id) &&
        typeof candidate.lastActive === "number" &&
        Number.isFinite(candidate.lastActive) &&
        typeof candidate.returning === "boolean"
      )
        session = candidate as Session;
    }
  } catch {
    /* Storage-disabled browsers use an in-memory identity. */
  }
  visitorId ||= randomId();
  const now = Date.now();
  const history = persistent
    ? readVisitorHistory(localStorage, visitorId, seen, now)
    : undefined;
  const started = !session || now - session.lastActive >= inactivity;
  if (started) session = { id: randomId(), lastActive: now, returning: seen };
  session!.lastActive = now;
  fallbackVisitor = visitorId;
  fallbackSession = session;
  try {
    localStorage.setItem(sessionKey, JSON.stringify(session));
  } catch {
    /* Best effort. */
  }
  return {
    visitorId,
    sessionId: session!.id,
    returning: session!.returning,
    visitorHistory: history
      ? {
          firstSeenAt: history.firstSeenAt,
          firstSeenKnown: history.firstSeenKnown,
        }
      : undefined,
    started,
  };
}

function send(
  event: AnalyticsEvent,
  data: ReturnType<typeof identity>,
  path: string,
  label?: AnalyticsLabel,
) {
  startAnalytics();
  void queue!.enqueue({
    id: randomId(),
    occurredAt: Date.now(),
    event,
    visitorId: data.visitorId,
    sessionId: data.sessionId,
    returning: data.returning,
    visitorHistory: data.visitorHistory,
    path,
    label,
  });
}

export function trackEvent(
  event: AnalyticsEvent,
  once = false,
  label?: AnalyticsLabel,
  canonicalPath?: string,
) {
  if (!analyticsAllowed()) return;
  try {
    const path = canonicalPath ?? location.pathname;
    if (
      path !== "/collection" &&
      path !== "/build" &&
      path !== "/mobs" &&
      !path.startsWith("/catalog/")
    )
      return;
    const data = identity();
    if (data.started) {
      oncePerSession.clear();
      send("session_started", data, path);
    }
    const key = `${data.sessionId}:${event}`;
    if (once && oncePerSession.has(key)) return;
    if (once) oncePerSession.add(key);
    send(event, data, path, label);
  } catch {
    /* Analytics must never interrupt the app. */
  }
}

export function trackPage(path: string) {
  if (path === lastPage) return;
  lastPage = path;
  trackEvent("page_view", false, undefined, path);
}
