import { Button } from "@heroui/react";
import {
  Shield,
  Swords,
  BowArrow,
  Gem,
  Sparkles,
  BookOpen,
} from "lucide-react";
import { categoryLabel } from "../../catalog/catalog.helpers";
const icons: Record<string, typeof Shield> = {
  armor: Shield,
  melee_weapon: Swords,
  ranged_weapon: BowArrow,
  artifact: Gem,
  enchantment: BookOpen,
  talisman: Sparkles,
};
export function CategoryFilters({
  categories,
  selected,
  onSelect,
}: {
  categories: { category: string; total: number }[];
  selected?: string;
  onSelect: (category: string) => void;
}) {
  return (
    <div className="category-grid" role="group" aria-label="Catalog categories">
      {categories.map(({ category, total }) => {
        const Icon = icons[category] || Gem;
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
              <span>{total} items</span>
            </span>
            <span className="category-name">{categoryLabel(category)}</span>
          </Button>
        );
      })}
    </div>
  );
}
