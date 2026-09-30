import { hydrateRoot } from "react-dom/client";
import { App } from "./page";
const root = document.getElementById("root")!;
hydrateRoot(
  root,
  <App selected={root.dataset.layout} catalogSlug={root.dataset.catalogSlug} />,
);
