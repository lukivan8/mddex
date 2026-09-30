import { defineConfig, createServer, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = fileURLToPath(new URL(".", import.meta.url));
const outDir = "/tmp/mddex-catalog-details-preview";
type Renderer = typeof import("./server");
function itemPages(): Plugin {
  let isBuild = false;
  return {
    configResolved(config) {
      isBuild = config.command === "build";
    },
    name: "standalone-item-pages",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        if (url.pathname === "/") {
          const renderer = (await server.ssrLoadModule(
            "/server.tsx",
          )) as Renderer;
          const option =
            renderer.pageOptions.find(
              (entry) => entry.id === url.searchParams.get("option"),
            ) ?? renderer.pageOptions[0];
          res.writeHead(302, { Location: option.path });
          res.end();
          return;
        }
        if (url.pathname.startsWith("/catalog/")) {
          const renderer = (await server.ssrLoadModule(
            "/server.tsx",
          )) as Renderer;
          if (!renderer.routes.some((entry) => entry.path === url.pathname)) {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("Item page not found");
            return;
          }
        }
        next();
      });
    },
    transformIndexHtml: {
      order: "pre",
      async handler(html, context) {
        if (!context.server) return html;
        const renderer = (await context.server.ssrLoadModule(
          "/server.tsx",
        )) as Renderer;
        const option = renderer.routes.find(
          (entry) =>
            entry.path ===
            new URL(context.originalUrl ?? context.path, "http://localhost")
              .pathname,
        );
        return option
          ? renderer.renderPage(html, option.id, option.catalogSlug)
          : html;
      },
    },
    async closeBundle() {
      if (!isBuild) return;
      const rendererServer = await createServer({
        configFile: false,
        root,
        plugins: [react(), tailwindcss()],
        server: { middlewareMode: true },
      });
      try {
        const renderer = (await rendererServer.ssrLoadModule(
          "/server.tsx",
        )) as Renderer;
        const html = await readFile(join(outDir, "index.html"), "utf8");
        for (const option of renderer.routes) {
          const directory = join(outDir, option.path);
          await mkdir(directory, { recursive: true });
          await writeFile(
            join(directory, "index.html"),
            renderer.renderPage(html, option.id, option.catalogSlug),
          );
        }
        await writeFile(
          join(outDir, "index.html"),
          renderer.renderPage(html, "dossier"),
        );
      } finally {
        await rendererServer.close();
      }
    },
  };
}
export default defineConfig({
  root,
  publicDir: fileURLToPath(new URL("../../public", import.meta.url)),
  plugins: [react(), tailwindcss(), itemPages()],
  server: { host: "127.0.0.1" },
  build: { outDir },
});
