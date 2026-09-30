import { createFileRoute } from "@tanstack/react-router";
import { loadSessionCatalog } from "../features/catalog/catalog.session";
import { WeaponComparePage } from "../features/catalog-details/WeaponComparePage";
import { catalogReturnPath } from "../features/catalog-details/catalog-detail.loader";
import type { WeaponCompareSearch } from "../features/catalog-details/weapon-compare.model";
import { pageMetadata } from "../features/seo/metadata";
import {
  parsePower,
  powerFromReturnPath,
  powerParam,
} from "../features/catalog/power";

export const Route = createFileRoute("/compare")({
  validateSearch: (search: Record<string, unknown>): WeaponCompareSearch => {
    const returnTo = catalogReturnPath(
      typeof search.returnTo === "string" ? search.returnTo : undefined,
    );
    return {
      mode: search.mode === "ranged" ? "ranged" : "melee",
      left: typeof search.left === "string" ? search.left : undefined,
      right: typeof search.right === "string" ? search.right : undefined,
      returnTo,
      power: powerParam(
        search.power == null
          ? powerFromReturnPath(returnTo)
          : parsePower(search.power),
      ),
    };
  },
  loader: async () =>
    (await loadSessionCatalog()).filter(
      (item) =>
        item.category === "melee_weapon" || item.category === "ranged_weapon",
    ),
  head: () =>
    pageMetadata({
      title: "Compare Minecraft Dungeons 2 Weapons | MDDEX",
      description:
        "Compare Minecraft Dungeons 2 melee and ranged weapon stats side by side.",
      path: "/compare",
      noindex: true,
    }),
  component: CompareRoute,
});

function CompareRoute() {
  const weapons = Route.useLoaderData();
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <WeaponComparePage
      weapons={weapons}
      filters={filters}
      onChange={(patch) => {
        void navigate({
          search: { ...filters, ...patch },
          replace: true,
          resetScroll: false,
        });
      }}
    />
  );
}
