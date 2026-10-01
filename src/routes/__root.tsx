import { getContentSource } from "../features/catalog/catalog.loader";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  Link,
} from "@tanstack/react-router";
import { Analytics } from "../features/analytics/Analytics";
import {
  pageMetadata,
  BUILD_TITLE,
  BUILD_DESCRIPTION,
  websiteSchema,
} from "../features/seo/metadata";
import css from "../styles.css?url";
export const Route = createRootRoute({
  head: () => {
    const defaults = pageMetadata({
      title: BUILD_TITLE,
      description: BUILD_DESCRIPTION,
      path: "/build",
    });
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "theme-color", content: "#080f11" },
        ...defaults.meta,
      ],
      links: [
        {
          rel: "preconnect",
          href: new URL(getContentSource().latestUrl).origin,
          crossOrigin: "anonymous",
        },
        { rel: "stylesheet", href: css },
        { rel: "icon", href: "/favicon.ico", sizes: "any" },
        {
          rel: "icon",
          href: "/favicon-32x32.png",
          type: "image/png",
          sizes: "32x32",
        },
        {
          rel: "apple-touch-icon",
          href: "/apple-touch-icon.png",
          sizes: "180x180",
        },
        { rel: "manifest", href: "/site.webmanifest" },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(websiteSchema),
        },
      ],
    };
  },
  component: () => (
    <html lang="en" className="dark" data-theme="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Outlet />
        <Analytics />
        <Scripts />
      </body>
    </html>
  ),
  notFoundComponent: () => (
    <main id="main" className="page-message">
      <h1>Page not found.</h1>
      <Link to="/build">Back to builds</Link>
    </main>
  ),
});
