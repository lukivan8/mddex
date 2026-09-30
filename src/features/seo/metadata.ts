export const SITE_URL = "https://mddex.net";
export const SOCIAL_IMAGE = `${SITE_URL}/og-image.png`;
export const BUILD_TITLE = "Minecraft Dungeons 2 Build Maker | MDDEX";
export const BUILD_DESCRIPTION =
  "Create and share Minecraft Dungeons 2 builds. Choose weapons, armor, artifacts, talismans, enchantments, and gear effects with the free MDDEX build maker.";
export const CATALOG_TITLE = "Minecraft Dungeons 2 Equipment Catalog | MDDEX";
export const CATALOG_DESCRIPTION =
  "Browse Minecraft Dungeons 2 weapons, armor, artifacts, talismans, enchantments, and gear effects. Find equipment and choose items for your builds.";

export function pageMetadata({
  title,
  description,
  path,
  noindex = false,
  share,
}: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
  share?: string;
}) {
  const canonical = `${SITE_URL}${path}`;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      {
        name: "robots",
        content: noindex
          ? "noindex, follow"
          : "index, follow, max-image-preview:large",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "MDDEX" },
      { property: "og:locale", content: "en_US" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      {
        property: "og:url",
        content: share
          ? `${canonical}?share=${encodeURIComponent(share)}`
          : canonical,
      },
      { property: "og:image", content: SOCIAL_IMAGE },
      { property: "og:image:secure_url", content: SOCIAL_IMAGE },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content:
          "MDDEX — Minecraft Dungeons 2 build maker. Plan your loadout and share your build.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: SOCIAL_IMAGE },
      {
        name: "twitter:image:alt",
        content: "MDDEX Minecraft Dungeons 2 build maker",
      },
    ],
    links: [{ rel: "canonical", href: canonical }],
  };
}
export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  name: "MDDEX",
  alternateName: "Minecraft Dungeons 2 Build Maker",
  url: SITE_URL,
  inLanguage: "en",
};
export const buildApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "@id": `${SITE_URL}/build#application`,
  name: "MDDEX Minecraft Dungeons 2 Build Maker",
  url: `${SITE_URL}/build`,
  description: BUILD_DESCRIPTION,
  applicationCategory: "GameApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires JavaScript and a modern web browser.",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Equipment loadout planning",
    "Enchantment and gear effect selection",
    "Build effect summaries",
    "Permanent shared build links",
    "Local build saving",
  ],
};
