import resourcesCss from "../features/resources/resources.css?url";
import meleeCss from "../features/resources/melee-weapons.css?url";
import { createFileRoute } from "@tanstack/react-router";
import {
  MeleeWeaponsPage,
  meleeVariants,
  type MeleeReferenceSearch,
} from "../features/resources/MeleeWeaponsPage";
import { loadSessionCatalog } from "../features/catalog/catalog.session";
import { meleeWeapons } from "../features/resources/melee-weapons";
import { pageMetadata } from "../features/seo/metadata";
const names = new Set(meleeWeapons.map((weapon) => weapon.name));
export const Route = createFileRoute("/resources/melee-weapons")({
  validateSearch: (search: Record<string, unknown>): MeleeReferenceSearch => ({
    variant:
      meleeVariants.find((entry) => entry.id === search.variant)?.id ??
      "reference",
    weapon:
      typeof search.weapon === "string" && names.has(search.weapon)
        ? search.weapon
        : "Sword",
    against:
      typeof search.against === "string" && names.has(search.against)
        ? search.against
        : "War Hammer",
  }),
  loader: async () => loadSessionCatalog().catch(() => []),
  head: () => {
    const metadata = pageMetadata({
      title: "Minecraft Dungeons 2 Melee Weapon Stats | MDDEX",
      description:
        "Compare normal and pure jump attack DPS, damage breakdowns, and combo timings for 58 Minecraft Dungeons 2 melee weapons using Hybrid’s corrected chart.",
      path: "/resources/melee-weapons",
    });
    return {
      ...metadata,
      links: [
        ...metadata.links,
        { rel: "stylesheet", href: resourcesCss },
        { rel: "stylesheet", href: meleeCss },
      ],
    };
  },
  component: MeleeRoute,
});
function MeleeRoute() {
  const catalog = Route.useLoaderData();
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <MeleeWeaponsPage
      catalog={catalog}
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
