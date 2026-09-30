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
    const { item, catalog } = loaderData;
    const seo = itemSeo(item, catalog);
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
