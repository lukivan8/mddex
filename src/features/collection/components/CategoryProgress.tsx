import { Button, ProgressBar } from "@heroui/react";
import {
  Shield,
  Swords,
  BowArrow,
  Gem,
  Sparkles,
  BookOpen,
  Check,
} from "lucide-react";
import { categoryLabel } from "../../catalog/catalog.helpers";
import type { Progress } from "../collection.types";
const icons: Record<string, typeof Shield> = {
  armor: Shield,
  melee_weapon: Swords,
  ranged_weapon: BowArrow,
  artifact: Gem,
  enchantment: BookOpen,
  talisman: Sparkles,
};
export function CategoryProgress({
  categories,
  selected,
  onSelect,
}: {
  categories: { category: string; progress: Progress }[];
  selected?: string;
  onSelect: (category: string) => void;
}) {
  return (
    <div className="category-grid" aria-label="Progress by category">
      {categories.map(({ category, progress }) => {
        const Icon = icons[category] || Gem;
        const complete =
          progress.total > 0 && progress.owned === progress.total;
        return (
          <Button
            key={category}
            variant="ghost"
            className={`category-card ${selected === category ? "active" : ""}`}
            aria-pressed={selected === category}
            onPress={() => onSelect(selected === category ? "" : category)}
          >
            <span className="category-top">
              <Icon size={18} />
              <span>
                {progress.owned}
                <span className="muted"> / {progress.total}</span>
              </span>
            </span>
            <span className="category-name">
              {categoryLabel(category)}
              {complete && <Check size={14} />}
            </span>
            <ProgressBar
              aria-label={`${categoryLabel(category)} completion`}
              value={progress.owned}
              maxValue={progress.total}
              size="sm"
            >
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
          </Button>
        );
      })}
    </div>
  );
}
