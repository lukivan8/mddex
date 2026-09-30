import { expect, it } from "vitest";
import { normalizeDetailItem } from "./catalog-detail.loader";
import { isChestTalisman } from "./catalog-detail.model";
import { itemSeo } from "./catalog-detail.seo";

it.each(["Ocelot's Paw", "Soul Chip"])(
  "shows chest acquisition for %s despite its quest source",
  (name) => {
    const item = normalizeDetailItem({
      slug: name,
      category: "talisman",
      type: "talisman",
      variation: name,
      image: null,
      game_data: {
        sources: [
          { type: "quest", name: "Quest reward" },
          { type: "chest", name: "Talisman chest" },
        ],
      },
    });
    expect(isChestTalisman(item)).toBe(true);
    expect(itemSeo(item, []).sections).toContainEqual({
      heading: `Where can ${name} drop?`,
      text: "Found in chests",
    });
    item.game_data.sources = [{ type: "quest", name: "Quest reward" }];
    expect(isChestTalisman(item)).toBe(false);
  },
);
