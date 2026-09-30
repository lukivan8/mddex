// Explicit matches to published Wikily pages; unknown locations stay unlinked.
const locations: Record<string, string> = {
  Ravines: "dungeons",
  "Deep Dark": "dungeons",
  "Brave Haven": "areas/brave-haven",
  "Frozen Highlands": "areas/frozen-highlands",
  "Howling Woods": "areas/howling-woods",
  "Honeycomb Fields": "areas/honeycomb-fields",
  "Singer's Meadow": "areas/singers-meadow",
  "Rainy Plains": "areas/rainy-plains",
  "Squid Coast": "areas/squid-coast",
  "Humbler Huskland": "areas/humbler-huskland",
  "Lullaby Hills": "areas/lullaby-hills",
};

export function wikilyLocationUrl(name: string): string | undefined {
  const path = locations[name.replaceAll("’", "'")];
  return path
    ? `https://wikily.gg/minecraft-dungeons-2/${path}`
    : undefined;
}
