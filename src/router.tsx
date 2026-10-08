import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import {
  installStaleAssetRecovery,
  isStaleAssetError,
  reloadForStaleAssets,
} from "./lib/stale-assets";
export function getRouter() {
  if (typeof window !== "undefined") installStaleAssetRecovery();
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 60_000,
    defaultOnCatch: (error) => {
      if (typeof window !== "undefined" && isStaleAssetError(error))
        reloadForStaleAssets();
    },
  });
}
declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
