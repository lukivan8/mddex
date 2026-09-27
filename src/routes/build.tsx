import { createFileRoute } from "@tanstack/react-router";
import { BuildPage } from "../features/builds/BuildPage";
export const Route = createFileRoute("/build")({
  head: () => ({ meta: [{ title: "MDDEX · Build" }] }),
  component: BuildPage,
});
