import type { QuestReference } from "./quest-graph";

/** Pool markers precede their candidate items in the catalog's ordered rewards. */
export function groupQuestRewards(rows: QuestReference[]) {
  const groups: { dropCount?: number; items: QuestReference[] }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const match = (rows[i].title || rows[i].name || "").match(
      /^(\d+) drops? from a list of (\d+)$/i,
    );
    if (match) {
      const dropCount = Number(match[1]);
      const size = Number(match[2]);
      const items = rows.slice(i + 1, i + 1 + size);
      if (
        dropCount > 0 &&
        dropCount <= size &&
        items.length === size &&
        items.every(
          (row) => !/drops? from a list of/i.test(row.title || row.name || ""),
        )
      ) {
        groups.push({ dropCount, items });
        i += size;
        continue;
      }
    }
    const last = groups.at(-1);
    if (last && last.dropCount == null) last.items.push(rows[i]);
    else groups.push({ items: [rows[i]] });
  }
  return groups;
}
