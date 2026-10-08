import { analyticsEventTime } from "./analytics.sql.ts";
// Run with Node 22.12+; keep the read-only API token in the environment.
const token = process.env.CLOUDFLARE_ANALYTICS_API_TOKEN;
const accountId =
  process.env.CLOUDFLARE_ACCOUNT_ID || "969c1ae807b3ae3d635b9c72c0818e54";
const days = Number(process.argv[2] || 7);
if (!token)
  throw new Error(
    "Set CLOUDFLARE_ANALYTICS_API_TOKEN with Account Analytics Read permission.",
  );
if (!Number.isInteger(days) || days < 1 || days > 90)
  throw new Error("Days must be an integer between 1 and 90.");
const range = `${analyticsEventTime} >= NOW() - INTERVAL '${days}' DAY`;
const metrics: Record<string, string> = {
  "Site visitors (browsers)": "blob1 = 'page_view'",
  "Returning visitors (browsers)":
    "blob1 = 'session_started' AND blob5 = 'returning'",
  "Build page visited": "blob1 = 'page_view' AND blob4 = '/build'",
  "Catalog page visited": "blob1 = 'page_view' AND blob4 = '/collection'",
  "Mobs page visited": "blob1 = 'page_view' AND blob4 = '/mobs'",
  "Item details visited": "blob1 = 'page_view' AND blob4 LIKE '/catalog/%'",
  "Catalog searched": "blob1 = 'catalog_search_used'",
  "Mobs searched": "blob1 = 'mobs_search_used'",
  "Build attempted":
    "blob1 IN ('build_create_attempt', 'build_slot_selected', 'build_equip_attempt')",
  "Build equipped": "blob1 = 'build_equipped'",
  "Build shared": "blob1 = 'build_shared'",
  "Shared build opened": "blob1 = 'shared_build_opened'",
};
async function query(sql: string) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
      },
      body: `${sql} FORMAT JSON`,
    },
  );
  if (!response.ok)
    throw new Error(
      `Analytics query failed (${response.status}): ${await response.text()}`,
    );
  return ((await response.json()) as { data: Record<string, unknown>[] }).data;
}
const summary = [];
for (const [metric, condition] of Object.entries(metrics)) {
  const [row] =
    await query(`SELECT COUNT(DISTINCT blob2) AS visitors, SUM(_sample_interval) AS events,
    MAX(_sample_interval) AS max_sample_interval FROM mddex_events WHERE ${range} AND (${condition})`);
  summary.push({ metric, ...row });
}
console.log(`MDDEX usage · last ${days} days`);
console.table(summary);
console.log(
  "Most viewed pages (known catalog items use their canonical path):",
);
console.table(
  await query(`SELECT blob4 AS path, COUNT(DISTINCT blob2) AS visitors,
  SUM(_sample_interval) AS views, MAX(_sample_interval) AS max_sample_interval
  FROM mddex_events WHERE ${range} AND blob1 = 'page_view'
  GROUP BY path ORDER BY views DESC LIMIT 30`),
);
console.log("Catalog and mob filter choices:");
console.table(
  await query(`SELECT blob1 AS event, blob7 AS label,
  COUNT(DISTINCT blob2) AS visitors, SUM(_sample_interval) AS events,
  MAX(_sample_interval) AS max_sample_interval
  FROM mddex_events WHERE ${range} AND blob7 != ''
  GROUP BY event, label ORDER BY events DESC LIMIT 30`),
);
console.log("All product events:");
console.table(
  await query(`SELECT blob1 AS event, COUNT(DISTINCT blob2) AS visitors,
  SUM(_sample_interval) AS events, MAX(_sample_interval) AS max_sample_interval
  FROM mddex_events WHERE ${range} GROUP BY event ORDER BY events DESC`),
);
console.log(
  "Visitors count distinct browser IDs. If max_sample_interval > 1, visitor counts may undercount; event totals are sampling-adjusted.",
);
export {};
