import { trackEvent } from "../features/analytics/analytics.browser";
import { Link } from "@tanstack/react-router";
import { Button } from "@heroui/react";
import { Menu, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { warmIdentity } from "../features/sharing/identity.browser";
export function AppHeader({
  active,
  children,
}: {
  active: "collection" | "build" | "mobs" | "community" | "resources";
  children?: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    void warmIdentity().catch(() => {});
  }, []);
  return (
    <header
      className="app-header"
      onKeyDown={(event) => {
        if (event.key === "Escape" && menuOpen) {
          setMenuOpen(false);
          menuButton.current?.focus();
        }
      }}
    >
      <div className="shell header-inner">
        <Link to="/build" className="brand" aria-label="MDDEX builds">
          <img
            src="/mddex-logo.webp"
            srcSet="/mddex-logo.webp 1x, /mddex-logo@2x.webp 2x"
            width={48}
            height={48}
            alt=""
          />
          <span>MDDEX</span>
        </Link>
        <nav className="desktop-navigation" aria-label="Main navigation">
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
          <Link
            to="/resources"
            className="nav-link"
            aria-current={active === "resources" ? "page" : undefined}
          >
            Resources
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
        <Button
          ref={menuButton}
          isIconOnly
          variant="ghost"
          className="mobile-menu-toggle"
          aria-label={
            menuOpen ? "Close navigation menu" : "Open navigation menu"
          }
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onPress={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? (
            <X size={22} aria-hidden="true" />
          ) : (
            <Menu size={22} aria-hidden="true" />
          )}
        </Button>
      </div>
      <nav
        id={menuId}
        className="mobile-navigation shell"
        aria-label="Mobile navigation"
        hidden={!menuOpen}
      >
        <ul>
          <li>
            <Link
              to="/build"
              className="nav-link"
              aria-current={active === "build" ? "page" : undefined}
              onClick={() => {
                trackEvent("build_navigation");
                setMenuOpen(false);
              }}
            >
              Build
            </Link>
          </li>
          <li>
            <Link
              to="/collection"
              className="nav-link"
              aria-current={active === "collection" ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
            >
              Catalog
            </Link>
          </li>
          <li>
            <Link
              to="/mobs"
              search={{ q: undefined }}
              className="nav-link"
              aria-current={active === "mobs" ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
            >
              Mobs
            </Link>
          </li>
          <li>
            <Link
              to="/resources"
              className="nav-link"
              aria-current={active === "resources" ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
            >
              Resources
            </Link>
          </li>
          <li>
            <Link
              to="/community"
              className="nav-link"
              aria-current={active === "community" ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
            >
              Community builds
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
