import { afterEach, expect, it, vi } from "vitest";
import type { CatalogItem as PublishedItem } from "../catalog/catalog.types";
import {
  loadDetailPage,
  loadDetailRoute,
  normalizeDetailItem,
  prepareDetailCatalog,
  projectDetailCard,
} from "./catalog-detail.loader";
import { dropSources, itemPath } from "./catalog-detail.model";
import { itemSeo } from "./catalog-detail.seo";
import { locationMetadata } from "./catalog-detail.enrichment";

const session = vi.hoisted(() => ({
  load: vi.fn<() => Promise<PublishedItem[]>>(),
  detail: vi.fn<(item: PublishedItem) => Promise<PublishedItem>>(),
  read: vi.fn<(item: PublishedItem) => Promise<PublishedItem | undefined>>(),
}));
vi.mock("../catalog/catalog.session", () => ({
  loadSessionCatalog: session.load,
  loadSessionCatalogDetail: session.detail,
  readSessionCatalogDetail: session.read,
}));
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

function entry(
  slug: string,
  category: string,
  game_data: Record<string, unknown> = {},
): PublishedItem {
  return {
    slug,
    category,
    type: category,
    variation: slug,
    image: null,
    description: "Index description",
    game_data: { slug, ...game_data },
  };
}
function useCatalog(items: PublishedItem[]) {
  session.load.mockResolvedValue(items);
  session.detail.mockImplementation(async (item) => item);
}

it.each([
  ["melee_weapon", "melee-weapons"],
  ["ranged_weapon", "ranged-weapons"],
  ["armor", "armor"],
  ["artifact", "artifacts"],
  ["enchantment", "enchantments"],
  ["gear_effect", "gear-effects"],
  ["talisman", "talismans"],
  ["mob", "mobs"],
  ["location", "locations"],
  ["status", "status"],
  ["cape", "cape"],
  ["pet", "pet"],
])(
  "preserves %s detail identity, SEO and related links",
  async (category, lane) => {
    const target = entry("linked", "gear_effect");
    const current = entry("current", category, {
      slug: "canonical-name",
      effects: [
        { name: "linked", catalog_slug: "linked", text: "Rendered effect" },
      ],
    });
    useCatalog([current, target]);
    const page = await loadDetailPage(lane, "canonical-name");
    expect(itemPath(page.item)).toBe(`/catalog/${lane}/canonical-name`);
    expect(itemSeo(page.item, page.catalog, 1, page.sources).canonical).toBe(
      `https://mddex.net/catalog/${lane}/canonical-name`,
    );
    expect(page.item.description).toBe("Index description");
    expect(page.item.game_data.effects?.[0].text).toBe("Rendered effect");
    expect(page.catalog.map((item) => item.slug)).toEqual(["linked"]);
    expect(page.catalog[0].game_data.slug).toBe("linked");
  },
);

it("reuses one prepared snapshot and separates releases with the same source and slugs", () => {
  const first = [entry("same", "mob", { slug: "old-path" })];
  const second = [
    {
      ...first[0],
      game_data: { slug: "new-path" },
      detail_path: "https://cdn.test/releases/v2/same.json",
    },
  ];
  const prepared = prepareDetailCatalog(first);
  expect(prepareDetailCatalog(first)).toBe(prepared);
  const changed = prepareDetailCatalog(second);
  expect(changed).not.toBe(prepared);
  expect(changed.positions.has("/catalog/mobs/old-path")).toBe(false);
  expect(changed.positions.get("/catalog/mobs/new-path")).toBe(0);
  expect(prepared.positions.get("/catalog/mobs/old-path")).toBe(0);
});

it("does not cache an incomplete projection when normalization fails", () => {
  let fail = true;
  const current = entry("retry", "mob");
  Object.defineProperty(current, "game_data", {
    get() {
      if (fail) throw new Error("Incomplete snapshot");
      return { slug: "retry" };
    },
  });
  const published = [current];
  expect(() => prepareDetailCatalog(published)).toThrow("Incomplete snapshot");
  fail = false;
  expect(
    prepareDetailCatalog(published).positions.get("/catalog/mobs/retry"),
  ).toBe(0);
});

it("isolates concurrent detail overlays across requests and releases", async () => {
  const first = [entry("same", "artifact")];
  const second = [
    { ...first[0], variation: "New release", description: "New index" },
  ];
  session.load.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
  let finishOld!: (detail: PublishedItem) => void;
  let finishNew!: (detail: PublishedItem) => void;
  session.detail
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = resolve;
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishNew = resolve;
        }),
    );
  const oldRequest = loadDetailPage("artifacts", "same");
  const newRequest = loadDetailPage("artifacts", "same");
  await vi.waitFor(() => expect(session.detail).toHaveBeenCalledTimes(2));
  finishNew({ ...second[0], description: "New full detail" });
  const fresh = await newRequest;
  finishOld({ ...first[0], description: "Old full detail" });
  const old = await oldRequest;
  expect(fresh.item.description).toBe("New full detail");
  expect(old.item.description).toBe("Old full detail");
  expect(prepareDetailCatalog(first).catalog[0].description).toBe(
    "Index description",
  );
  expect(prepareDetailCatalog(second).catalog[0].description).toBe("New index");
});

it("retries a failed shard using the same prepared snapshot", async () => {
  const published = [entry("retry", "artifact")];
  useCatalog(published);
  const prepared = prepareDetailCatalog(published);
  session.detail.mockRejectedValueOnce(new Error("Temporary shard failure"));
  await expect(loadDetailPage("artifacts", "retry")).rejects.toThrow(
    "Temporary shard failure",
  );
  expect((await loadDetailPage("artifacts", "retry")).item.slug).toBe("retry");
  expect(prepareDetailCatalog(published)).toBe(prepared);
});

it("preserves location rendering data while removing unused large fields and duplicate current items", async () => {
  const huge = "unused-payload".repeat(20_000);
  const sword = entry("sword", "melee_weapon");
  const mob = entry("witch", "mob", {
    drops: [{ name: "Sword", catalog_slug: "sword" }],
  });
  const entrance = entry("entrance", "location");
  const current = entry("woods", "location", {
    quest_graph: { quests: huge },
    drop_chance_context: { calculations: huge },
    wikily: {
      lead: "Published location overview",
      region: "Overworld",
      nDungeon: 2,
      gear: [{ title: "Sword", catalog_slug: "sword" }],
      mobs: [{ title: "Witch", catalog_slug: "witch" }],
      entries: [{ title: "Entrance", catalog_slug: "entrance" }],
    },
    location_context: {
      instances: [
        {
          name: "A dungeon",
          lead: "Entrance directions",
          levels: [{ title: "Floor", description: "Keep this level text" }],
        },
      ],
    },
  });
  useCatalog([current, sword, mob, entrance]);
  const page = await loadDetailPage("locations", "woods");
  expect(page.item.game_data).not.toHaveProperty("quest_graph");
  expect(page.item.game_data).not.toHaveProperty("drop_chance_context");
  expect(JSON.stringify(page).length).toBeLessThan(10_000);
  expect(page.catalog.map((item) => item.slug)).toEqual([
    "sword",
    "witch",
    "entrance",
  ]);
  const location = locationMetadata(page.item, [page.item, ...page.catalog]);
  expect(location.overview).toBe("Published location overview");
  expect(location.region).toBe("Overworld");
  expect(location.dungeonCount).toBe(2);
  expect(location.loot[0].catalog_slug).toBe("sword");
  expect(location.mobs[0].catalog_slug).toBe("witch");
  expect(location.entrances).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ catalog_slug: "entrance" }),
      expect.objectContaining({
        name: "A dungeon",
        description: "Entrance directions Floor: Keep this level text",
      }),
    ]),
  );
  // The quest page and builder continue to receive the untouched raw shard/index.
  expect(current.game_data?.quest_graph).toEqual({ quests: huge });
  expect(current.game_data?.drop_chance_context).toEqual({
    calculations: huge,
  });
});

it("preserves builder eligibility and derived secret/cosmetic/status content without mutating raw entries", () => {
  const gear = entry("gear", "armor", {
    enchantment_options: { types: ["gear_effect"] },
    rollable_effects: { effects: [{ name: "Effect", catalog_slug: "effect" }] },
  });
  const original = JSON.stringify(gear);
  normalizeDetailItem(gear);
  expect(JSON.stringify(gear)).toBe(original);
  const status = normalizeDetailItem(
    entry("frozen", "status", {
      wikily: {
        alignment: "negative",
        gear: [{ title: "Gear", catalog_slug: "gear" }],
        immune: [{ title: "Witch", catalog_slug: "witch" }],
      },
    }),
  );
  expect(status.game_data.status?.gear[0].catalog_slug).toBe("gear");
  expect(status.game_data.status?.immune[0].catalog_slug).toBe("witch");
  const pet = normalizeDetailItem({
    ...entry("pet", "pet", {
      reference_context: {
        pages: [
          { cards: [{ name: "Pet", text: "A pet. Unlocked in a quest." }] },
        ],
      },
    }),
    variation: "Pet",
    description: "A pet.",
  });
  expect(pet.game_data.cosmeticUnlock).toBe("Unlocked in a quest.");
});

it("keeps browser core content available before enrichment and reports a failed enrichment", async () => {
  const current = entry("lazy", "artifact");
  useCatalog([current]);
  vi.stubGlobal("window", {});
  session.read.mockResolvedValue(undefined);
  session.detail.mockRejectedValueOnce(new Error("Offline shard"));
  const page = await loadDetailRoute("artifacts", "lazy");
  expect(page.item.description).toBe("Index description");
  expect(await page.enrichment).toEqual({
    data: expect.objectContaining({ item: page.item }),
    failed: true,
  });
});

it("projects related card consumers explicitly without carrying full dossiers", () => {
  const huge = "unused payload".repeat(10_000);
  const published = {
    ...entry("effect", "gear_effect", {
      slug: "effect-path",
      tiers: [
        { tier: "III", text: "Boost by 30%", talisman: true, evidence: huge },
      ],
      sources: [{ name: "Source", type: "area", description: huge }],
      areas: [{ name: "Area", description: huge }],
      book: { sources: [{ name: "Book source", description: huge }] },
      fights: [{ kind: "boss", place: huge }],
      pair: { evidence: huge },
    }),
    image: "https://cdn.test/effect.webp",
    description: "Effect tooltip",
  };
  const original = JSON.stringify(published);
  const card = projectDetailCard(normalizeDetailItem(published));
  expect(card).toEqual({
    slug: "effect",
    category: "gear_effect",
    type: "gear_effect",
    name: "effect",
    image: "https://cdn.test/effect.webp",
    description: "Effect tooltip",
    game_data: {
      slug: "effect-path",
      set: undefined,
      slot: undefined,
      tiers: [{ tier: "III", text: "Boost by 30%", talisman: true }],
      drops: [],
    },
  });
  expect(itemPath(card)).toBe("/catalog/gear-effects/effect-path");
  expect(JSON.stringify(card).length).toBeLessThan(500);
  expect(JSON.stringify(published)).toBe(original);
});

it("preserves reverse mob-drop sources and SEO with projected cards", () => {
  const current = normalizeDetailItem(entry("sword", "melee_weapon"));
  const mob = normalizeDetailItem({
    ...entry("witch", "mob", {
      slug: "witch-path",
      drops: [
        {
          name: "Sword",
          catalog_slug: "sword",
          description: "Unused drop prose",
        },
      ],
      areas: [{ name: "Unused area", catalog_slug: "woods" }],
    }),
    variation: "Witch",
  });
  const full = [current, mob];
  const cards = full.map(projectDetailCard);
  expect(cards[1].game_data.drops).toEqual([{ catalog_slug: "sword" }]);
  expect(dropSources(current, cards)).toEqual(dropSources(current, full));
  expect(dropSources(current, cards)).toEqual([
    expect.objectContaining({
      name: "Witch",
      type: "mob",
      catalog_slug: "witch",
    }),
  ]);
  expect(itemSeo(current, cards, 1)).toEqual(itemSeo(current, full, 1));
  expect(itemSeo(current, cards, 2, dropSources(current, full))).toEqual(
    itemSeo(current, full, 2, dropSources(current, full)),
  );
});

it("preserves location groups and source-card classification with projected cards", () => {
  const current = normalizeDetailItem(
    entry("woods", "location", {
      loot: [
        { name: "Sword", catalog_slug: "sword", description: "Loot condition" },
      ],
      wikily: {
        lead: "Overview",
        region: "Overworld",
        gear: [{ title: "Sword", catalog_slug: "sword" }],
      },
      location_context: {
        source_details: [
          {
            cards: [
              {
                name: "Witch",
                text: "Mob condition",
                links: [{ catalog_slug: "witch" }],
              },
              {
                name: "Cave",
                text: "Entrance condition",
                links: [{ catalog_slug: "cave" }],
              },
            ],
          },
        ],
        instances: [{ name: "Dungeon", lead: "Dungeon directions" }],
      },
    }),
  );
  const catalog = [
    current,
    normalizeDetailItem(entry("sword", "melee_weapon")),
    normalizeDetailItem(entry("witch", "mob")),
    normalizeDetailItem(entry("cave", "location")),
  ];
  const metadata = locationMetadata(current, catalog.map(projectDetailCard));
  expect(metadata).toEqual(locationMetadata(current, catalog));
  expect(metadata.mobs).toEqual([
    expect.objectContaining({
      catalog_slug: "witch",
      description: "Mob condition",
    }),
  ]);
  expect(metadata.entrances).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        catalog_slug: "cave",
        description: "Entrance condition",
      }),
      expect.objectContaining({
        name: "Dungeon",
        description: "Dungeon directions",
      }),
    ]),
  );
});

it("keeps armor set slots and effect tooltip tiers in reusable related cards", async () => {
  const armor = ["helmet", "chest", "leggings", "boots"].map((slot) =>
    entry(slot, "armor", {
      set: "Test set",
      slot,
      rollable_effects: {
        effects: [{ name: "Effect", catalog_slug: "effect" }],
      },
      quest_graph: { unused: "large".repeat(1000) },
    }),
  );
  const effect = entry("effect", "gear_effect", {
    tiers: [
      { tier: "I", text: "Boost by 10%" },
      { tier: "II", text: "Boost by 20%" },
    ],
  });
  const published = [
    ...armor,
    effect,
    entry("other", "armor", { set: "Other set", slot: "boots" }),
  ];
  const original = JSON.stringify(published);
  useCatalog(published);
  const prepared = prepareDetailCatalog(published);
  const first = await loadDetailPage("armor", "helmet");
  const second = await loadDetailPage("armor", "helmet");
  expect(first.catalog.map((card) => card.slug)).toEqual([
    "chest",
    "leggings",
    "boots",
    "effect",
  ]);
  expect(first.catalog.slice(0, 3).map((card) => card.game_data.slot)).toEqual([
    "chest",
    "leggings",
    "boots",
  ]);
  expect(first.catalog[3].game_data.tiers?.map((tier) => tier.text)).toEqual([
    "Boost by 10%",
    "Boost by 20%",
  ]);
  for (const card of first.catalog) {
    expect(card).toBe(prepared.cards.find((entry) => entry.slug === card.slug));
    expect(card).toBe(second.catalog.find((entry) => entry.slug === card.slug));
    expect(card.game_data).not.toHaveProperty("quest_graph");
  }
  expect(published[0].game_data?.rollable_effects).toEqual({
    effects: [{ name: "Effect", catalog_slug: "effect" }],
  });
  expect(JSON.stringify(published)).toBe(original);
});
