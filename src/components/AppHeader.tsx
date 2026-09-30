import { trackEvent } from "../features/analytics/analytics.browser";
import { Link } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { warmIdentity } from "../features/sharing/identity.browser";
export function AppHeader({
  active,
  children,
}: {
  active: "collection" | "build" | "mobs" | "community";
  children?: ReactNode;
}) {
  useEffect(() => {
    void warmIdentity().catch(() => {});
  }, []);
  return (
    <header className="app-header">
      <div className="shell header-inner">
        <Link to="/build" className="brand" aria-label="MDDEX builds">
          <img src="/mddex-logo.png" alt="" />
          <span>MDDEX</span>
        </Link>
        <nav aria-label="Main navigation">
          <Link
            to="/build"
            onClick={() => trackEvent("build_navigation")}
            className="nav-link"
            aria-current={active === "build" ? "page" : undefined}
          >
            Build
          </Link>
          <Link
            to="/collection"
            className="nav-link"
            aria-current={active === "collection" ? "page" : undefined}
          >
            Catalog
          </Link>
          <Link
            to="/mobs"
            search={{ q: undefined }}
            className="nav-link"
            aria-current={active === "mobs" ? "page" : undefined}
          >
            Mobs
          </Link>
        </nav>
        {children}
        <Link
          to="/community"
          className="nav-link community-nav-link"
          aria-current={active === "community" ? "page" : undefined}
        >
          Community builds
        </Link>
      </div>
    </header>
  );
}
