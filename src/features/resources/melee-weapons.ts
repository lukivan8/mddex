import data from "./melee-weapons.json";
export const meleeWeapons = data;
export type MeleeWeapon = (typeof data)[number];
export function compareMeleeWeapons(first: MeleeWeapon, second: MeleeWeapon) {
  return {
    dps: second.dps - first.dps,
    damage: second.damage - first.damage,
    duration: second.comboDuration - first.comboDuration,
    jumpDps: second.jumpDps - first.jumpDps,
  };
}
export function filterMeleeWeapons(
  query: string,
  edition: string,
  sort: string,
) {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return meleeWeapons
    .filter(
      (weapon) =>
        (!edition || weapon.edition === edition) &&
        tokens.every((token) =>
          `${weapon.name} ${weapon.family}`.toLowerCase().includes(token),
        ),
    )
    .sort((a, b) => {
      if (sort === "jumpDps") return b.jumpDps - a.jumpDps;
      if (sort === "time") return a.comboDuration - b.comboDuration;
      if (sort === "damage") return b.damage - a.damage;
      if (sort === "name") return a.name.localeCompare(b.name);
      return b.dps - a.dps;
    });
}
