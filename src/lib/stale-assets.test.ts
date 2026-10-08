import { expect, it, vi } from "vitest";
import {
  isStaleAssetError,
  missingAssetResponse,
  reloadForStaleAssets,
} from "./stale-assets";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

it("answers missing hashed assets with an uncached plain 404", async () => {
  const response = missingAssetResponse(
    new Request("https://mddex.net/assets/RichDescription-Dk3vMSyD.js"),
  );
  expect(response?.status).toBe(404);
  expect(response?.headers.get("Content-Type")).toMatch(/^text\/plain/);
  expect(response?.headers.get("Cache-Control")).toBe("no-store");
  expect(await response?.text()).toBe("Not found");
});

it.each([
  "https://mddex.net/build",
  "https://mddex.net/assets-guide",
  "https://mddex.net/",
])("leaves other paths to the application: %s", (url) => {
  expect(missingAssetResponse(new Request(url))).toBeUndefined();
});

it.each([
  "Failed to fetch dynamically imported module: https://mddex.net/assets/a.js",
  "error loading dynamically imported module",
  "Importing a module script failed.",
  "Unable to preload CSS for /assets/community-B2EeFEsB.css",
])("recognizes stale chunk errors: %s", (message) => {
  expect(isStaleAssetError(new TypeError(message))).toBe(true);
});

it("ignores unrelated errors", () => {
  expect(isStaleAssetError(new Error("Catalog request failed (503)"))).toBe(
    false,
  );
  expect(isStaleAssetError(undefined)).toBe(false);
});

it("reloads once, then waits for the cooldown before reloading again", () => {
  const storage = memoryStorage();
  const reload = vi.fn();
  expect(reloadForStaleAssets(storage, reload, 1_000)).toBe(true);
  expect(reloadForStaleAssets(storage, reload, 20_000)).toBe(false);
  expect(reloadForStaleAssets(storage, reload, 31_001)).toBe(true);
  expect(reload).toHaveBeenCalledTimes(2);
});

it("does not reload when storage is unavailable", () => {
  const reload = vi.fn();
  const blocked = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {},
  };
  expect(reloadForStaleAssets(blocked, reload, 1_000)).toBe(false);
  expect(reload).not.toHaveBeenCalled();
});
