export const STORM_EPOCH = Date.UTC(2026, 0, 1);
export const STORM_INTERVAL = 40 * 60 * 1000;
export const STORM_DURATION = 20 * 60 * 1000;
export const STORM_REGIONS = [
  "Howling Woods",
  "Singer's Meadow",
  "Rainy Plains",
  "Humbler Huskland",
  "Lullaby Hills",
  "Frozen Highlands",
  "Honeycomb Fields",
] as const;

export function stormAt(index: number) {
  const regionIndex =
    ((index % STORM_REGIONS.length) + STORM_REGIONS.length) %
    STORM_REGIONS.length;
  const start = STORM_EPOCH + index * STORM_INTERVAL;
  return {
    index,
    region: STORM_REGIONS[regionIndex],
    start,
    end: start + STORM_DURATION,
  };
}

export function soulStormSchedule(now: number) {
  const current = stormAt(Math.floor((now - STORM_EPOCH) / STORM_INTERVAL));
  const active = now < current.end;
  const upcoming = Array.from({ length: 7 }, (_, offset) =>
    stormAt(current.index + offset + 1),
  );
  return {
    current,
    active,
    upcoming,
    remaining: (active ? current.end : upcoming[0].start) - now,
  };
}

export function countdown(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}
