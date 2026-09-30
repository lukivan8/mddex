import { expect, it } from "vitest";
import { emptyBuild } from "./build.service";
import { encodeBuildLink, decodeBuildLink } from "./build.link";

it("round trips every slot, sparse modifiers, Unicode names and unknown slugs", async () => {
  const build = emptyBuild("火 🔥 Shared loadout");
  build.slots.melee = {
    itemSlug: "melee-sword",
    enchantments: ["fire"],
    effects: ["damage", null, "third"],
  };
  build.slots.artifact1 = {
    itemSlug: "unknown-artifact",
    enchantments: [],
    effects: [null, "damage", null],
  };
  build.slots.talisman3 = {
    itemSlug: "unknown-talisman",
    enchantments: [],
    effects: [],
  };
  const token = await encodeBuildLink(build);
  expect(token).toMatch(/^1\.[A-Za-z0-9_-]+$/);
  expect(token.length).toBeLessThan(JSON.stringify(build).length / 2);
  const decoded = await decodeBuildLink(token);
  expect(decoded.name).toBe(build.name);
  expect(decoded.slots).toEqual(build.slots);
  expect(decoded.id).not.toBe(build.id);
});
it("empty builds round trip", async () => {
  const build = emptyBuild();
  expect((await decodeBuildLink(await encodeBuildLink(build))).slots).toEqual(
    build.slots,
  );
});
it("rejects malformed, oversized, unsupported and damaged links", async () => {
  for (const token of [
    "",
    "2.abc",
    "1.%bad",
    "1." + "a".repeat(8192),
    "1.abc",
  ]) {
    await expect(decodeBuildLink(token)).rejects.toThrow(
      "saved loadouts have not been changed",
    );
  }
});
async function tokenFor(payload: unknown) {
  const bytes = await new Response(
    new Blob([JSON.stringify(payload)])
      .stream()
      .pipeThrough(new CompressionStream("deflate")),
  ).arrayBuffer();
  return `1.${Buffer.from(bytes).toString("base64url")}`;
}
it("opens legacy three-effect links with all three effects", async () => {
  const slots = Array(12).fill(null);
  slots[0] = [1, 2, 3, 4, 5];
  slots[6] = [6, 0, 4, 3, 5];
  const oldToken = await tokenFor([
    "Legacy",
    ["weapon", "enchant", "first", "second", "third", "artifact"],
    slots,
  ]);
  const build = await decodeBuildLink(oldToken);
  expect(build.slots.melee).toEqual({
    itemSlug: "weapon",
    enchantments: ["enchant"],
    effects: ["first", "second", "third"],
  });
  expect(build.slots.artifact1?.effects).toEqual(["second", "first", "third"]);
  const currentToken = await encodeBuildLink(build);
  expect((await decodeBuildLink(currentToken)).slots).toEqual(build.slots);
});
it("rejects invalid references, slot shapes, forbidden modifiers and decompression bombs", async () => {
  const slots = () => Array(12).fill(null);
  const badReference = slots();
  badReference[0] = [2];
  const badTalisman = slots();
  badTalisman[9] = [1, 0, 1];
  const badArtifact = slots();
  badArtifact[6] = [1, 1];
  for (const payload of [
    ["name", ["slug"], badReference],
    ["name", ["slug"], badTalisman],
    ["name", ["slug"], badArtifact],
    ["name", [], []],
    "a".repeat(100_000),
  ]) {
    await expect(decodeBuildLink(await tokenFor(payload))).rejects.toThrow();
  }
});
