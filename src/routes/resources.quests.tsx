import { createFileRoute, useRouter } from "@tanstack/react-router";
import resourcesCss from "../features/resources/resources.css?url";
import questsCss from "../features/resources/quest-graph.css?url";
import { QuestGraphPage } from "../features/resources/QuestGraphPage";
import { loadQuestGraph } from "../features/resources/quest-graph.loader";
import { pageMetadata } from "../features/seo/metadata";

export const Route = createFileRoute("/resources/quests")({
  staleTime: Infinity,
  validateSearch: (search: Record<string, unknown>): { quest?: string } => ({
    quest: typeof search.quest === "string" ? search.quest : undefined,
  }),
  loader: () => loadQuestGraph(),
  head: () => {
    const metadata = pageMetadata({
      title: "Minecraft Dungeons 2 Quest Graph | MDDEX",
      description:
        "Explore quest prerequisites, branching paths, objectives, rewards and unlocks from the Minecraft Dungeons 2 catalog.",
      path: "/resources/quests",
    });
    return {
      ...metadata,
      links: [
        ...metadata.links,
        { rel: "stylesheet", href: resourcesCss },
        { rel: "stylesheet", href: questsCss },
      ],
    };
  },
  component: QuestsPage,
  errorComponent: QuestError,
});
function QuestsPage() {
  const data = Route.useLoaderData();
  const { quest } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <QuestGraphPage
      data={data}
      selectedSlug={quest}
      onSelect={(key) => {
        void navigate({
          search: { quest: key.replace(/^quests:/, "") },
          replace: true,
          resetScroll: false,
        });
      }}
    />
  );
}
function QuestError() {
  const router = useRouter();
  return (
    <main id="main" className="shell resources-main">
      <h1>Quest graph unavailable</h1>
      <p className="muted">Could not load quest data from the catalog.</p>
      <button type="button" onClick={() => void router.invalidate()}>
        Try again
      </button>
      <p>
        <a href="/resources">All resources</a>
      </p>
    </main>
  );
}
