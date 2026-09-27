import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  Link,
} from "@tanstack/react-router";
import css from "../styles.css?url";
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "MDDEX · Collection" },
      {
        name: "description",
        content:
          "Your Minecraft Dungeons 2 collection. Every find, accounted for.",
      },
    ],
    links: [
      { rel: "stylesheet", href: css },
      { rel: "icon", href: "/mddex-logo.png" },
    ],
  }),
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
        <Scripts />
      </body>
    </html>
  ),
  notFoundComponent: () => (
    <main id="main" className="page-message">
      <h1>Nothing to collect here.</h1>
      <Link to="/collection">Back to collection</Link>
    </main>
  ),
});
