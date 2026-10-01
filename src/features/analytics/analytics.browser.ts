import { randomId } from "../../lib/random-id";
import type { AnalyticsEvent, AnalyticsLabel } from "./analytics.schema";

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
  try {
    const storedVisitor = localStorage.getItem(visitorKey);
    seen = !!storedVisitor && uuid.test(storedVisitor);
    visitorId = (seen ? storedVisitor! : undefined) || visitorId || randomId();
    localStorage.setItem(visitorKey, visitorId);
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
    started,
  };
}

function send(
  event: AnalyticsEvent,
  data: ReturnType<typeof identity>,
  path: string,
  label?: AnalyticsLabel,
) {
  const body = JSON.stringify({
    event,
    visitorId: data.visitorId,
    sessionId: data.sessionId,
    returning: data.returning,
    path,
    label,
  });
  // JSON + same-origin requests prevent cross-site form submissions. keepalive survives navigation.
  void fetch("/api/analytics", {
    method: "POST",
    credentials: "omit",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body,
  }).catch(() => {});
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
