import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
export function AppHeader({
  active,
  children,
}: {
  active: "collection" | "build";
  children?: ReactNode;
}) {
  return (
    <header className="app-header">
      <div className="shell header-inner">
        <Link to="/collection" className="brand" aria-label="MDDEX collection">
          <img src="/mddex-logo.png" alt="" />
          <span>MDDEX</span>
        </Link>
        <nav aria-label="Main navigation">
          <Link
            to="/collection"
            className="nav-link"
            aria-current={active === "collection" ? "page" : undefined}
          >
            Collection
          </Link>
          <Link
            to="/build"
            className="nav-link"
            aria-current={active === "build" ? "page" : undefined}
          >
            Build
          </Link>
        </nav>
        {children}
      </div>
    </header>
  );
}
