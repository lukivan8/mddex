import { createFileRoute } from "@tanstack/react-router";
import { CatalogDetailPage } from "../features/catalog-details/CatalogDetailPage";
import {
  loadDetailPage,
  catalogReturnPath,
} from "../features/catalog-details/catalog-detail.loader";
import { itemSeo } from "../features/catalog-details/catalog-detail.seo";
import { itemPath } from "../features/catalog-details/catalog-detail.model";
import { pageMetadata } from "../features/seo/metadata";
import {
  parsePower,
  powerFromReturnPath,
  powerParam,
  returnPathAtPower,
} from "../features/catalog/power";
export const Route = createFileRoute("/catalog/$category/$slug")({
  staleTime: Infinity,
  preloadStaleTime: Infinity,
  validateSearch: (search: Record<string, unknown>) => {
    const returnTo =
      typeof search.returnTo === "string"
        ? catalogReturnPath(search.returnTo)
        : undefined;
    return {
      returnTo,
      power: powerParam(
        search.power == null
          ? powerFromReturnPath(returnTo)
          : parsePower(search.power),
      ),
    };
  },
  loader: ({ params }) => loadDetailPage(params.category, params.slug),
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { item, catalog, sources } = loaderData;
    const seo = itemSeo(item, catalog, 1, sources);
    const directory =
      item.category === "mob" || item.category === "location"
        ? { name: "Mobs and locations", path: "/mobs" }
        : { name: "Equipment catalog", path: "/collection" };
    return {
      ...pageMetadata({
        title: seo.title,
        description: seo.description,
        path: itemPath(item),
      }),
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            url: seo.canonical,
            name: seo.title,
            description: seo.description,
            mainEntity: {
              "@type": "Thing",
              name: item.name,
              description: seo.introduction,
              ...(item.image ? { image: item.image } : {}),
            },
          }).replace(/</g, "\\u003c"),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "MDDEX",
                item: "https://mddex.net/build",
              },
              {
                "@type": "ListItem",
                position: 2,
                name: directory.name,
                item: `https://mddex.net${directory.path}`,
              },
              {
                "@type": "ListItem",
                position: 3,
                name: item.name,
                item: seo.canonical,
              },
            ],
          }).replace(/</g, "\\u003c"),
        },
      ],
    };
  },
  component: DetailRoute,
});
function DetailRoute() {
  const data = Route.useLoaderData();
  const { returnTo, power } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <CatalogDetailPage
      {...data}
      power={power ?? 1}
      onPowerChange={(value) => {
        void navigate({
          search: (previous) => ({
            ...previous,
            returnTo: returnPathAtPower(previous.returnTo ?? "/collection", 1),
            power: powerParam(value),
          }),
          replace: true,
          resetScroll: false,
        });
      }}
      returnTo={catalogReturnPath(
        returnTo ?? (data.item.category === "mob" ? "/mobs" : undefined),
      )}
    />
  );
}
