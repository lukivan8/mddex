import type { SummaryEntry } from "./build.summary";

const numberPattern = /-?\d+(?:\.\d+)?/g;

function descriptionParts(description: string) {
  const numbers = [...description.matchAll(numberPattern)];
  const additive = numbers.map(
    (match) =>
      !/\b(?:after|every|within)\s*$/i.test(description.slice(0, match.index)),
  );
  let index = 0;
  const template = description.replace(numberPattern, (number) =>
    additive[index++] ? "{value}" : number,
  );
  return { template, numbers, additive };
}

/** Equipment effect values stack additively; timing conditions remain conditions. */
export function additiveEffectDescriptions(
  contributions: SummaryEntry["contributions"],
): { description?: string; source: string }[] {
  const groups = new Map<
    string,
    {
      description: string;
      sources: string[];
      totals: number[];
      additive: boolean[];
    }
  >();
  for (const contribution of contributions) {
    if (!contribution.description) continue;
    const parts = descriptionParts(contribution.description);
    const existing = groups.get(parts.template);
    if (existing) {
      existing.sources.push(contribution.source);
      parts.numbers.forEach((match, index) => {
        if (parts.additive[index]) existing.totals[index] += Number(match[0]);
      });
    } else {
      groups.set(parts.template, {
        description: contribution.description,
        sources: [contribution.source],
        totals: parts.numbers.map((match) => Number(match[0])),
        additive: parts.additive,
      });
    }
  }
  const descriptions: { description?: string; source: string }[] = [
    ...groups.values(),
  ].map((group) => {
    let index = 0;
    return {
      description: group.description.replace(numberPattern, (number) => {
        const position = index++;
        return group.additive[position]
          ? String(Number(group.totals[position].toFixed(8)))
          : number;
      }),
      source: group.sources.join("\n"),
    };
  });
  const missing = contributions.filter(
    (contribution) => !contribution.description,
  );
  if (missing.length)
    descriptions.push({
      source: missing.map((contribution) => contribution.source).join("\n"),
    });
  return descriptions;
}

export function summaryNumberParts(description: string) {
  return description.split(/(-?\d+(?:\.\d+)?%?)/g);
}
