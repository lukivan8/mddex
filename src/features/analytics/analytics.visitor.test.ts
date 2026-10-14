import { describe, expect, it } from "vitest";
import {
  analyticsDay,
  dailyCohort,
  readVisitorHistory,
  visitorHistoryKey,
} from "./analytics.visitor";
const first = Date.parse("2026-10-14T18:59:59Z"); // 23:59:59 Almaty
function storage() {
  const records = new Map<string, string>();
  return {
    getItem: (key: string) => records.get(key) ?? null,
    setItem: (key: string, value: string) => {
      records.set(key, value);
    },
  };
}
describe("daily visitor history", () => {
  it("keeps a new visitor new across repeat sessions/tabs and reloads that day", () => {
    const store = storage();
    const initial = readVisitorHistory(
      store,
      "browser",
      false,
      first - 3600000,
    );
    const repeat = readVisitorHistory(store, "browser", true, first);
    expect(repeat).toEqual(initial);
    expect(dailyCohort(repeat, first)).toBe("new");
    expect(dailyCohort(repeat, first + 1000)).toBe("returning");
    expect(analyticsDay(first + 1000)).toBe(analyticsDay(first) + 1);
  });
  it("does not invent first-seen history for legacy IDs", () => {
    const store = storage();
    const baseline = readVisitorHistory(store, "legacy", true, first);
    expect(dailyCohort(baseline, first)).toBe("unknown");
    expect(
      dailyCohort(
        readVisitorHistory(store, "legacy", true, first + 500),
        first + 500,
      ),
    ).toBe("unknown");
    expect(dailyCohort(baseline, first + 1000)).toBe("returning");
  });
  it("makes blocked storage and invalid/future evidence unknown", () => {
    const blocked = {
      getItem() {
        throw Error();
      },
      setItem() {
        throw Error();
      },
    };
    expect(
      readVisitorHistory(blocked, "browser", false, first),
    ).toBeUndefined();
    expect(dailyCohort(undefined, first)).toBe("unknown");
    expect(
      dailyCohort({ firstSeenAt: first + 1, firstSeenKnown: true }, first),
    ).toBe("unknown");
    const store = storage();
    store.setItem(visitorHistoryKey, "broken");
    expect(
      readVisitorHistory(store, "legacy", true, first)?.firstSeenKnown,
    ).toBe(false);
  });
  it("ties history to the UUID and resets after identity is cleared", () => {
    const store = storage();
    readVisitorHistory(store, "old", false, first - 86400000);
    expect(
      dailyCohort(readVisitorHistory(store, "new", false, first), first),
    ).toBe("new");
  });
});
