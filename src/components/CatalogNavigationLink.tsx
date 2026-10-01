import { Link } from "@tanstack/react-router";
import type { ComponentPropsWithRef } from "react";

/** Preserve query filters while keeping catalog navigation in the current app. */
export function CatalogNavigationLink({
  href,
  ...props
}: ComponentPropsWithRef<"a">) {
  if (!href) return <a {...props} />;
  const url = new URL(href, "https://mddex.net");
  return (
    <Link
      {...props}
      to={url.pathname}
      search={() => Object.fromEntries(url.searchParams)}
      hash={url.hash.slice(1)}
      preload="intent"
    />
  );
}
