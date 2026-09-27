import { afterEach, expect, it, vi } from "vitest";
import { preloadCatalogArtwork } from "./catalog.artwork";

class TestImage {
  static created: TestImage[] = [];
  src = "";
  fetchPriority = "";
  decoding = "";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  removeAttribute = vi.fn();
  constructor() {
    TestImage.created.push(this);
  }
}
function setup() {
  vi.useFakeTimers();
  vi.stubGlobal("Image", TestImage);
  vi.stubGlobal("requestIdleCallback", undefined);
  TestImage.created = [];
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("defers work, deduplicates URLs and bounds concurrent requests, including failures", () => {
  setup();
  const stop = preloadCatalogArtwork(
    [null, "a", "a", "b", "c", "d", "e"].map((image) => ({ image })),
  );
  expect(TestImage.created).toHaveLength(0);
  vi.advanceTimersByTime(200);
  expect(TestImage.created.map((i) => i.src)).toEqual(["a", "b", "c"]);
  expect(TestImage.created.every((i) => i.fetchPriority === "low")).toBe(true);
  TestImage.created[0].onload!();
  expect(TestImage.created.map((i) => i.src)).toEqual(["a", "b", "c", "d"]);
  TestImage.created[1].onerror!();
  expect(TestImage.created.map((i) => i.src)).toEqual([
    "a",
    "b",
    "c",
    "d",
    "e",
  ]);
  stop();
  expect(
    TestImage.created
      .slice(2)
      .every(
        (i) => i.onload === null && i.removeAttribute.mock.calls.length === 1,
      ),
  ).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});
it("cancels before starting and moves past stalled requests", () => {
  setup();
  preloadCatalogArtwork([{ image: "unused" }])();
  vi.advanceTimersByTime(200);
  expect(TestImage.created).toHaveLength(0);
  const stop = preloadCatalogArtwork(
    ["a", "b", "c", "d"].map((image) => ({ image })),
  );
  vi.advanceTimersByTime(15_200);
  expect(TestImage.created.map((i) => i.src)).toEqual(["a", "b", "c", "d"]);
  expect(TestImage.created[0].removeAttribute).toHaveBeenCalledWith("src");
  stop();
});
it("uses idle scheduling when available", () => {
  setup();
  const idle = vi.fn(() => 42);
  const cancel = vi.fn();
  vi.stubGlobal("requestIdleCallback", idle);
  vi.stubGlobal("cancelIdleCallback", cancel);
  const stop = preloadCatalogArtwork([{ image: "a" }]);
  expect(idle).toHaveBeenCalledWith(expect.any(Function), { timeout: 1000 });
  expect(TestImage.created).toHaveLength(0);
  stop();
  expect(cancel).toHaveBeenCalledWith(42);
});
