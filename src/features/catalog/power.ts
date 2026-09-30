export const DEFAULT_POWER = 1;
export const MAX_POWER = 9999;

export function parsePower(value: unknown): number {
  const number =
    typeof value === "string" && /^\d+$/.test(value)
      ? Number(value)
      : typeof value === "number"
        ? value
        : NaN;
  return Number.isSafeInteger(number) && number >= 1 && number <= MAX_POWER
    ? number
    : DEFAULT_POWER;
}

export function powerParam(power: number): number | undefined {
  const parsed = parsePower(power);
  return parsed === DEFAULT_POWER ? undefined : parsed;
}

export function powerFactor(power: number): number {
  return 0.95 + 0.05 * parsePower(power);
}

export function scaleDamage(baseDamage: number, power: number): number {
  return Math.round((baseDamage * (19 + parsePower(power))) / 20);
}

export function returnPathAtPower(path: string, power: number): string {
  const url = new URL(path, "https://mddex.net");
  if (powerParam(power) === undefined) url.searchParams.delete("power");
  else url.searchParams.set("power", String(power));
  return `${url.pathname}${url.search}${url.hash}`;
}

export function powerFromReturnPath(path?: string): number {
  if (!path) return DEFAULT_POWER;
  return parsePower(
    new URL(path, "https://mddex.net").searchParams.get("power"),
  );
}
