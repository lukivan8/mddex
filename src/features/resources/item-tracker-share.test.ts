import { expect, it } from "vitest";
import { readTrackerShare, trackerShareToken } from "./item-tracker-share";
it("round-trips a compact collection snapshot without catalog-order dependencies", async () => {
  const marks = new Set([
    "sword:special",
    "sword:soul_special",
    "unique:soul_unique",
  ]);
  const token = await trackerShareToken(marks);
  expect(token).toMatch(/^[\w-]+$/);
  expect(await readTrackerShare(token)).toEqual(marks);
});
it("rejects malformed and oversized shared collections", async () => {
  await expect(readTrackerShare("!")).rejects.toThrow();
  await expect(readTrackerShare("a".repeat(60001))).rejects.toThrow();
  const json = JSON.stringify({ version: 2, collected: ["x".repeat(500001)] });
  const buffer = await new Response(
    new Blob([json]).stream().pipeThrough(new CompressionStream("gzip")),
  ).arrayBuffer();
  const token = btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
  await expect(readTrackerShare(token)).rejects.toThrow("too large");
});
