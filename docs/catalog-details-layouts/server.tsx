import { renderToString } from "react-dom/server";
import { App, pageOptions, linkedPages } from "./page";
import snapshot from "./example-data.json";

export const routes: {
  id: string;
  name: string;
  path: string;
  catalogSlug?: string;
}[] = [...pageOptions, ...linkedPages];
export { pageOptions };
import { itemsBySlug } from "./item-links";
import { itemSeo } from "./item-seo";
export function renderPage(
  html: string,
  layout: string,
  catalogSlug = snapshot.weapon.slug,
) {
  const item = itemsBySlug.get(catalogSlug)!;
  const { canonical, title, description, aliases, introduction } =
    itemSeo(item);
  const escapeAttribute = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;");
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${canonical}#page`,
        url: canonical,
        name: title,
        description,
        inLanguage: "en",
        mainEntity: { "@id": `${canonical}#item` },
      },
      {
        "@type": "Thing",
        "@id": `${canonical}#item`,
        name: item.name,
        ...(aliases.length ? { alternateName: aliases } : {}),
        description: introduction,
        image: item.image,
        url: canonical,
      },
    ],
  };
  const metadata = `
    <title>${escapeAttribute(title)}</title>
    <meta name="description" content="${escapeAttribute(description)}" />
    <meta name="robots" content="index,follow,max-image-preview:large" />
    <link rel="canonical" href="${canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeAttribute(title)}" />
    <meta property="og:description" content="${escapeAttribute(description)}" />
    <meta property="og:url" content="${canonical}" />
    ${item.image ? `<meta property="og:image" content="${item.image}" />` : ""}
    <meta property="og:image:alt" content="${escapeAttribute(item.name)}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeAttribute(title)}" />
    <meta name="twitter:description" content="${escapeAttribute(description)}" />
    ${item.image ? `<meta name="twitter:image" content="${item.image}" />` : ""}
    <script type="application/ld+json">${JSON.stringify(graph).replace(/</g, "\\u003c")}</script>`;
  return html
    .replace(/<title>.*?<\/title>/s, metadata)
    .replace(
      '<div id="root"></div>',
      `<div id="root" data-layout="${layout}" data-catalog-slug="${catalogSlug}">${renderToString(<App selected={layout} catalogSlug={catalogSlug} />)}</div>`,
    );
}
