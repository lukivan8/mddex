import { describe, expect, it } from "vitest";
import type { CatalogItem } from "../catalog/catalog.types";
import { catalogSitemap } from "./sitemap";

describe("catalogSitemap", () => {
  it("lists canonical detail URLs from the published catalog", () => {
    const items = [
      {
        slug: "melee_weapon-prospectors-pick",
        category: "melee_weapon",
        type: "pickaxes",
        variation: "The Prospector's Pick",
        image: null,
        game_data: { slug: "the-prospectors-pick" },
      },
      {
        slug: "mob-copper-monstrosity",
        category: "mob",
        type: "boss",
        variation: "Copper Monstrosity",
        image: null,
        game_data: { slug: "copper-monstrosity" },
      },
      {
        slug: "status-strength",
        category: "status",
        type: "status",
        variation: "Strength",
        image: null,
      },
    ] satisfies CatalogItem[];
    const xml = catalogSitemap(items);
    expect(xml).toContain("<loc>https://mddex.net/build</loc>");
    expect(xml).toContain("<loc>https://mddex.net/collection</loc>");
    expect(xml).toContain(
      "<loc>https://mddex.net/catalog/melee-weapons/the-prospectors-pick</loc>",
    );
    expect(xml).toContain(
      "<loc>https://mddex.net/catalog/mobs/copper-monstrosity</loc>",
    );
    expect(xml).toContain(
      "<loc>https://mddex.net/catalog/status/status-strength</loc>",
    );
    expect(xml).toContain("<loc>https://mddex.net/resources</loc>");
    expect(xml).toContain("<loc>https://mddex.net/resources/soul-storm</loc>");
    expect(xml).toContain(
      "<loc>https://mddex.net/resources/melee-weapons</loc>",
    );
    expect(xml).toContain(
      "<loc>https://mddex.net/resources/soul-storm-routes</loc>",
    );
    expect(xml).toContain("<loc>https://mddex.net/resources/quests</loc>");
    expect(xml).toContain("<loc>https://mddex.net/resources/planner</loc>");
    expect(xml.match(/<url>/g)).toHaveLength(16);
  });
});
