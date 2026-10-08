import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { startAnalytics, trackPage } from "./analytics.browser";

export function Analytics() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  useEffect(() => {
    startAnalytics();
    // Detail pages report their canonical catalog path after the item has loaded.
    if (!path.startsWith("/catalog/")) trackPage(path);
  }, [path]);
  return null;
}
