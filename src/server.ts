import { productionHttpsRedirect } from "./lib/https";
import { missingAssetResponse } from "./lib/stale-assets";
import serverEntry, {
  createServerEntry,
} from "@tanstack/react-start/server-entry";
import { env } from "cloudflare:workers";
import { sharingApi } from "./features/sharing/sharing.server";
import { collectAnalytics } from "./features/analytics/analytics.server";
import { loadCatalog } from "./features/catalog/catalog.loader";
import { catalogSitemap } from "./features/seo/sitemap";
import { communityApi } from "./features/community/community.server";

export default createServerEntry({
  fetch(request, options) {
    const redirect = productionHttpsRedirect(request);
    if (redirect) return redirect;
    const missingAsset = missingAssetResponse(request);
    if (missingAsset) return missingAsset;
    const path = new URL(request.url).pathname;
    if (
      path === "/api/community-builds" ||
      path.startsWith("/api/community-builds/")
    )
      return communityApi(request, env);
    if (path === "/sitemap.xml")
      return loadCatalog().then(
        (items) =>
          new Response(catalogSitemap(items), {
            headers: {
              "Content-Type": "application/xml; charset=utf-8",
              "Cache-Control": "public, max-age=300, s-maxage=3600",
            },
          }),
      );
    if (path === "/api/identity" || path.startsWith("/api/build-links"))
      return sharingApi(request, env);
    if (path === "/api/analytics") {
      return collectAnalytics(request, env.PRODUCT_ANALYTICS);
    }
    return serverEntry.fetch(request, options);
  },
});
