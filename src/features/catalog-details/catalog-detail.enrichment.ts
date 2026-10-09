import type {
  CatalogItem,
  ItemSource,
  Reference,
} from "./catalog-detail.model";
import { referenceArtwork } from "../catalog/catalog.reference-artwork";

type RecordData = Record<string, unknown>;
function record(value: unknown): RecordData {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordData)
    : {};
}
function rows(value: unknown): RecordData[] {
  return Array.isArray(value) ? value.map(record) : [];
}
function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
export function references(value: unknown): Reference[] {
  return rows(value).flatMap((entry) => {
    const name = text(entry.name) ?? text(entry.title);
    return name
      ? [
          {
            name,
            catalog_slug: text(entry.catalog_slug),
            description:
              text(entry.subtitle) ??
              text(entry.description) ??
              text(entry.text),
          },
        ]
      : [];
  });
}
export function mergeReferences(...groups: Reference[][]): Reference[] {
  const result = new Map<string, Reference>();
  for (const entry of groups.flat()) {
    const key = entry.catalog_slug ?? entry.name;
    const old = result.get(key);
    const description = [
      ...new Set([old?.description, entry.description].filter(Boolean)),
    ].join(" ");
    result.set(key, {
      ...old,
      ...entry,
      ...(description ? { description } : {}),
    });
  }
  return [...result.values()];
}
export function applicableEffects(item: CatalogItem): Reference[] {
  const data = item.game_data as RecordData;
  return references(record(data.rollable_effects).effects);
}
export function questRewardNames(item: CatalogItem): string[] {
  const data = item.game_data as RecordData;
  const sources = [
    ...rows(data.sources),
    ...rows(record(data.acquisition).sources),
  ];
  const names = sources.flatMap((source) =>
    source.type === "quest" &&
    text(source.name) &&
    source.name !== "Quest reward"
      ? [text(source.name)!]
      : [],
  );
  for (const quest of rows(data.quest_context)) {
    const rewards = record(quest.rewards);
    const matches = [
      rewards.all,
      rewards.first_completion,
      rewards.repeat_completion,
    ].some((group) =>
      rows(group).some((reward) => reward.catalog_slug === item.slug),
    );
    if (matches && text(quest.name)) names.push(text(quest.name)!);
  }
  return [...new Set(names)];
}
export function acquisitionSources(item: CatalogItem): ItemSource[] {
  const data = item.game_data as RecordData;
  const acquisition = record(data.acquisition);
  const sourceText = text(acquisition.source_text)?.replace(/\s+/g, " ").trim();
  return rows(acquisition.sources).flatMap((entry) => {
    const name = text(entry.name),
      type = text(entry.type);
    if (
      !name ||
      !type ||
      !["area", "mob", "dungeon", "rift", "merchant"].includes(type)
    )
      return [];
    const condition = text(entry.condition);
    const image = referenceArtwork(item, entry);
    const notes = [
      (condition?.replace(/\s+/g, " ").trim() === sourceText
        ? undefined
        : condition
      )?.replace(
        /^When (.+) drops with (?:the )?Unique rarity\.?$/i,
        "Unique rarity variant of $1",
      ),
      text(entry.trigger),
      text(entry.selection_context),
      typeof entry.probability === "string" ||
      typeof entry.probability === "number"
        ? `Drop chance: ${entry.probability}`
        : undefined,
    ].filter((note): note is string => Boolean(note));
    return [
      {
        name,
        type,
        catalog_slug: text(entry.catalog_slug),
        ...(image ? { image } : {}),
        ...(type === "dungeon" || type === "rift"
          ? { source_url: text(entry.href) ?? text(entry.source_url) }
          : {}),
        description: [...new Set(notes)].join(" ") || undefined,
      },
    ];
  });
}
export function locationMetadata(item: CatalogItem, catalog: CatalogItem[]) {
  const data = item.game_data as RecordData;
  const native = record(data.wikily);
  const context = record(data.location_context);
  const details = rows(context.source_details);
  const instances = rows(context.instances).flatMap((instance) => {
    const name = text(instance.name);
    if (!name) return [];
    const levels = references(instance.levels).map((level) =>
      [level.name, level.description].filter(Boolean).join(": "),
    );
    const notes = [text(instance.lead), ...levels].filter(
      (note): note is string => Boolean(note),
    );
    const image = referenceArtwork(item, instance);
    return [
      {
        name,
        description: notes.join(" ") || undefined,
        ...(image ? { image } : {}),
      },
    ];
  });
  const cards = details.flatMap((detail) => rows(detail.cards));
  const linkedCards: Reference[] = cards.flatMap((card) => {
    const link = rows(card.links).find((entry) => text(entry.catalog_slug));
    if (!link) return [];
    return [
      {
        name: text(card.name) ?? text(link.name) ?? "",
        catalog_slug: text(link.catalog_slug),
        description: text(card.text),
      },
    ];
  });
  const bySlug = new Map(catalog.map((entry) => [entry.slug, entry]));
  const linkedMobs = linkedCards.filter(
    (entry) => bySlug.get(entry.catalog_slug ?? "")?.category === "mob",
  );
  const entrances = linkedCards.filter(
    (entry) =>
      bySlug.get(entry.catalog_slug ?? "")?.category === "location" &&
      entry.catalog_slug !== item.slug,
  );
  return {
    overview: text(native.lead),
    region: text(native.region),
    dungeonCount:
      typeof native.nDungeon === "number" ? native.nDungeon : undefined,
    riftCount: typeof native.nRift === "number" ? native.nRift : undefined,
    stationCount:
      typeof native.nStations === "number" ? native.nStations : undefined,
    loot: mergeReferences(
      item.game_data.loot ?? [],
      references(native.gear),
      references(native.books),
    ),
    mobs: mergeReferences(
      item.game_data.mobs ?? [],
      references(native.mobs),
      linkedMobs,
    ),
    minibosses: mergeReferences(
      item.game_data.minibosses ?? [],
      references(native.bosses),
    ),
    entrances: mergeReferences(
      references(native.entries),
      entrances,
      instances,
    ),
    places: mergeReferences(references(native.places)),
    merchants: references(native.merchants),
    stations: references(native.stations),
  };
}
