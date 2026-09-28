import { ProgressBar, Chip } from "@heroui/react";
import { Check } from "lucide-react";
import type { Progress } from "../collection.types";
export function CollectionProgress({ progress }: { progress: Progress }) {
  const complete = progress.total > 0 && progress.owned === progress.total;
  return (
    <section
      className={`collection-heading ${complete ? "complete" : ""}`}
      aria-label="Overall completion"
    >
      <div>
        <p className="eyebrow">MINECRAFT DUNGEONS 2</p>
        <h1>
          Collection<span className="accent">.</span>
        </h1>
      </div>
      <div className="overall-progress">
        <div className="progress-top">
          <span className="eyebrow">
            {complete ? "COLLECTION COMPLETE" : "YOUR PROGRESS"}
          </span>
          {complete && (
            <Chip size="sm">
              <Check size={12} /> All found
            </Chip>
          )}
        </div>
        <div className="progress-numbers">
          <span>
            <strong>{progress.owned}</strong>
            <span className="muted"> / {progress.total}</span>
          </span>
          <span className="percentage">
            {progress.percent}
            <small>%</small>
          </span>
        </div>
        <ProgressBar
          aria-label="Overall collection"
          value={progress.owned}
          maxValue={progress.total || 1}
        >
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>
      </div>
    </section>
  );
}
