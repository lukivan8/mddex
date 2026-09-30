import {
  dropSources,
  isChestTalisman,
  itemPath,
  type CatalogItem,
} from "./catalog-detail.model";
import {
  fullChargeDamage,
  fullComboDamage,
  potentialVolleyDamage,
} from "./weapon-compare.model";
import { scaleDamage } from "../catalog/power";
import { formatAttackDamage, knownHitCount } from "./melee-attack";
const labels: Record<string, string> = {
  melee_weapon: "melee weapon",
  ranged_weapon: "ranged weapon",
  armor: "armor item",
  artifact: "artifact",
  talisman: "talisman",
  enchantment: "enchantment",
  gear_effect: "gear effect",
  location: "location",
  mob: "mob",
  status: "status effect",
  cape: "cape",
  pet: "pet",
};
const singularTypes: Record<string, string> = {
  pickaxes: "pickaxe",
  swords: "sword",
  axes: "axe",
  bows: "bow",
  crossbows: "crossbow",
};
export interface GuideSection {
  heading: string;
  text: string;
}
function list(values: string[]) {
  return new Intl.ListFormat("en", {
    style: "long",
    type: "conjunction",
  }).format(values);
}
function excerpt(text: string, length = 160) {
  if (text.length <= length) return text;
  return `${text
    .slice(0, length - 1)
    .replace(/\s+\S*$/, "")
    .replace(/[,. ;:]$/, "")}…`;
}
function examples(values: string[]) {
  return (
    list(values.slice(0, 6)) +
    (values.length > 6
      ? `, plus ${values.length - 6} other listed entries`
      : "")
  );
}
export function itemSeo(
  item: CatalogItem,
  catalog: readonly CatalogItem[],
  power = 1,
) {
  const data = item.game_data;
  const category = labels[item.category] ?? "catalog entry";
  const familyName = (data.base?.name ?? item.name).toLowerCase();
  const familyNoun = Object.values(singularTypes).includes(familyName)
    ? familyName
    : undefined;
  const noun = singularTypes[item.type ?? ""] ?? familyNoun ?? category;
  const shortName = item.name.replace(/^the\s+/i, "").replace(/['’]s\b/g, "");
  const aliases = [
    ...new Set([
      shortName,
      ...(noun === "pickaxe" ? [shortName.replace(/\bPick$/i, "Pickaxe")] : []),
    ]),
  ].filter((name) => name !== item.name);
  const identity = `${item.name} is ${data.unique ? "a unique" : /^[aeiou]/i.test(noun) ? "an" : "a"} ${noun} in Minecraft Dungeons 2 (MCD2).`;
  const sections: GuideSection[] = [];
  const effects = data.effects?.filter((effect) => effect.text) ?? [];
  if (effects.length)
    sections.push({
      heading: `What ${effects.some((effect) => effect.tier === "unique") ? "unique " : ""}effects does ${item.name} have?`,
      text: effects.map((effect) => `${effect.name}: ${effect.text}`).join(" "),
    });
  const sources = dropSources(item, catalog);
  if (isChestTalisman(item)) {
    sections.push({
      heading: `Where can ${item.name} drop?`,
      text: "Found in chests",
    });
  } else if (sources.length) {
    const areas = sources
      .filter((source) => source.type === "area")
      .map((source) => source.name);
    const mobs = sources
      .filter((source) => source.type === "mob")
      .map((source) => source.name);
    sections.push({
      heading: `Where can ${item.name} drop?`,
      text: [
        areas.length ? `Listed drop locations include ${list(areas)}.` : "",
        mobs.length ? `Explicit mob drops are listed for ${list(mobs)}.` : "",
      ]
        .filter(Boolean)
        .join(" "),
    });
  }
  if (data.melee) {
    const melee = data.melee;
    const facts = [];
    if (melee.combo.length)
      facts.push(
        `Its ${melee.combo.length}-${melee.combo.some((hit) => knownHitCount(hit) != null) ? "attack" : "hit"} combo deals ${melee.combo.map((hit) => formatAttackDamage(hit, power)).join(" → ")} damage${power === 1 ? "" : ` at Power ${power}`}.`,
      );
    const comboDamage = fullComboDamage(item, power);
    if (comboDamage != null) facts.push(`Full combo damage is ${comboDamage}.`);
    if (melee.jump?.damage != null)
      facts.push(
        `The jump attack deals ${formatAttackDamage(melee.jump, power)} damage.`,
      );
    if (melee.combo_reset != null)
      facts.push(`Its published combo reset value is ${melee.combo_reset}.`);
    if (facts.length)
      sections.push({
        heading: `What are ${item.name}’s attack stats?`,
        text: facts.join(" "),
      });
  }
  if (data.ranged) {
    const ranged = data.ranged;
    const facts = [];
    const damage =
      ranged.projectiles?.flatMap((projectile) =>
        projectile.damage != null
          ? [String(scaleDamage(projectile.damage, power))]
          : [],
      ) ?? [];
    const chargedDamage = fullChargeDamage(item, power);
    if (chargedDamage != null)
      facts.push(
        `Damage${power === 1 ? "" : ` at Power ${power}`}: ${potentialVolleyDamage(item, power)}. Fully charged damage: ${chargedDamage}.`,
      );
    else if (damage.length)
      facts.push(`Published projectile damage: ${list(damage)}.`);
    if (ranged.ammo != null) facts.push(`Ammo capacity: ${ranged.ammo}.`);
    if (facts.length)
      sections.push({
        heading: `What are ${item.name}’s ranged stats?`,
        text: facts.join(" "),
      });
  }
  if (data.artifact) {
    const facts = [];
    if (data.artifact.cooldown != null)
      facts.push(`Published cooldown value: ${data.artifact.cooldown}.`);
    if (data.artifact.soul_cost != null)
      facts.push(`Soul cost: ${data.artifact.soul_cost}.`);
    if (facts.length)
      sections.push({
        heading: `How does ${item.name} work?`,
        text: facts.join(" "),
      });
  }
  if (data.slot || data.set)
    sections.push({
      heading: `What armor is ${item.name}?`,
      text: [
        data.slot ? `Armor slot: ${data.slot}.` : "",
        data.set ? `Armor set: ${data.set}.` : "",
      ]
        .filter(Boolean)
        .join(" "),
    });
  if (data.levels?.length)
    sections.push({
      heading: `What levels does ${item.name} have?`,
      text: data.levels
        .map(
          (level) =>
            `Level ${level.level}${
              level.effects?.some((effect) => effect.text)
                ? `: ${level.effects
                    .filter((effect) => effect.text)
                    .map((effect) => `${effect.name} — ${effect.text}`)
                    .join(" ")}`
                : "."
            }`,
        )
        .join(" "),
    });
  if (data.tiers?.length)
    sections.push({
      heading: `What are ${item.name}’s tier values?`,
      text: data.tiers
        .filter((tier) => tier.text)
        .map(
          (tier) =>
            `${tier.talisman ? "Talisman " : ""}${tier.tier === "unique" ? "Unique" : `Tier ${tier.tier}`}: ${tier.text}`,
        )
        .join(" "),
    });
  const family = data.base ?? data.uniqueVariant;
  if (family)
    sections.push({
      heading: `How is ${item.name} related to other gear?`,
      text: data.base
        ? `${item.name} is a variant of ${family.name}.`
        : `${family.name} is the unique variant of ${item.name}.`,
    });
  if (data.drops.length)
    sections.push({
      heading: `What does ${item.name} drop?`,
      text: `Explicit item drops include ${examples(data.drops.map((drop) => drop.name))}.`,
    });
  if (data.loot?.length)
    sections.push({
      heading: `What loot is listed for ${item.name}?`,
      text: `Listed loot includes ${examples(data.loot.map((drop) => drop.name))}.`,
    });
  if (data.mobs?.length)
    sections.push({
      heading: `Which mobs appear in ${item.name}?`,
      text: `Listed mobs include ${examples(data.mobs.map((mob) => mob.name))}. These encounter records do not establish item drop links.`,
    });
  if (item.category === "mob" && data.health != null)
    sections.push({
      heading: `What is ${item.name}’s health?`,
      text: `Its published health value is ${data.health}.`,
    });
  if (data.summons)
    sections.push({
      heading: `What does ${item.name} summon?`,
      text: `Its listed summon is ${data.summons.name}.`,
    });
  if (data.carriers?.length)
    sections.push({
      heading: `Which items have ${item.name}?`,
      text: `Listed carriers include ${examples(data.carriers.map((entry) => entry.name))}.`,
    });
  if (data.gear?.length || data.slots?.length)
    sections.push({
      heading: `What gear is ${item.name} compatible with?`,
      text: `Listed equipment: ${list(data.gear?.length ? data.gear : (data.slots ?? []))}.`,
    });
  if (data.areas?.length)
    sections.push({
      heading: `Where can ${item.name} be found?`,
      text: `Listed locations include ${examples(data.areas.map((area) => area.name))}.`,
    });
  if (data.attacks?.length)
    sections.push({
      heading: `What attacks does ${item.name} have?`,
      text: data.attacks
        .map(
          (attack) =>
            `${attack.attack}${attack.damage != null ? ` deals ${attack.damage} damage` : ""}.`,
        )
        .join(" "),
    });
  if (data.minibosses?.length)
    sections.push({
      heading: `Which minibosses appear in ${item.name}?`,
      text: `Listed minibosses include ${examples(data.minibosses.map((mob) => mob.name))}.`,
    });
  if (data.arena?.length)
    sections.push({
      heading: `What arena encounters are listed for ${item.name}?`,
      text: `Listed encounters include ${examples(data.arena.map((mob) => mob.name))}.`,
    });
  const introduction = `${identity}${aliases.length ? ` Use this entry for searches such as ${list(aliases)}.` : ""}`;
  return {
    heading: `${aliases[0] ?? item.name} in Minecraft Dungeons 2`,
    introduction,
    sections: sections.filter((section) => section.text),
    title: `${item.name} – Minecraft Dungeons 2 (MCD2) | MDDEX`,
    description: excerpt(
      `${identity} ${sections[0]?.text ?? `Explore its published ${category} details in the MDDEX catalog.`}`,
    ),
    canonical: `https://mddex.net${itemPath(item)}`,
    aliases,
  };
}
