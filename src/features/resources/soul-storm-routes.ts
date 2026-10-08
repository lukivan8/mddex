export const soulStormRoutes = [
  {
    id: "howling-woods",
    region: "Howling Woods",
    start: "Deep Dark entrance",
    summary:
      "Return to the same fast travel point between the first and second generators.",
    steps: [
      "Travel to the Deep Dark entrance fast travel point, then go left toward the witch area for the first generator.",
      "Return to that fast travel point. Climb the mountain and jump down to the second generator.",
      "Follow the path straight down to the right for the third generator.",
    ],
  },
  {
    id: "singers-meadow",
    region: "Singer's Meadow",
    start: "Choral Glen",
    summary:
      "One generator in the south, then two near Sifter Canyon in the north.",
    steps: [
      "Travel to Choral Glen at the bottom of the map and clear the nearby generator.",
      "Teleport to Sifter Canyon at the top of the map. Go up first and clear that generator.",
      "Walk back down past the Sifter Canyon fast travel point to the last generator.",
    ],
  },
  {
    id: "rainy-plains",
    region: "Rainy Plains",
    start: "Puddle Pond / Monsoon Banks / Orange Tower",
    summary:
      "Teleport between three fast travel points with generators nearby.",
    steps: [
      "Travel to Puddle Pond and clear the nearby generator.",
      "Teleport to Monsoon Banks and clear its nearby generator.",
      "Teleport to Orange Tower and clear the third nearby generator.",
    ],
  },
  {
    id: "humbler-huskland",
    region: "Humbler Huskland",
    start: "Echo Den",
    summary:
      "A simple loop around one fast travel point — LordForce’s easiest route.",
    steps: [
      "Travel to Echo Den.",
      "Clear the three generators in a circle around the fast travel point, following the marked loop.",
    ],
  },
  {
    id: "lullaby-hills",
    region: "Lullaby Hills",
    start: "Illager Stronghold",
    summary:
      "Two generators from the stronghold, then one from Lullaby Hilltop.",
    steps: [
      "Start at Illager Stronghold and walk up and right to the first generator.",
      "Continue up and right after clearing it to reach the second generator.",
      "Travel to Lullaby Hilltop. Go left and down for the third generator.",
    ],
    alternative:
      "You can instead go right from Lullaby Hilltop toward the boss arena. This can be faster when mobs slow you down, but there are no mobs along that route to collect souls from.",
  },
  {
    id: "frozen-highlands",
    region: "Frozen Highlands",
    start: "Frozen Backgate / Frozen Shipyard",
    summary:
      "Two generators beside fast travel points, with a choice for the third.",
    steps: [
      "Travel to Frozen Backgate and clear the generator next to it.",
      "Travel to Frozen Shipyard and clear its nearby generator.",
      "Use Highland Cliffs for the nearby third generator, marked 3 on the map, or follow the alternative route marked 4.",
    ],
    warning:
      "Highland Cliffs (3): one shield pylon cannot be reached with melee, so bring a bow. LordForce also reports that this generator sometimes fails to drop its chest.",
    alternative:
      "Follow route 4 on the map if Highland Cliffs gives you trouble. LordForce recommends it as the next-fastest option.",
  },
  {
    id: "honeycomb-fields",
    region: "Honeycomb Fields",
    start: "Honeybrook Bridge",
    summary: "A straight run between all three generators.",
    steps: [
      "Start at Honeybrook Bridge.",
      "Walk to the three generators in a line, following the red arrows on the map.",
    ],
  },
] as const;
export type StormRouteId = (typeof soulStormRoutes)[number]["id"];
export function stormRouteIdForRegion(
  region: string,
): StormRouteId | undefined {
  return soulStormRoutes.find((route) => route.region === region)?.id;
}
