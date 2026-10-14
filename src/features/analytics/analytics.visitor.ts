// This is first observed tracked activity on this origin, not a person's first visit.
export const visitorHistoryKey = "mddex.analytics.first-seen.v1";
export const analyticsDay = (time: number) =>
  Math.floor((time + 5 * 60 * 60 * 1000) / 86400000);
export type VisitorHistory = {
  visitorId: string;
  firstSeenAt: number;
  firstSeenKnown: boolean;
};
export function readVisitorHistory(
  storage: Pick<Storage, "getItem" | "setItem">,
  visitorId: string,
  existing: boolean,
  now: number,
): VisitorHistory | undefined {
  try {
    const raw = storage.getItem(visitorHistoryKey);
    const record = raw
      ? (JSON.parse(raw) as Partial<VisitorHistory> | null)
      : null;
    if (
      record?.visitorId === visitorId &&
      typeof record.firstSeenAt === "number" &&
      Number.isInteger(record.firstSeenAt) &&
      record.firstSeenAt > 0 &&
      record.firstSeenAt <= now &&
      typeof record.firstSeenKnown === "boolean"
    )
      return record as VisitorHistory;
  } catch {
    // Malformed/blocked metadata cannot establish historical first-seen activity.
  }
  const history = { visitorId, firstSeenAt: now, firstSeenKnown: !existing };
  try {
    storage.setItem(visitorHistoryKey, JSON.stringify(history));
    return history;
  } catch {
    return undefined;
  }
}
export function dailyCohort(
  history: Pick<VisitorHistory, "firstSeenAt" | "firstSeenKnown"> | undefined,
  occurredAt: number,
): "new" | "returning" | "unknown" {
  if (!history || history.firstSeenAt > occurredAt) return "unknown";
  if (analyticsDay(history.firstSeenAt) < analyticsDay(occurredAt))
    return "returning";
  return history.firstSeenKnown ? "new" : "unknown";
}
