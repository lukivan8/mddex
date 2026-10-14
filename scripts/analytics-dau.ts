import { dailyAnalyticsSql } from "./analytics.sql.ts";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// One query, compact stdout, reusable chart. No model needed to calculate metrics.
const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(project, ".analytics-reports");
const release = "2026-09-28";
const offset = 5 * 60 * 60; // Asia/Almaty (UTC+5)
const now = new Date();
const todayStart =
  Math.floor((now.getTime() / 1000 + offset) / 86400) * 86400 - offset;
const dateOf = (seconds: number) =>
  new Date((seconds + offset) * 1000).toISOString().slice(0, 10);
const sqlTime = (seconds: number) =>
  new Date(seconds * 1000).toISOString().slice(0, 19).replace("T", " ");
const start = Math.max(
  Date.parse(`${release}T00:00:00+05:00`) / 1000,
  todayStart - 89 * 86400,
);
const account =
  process.env.CLOUDFLARE_ACCOUNT_ID || "969c1ae807b3ae3d635b9c72c0818e54";
const token =
  process.env.CLOUDFLARE_ANALYTICS_API_TOKEN ||
  (() => {
    try {
      return (
        JSON.parse(
          execFileSync(
            resolve(project, "node_modules/.bin/wrangler"),
            ["auth", "token", "--json"],
            {
              cwd: project,
              encoding: "utf8",
              stdio: ["ignore", "pipe", "ignore"],
              timeout: 30_000,
            },
          ),
        ) as { token: string }
      ).token;
    } catch {
      throw new Error(
        "Sign in with Wrangler or set CLOUDFLARE_ANALYTICS_API_TOKEN (Account Analytics Read).",
      );
    }
  })();
if (!token) throw new Error("Cloudflare credentials unavailable.");
const response = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${account}/analytics_engine/sql`,
  {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "text/plain" },
    signal: AbortSignal.timeout(30_000),
    body: dailyAnalyticsSql(sqlTime(start), sqlTime(todayStart + 86400)),
  },
);
if (!response.ok)
  throw new Error(`Analytics query failed (${response.status}).`);
const result = (await response.json()) as {
  data: {
    day: string;
    dau: string;
    sample: number;
    new_browsers: string;
    returning_browsers: string;
    unknown: string;
  }[];
};
if (!Array.isArray(result.data))
  throw new Error("Analytics response has no data array.");
type Day = {
  date: string;
  dau: number;
  sample: number;
  new?: number;
  returning?: number;
  unknown?: number;
};
const historyPath = resolve(output, "mddex-dau-history.json");
const history = new Map<string, Day>(
  existsSync(historyPath)
    ? (JSON.parse(readFileSync(historyPath, "utf8")) as Day[]).map((row) => [
        row.date,
        row,
      ])
    : [],
);
for (const row of result.data) {
  const dau = Number(row.dau),
    day = Number(row.day),
    sample = Number(row.sample);
  if (
    !Number.isFinite(day) ||
    !Number.isInteger(dau) ||
    dau < 0 ||
    !Number.isInteger(sample) ||
    sample < 1
  )
    throw new Error("Invalid daily analytics row.");
  const fresh = Number(row.new_browsers),
    returning = Number(row.returning_browsers),
    unknown = Number(row.unknown);
  if (
    ![fresh, returning, unknown].every((v) => Number.isInteger(v) && v >= 0) ||
    fresh + returning + unknown !== dau
  )
    throw new Error("Invalid daily cohort totals.");
  history.set(dateOf(day), {
    date: dateOf(day),
    dau,
    sample,
    new: fresh,
    returning,
    unknown,
  });
}
const days = [...history.values()]
  .filter((row) => row.date >= release && row.date <= dateOf(todayStart))
  .sort((a, b) => a.date.localeCompare(b.date))
  .map((row) => ({
    ...row,
    new: row.new ?? 0,
    returning: row.returning ?? 0,
    unknown: row.unknown ?? row.dau,
  }));
const yesterday = history.get(dateOf(todayStart - 86400));
const previous = history.get(dateOf(todayStart - 2 * 86400));
const delta = yesterday && previous ? yesterday.dau - previous.dau : null;
const summary = `${dateOf(todayStart - 86400)}: ${yesterday?.dau ?? "unavailable"} observed active browsers${delta === null ? "" : ` (${delta >= 0 ? "+" : ""}${delta} vs prior day)`}.`;
const chart = resolve(output, `mddex-dau-${dateOf(todayStart)}.html`);
const report = {
  cohortStart: days.find((d) => d.new + d.returning > 0)?.date ?? null,
  release,
  today: dateOf(todayStart),
  days,
  updated: new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Almaty",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(now),
};
const template = readFileSync(
  resolve(project, "scripts/analytics-dau.html"),
  "utf8",
);
mkdirSync(output, { recursive: true });
writeFileSync(historyPath, JSON.stringify(days));
writeFileSync(
  chart,
  template.replace(
    "__DAU_DATA__",
    JSON.stringify(report).replaceAll("<", "\\u003c"),
  ),
);
console.log(summary);
if (yesterday)
  console.log(
    `New: ${yesterday.new ?? 0}; returning: ${yesterday.returning ?? 0}; unknown: ${yesterday.unknown ?? yesterday.dau}.`,
  );
console.log(
  "Browser IDs, any tracked activity; sampled counts may undercount. Release day and today are partial; missing days are gaps.",
);
console.log(`visualize${JSON.stringify({ path: chart })}`);
