import { analyticsEventTime } from "./analytics.sql.ts";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const days = Number(process.argv[2] || 7);
if (!Number.isInteger(days) || days < 1 || days > 90) throw new Error("Choose 1–90 days.");
const token = process.env.CLOUDFLARE_ANALYTICS_API_TOKEN || (() => {
  try {
    return (JSON.parse(execFileSync("./node_modules/.bin/wrangler", ["auth", "token", "--json"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    })) as { token: string }).token;
  } catch {
    throw new Error("Sign in with Wrangler or set CLOUDFLARE_ANALYTICS_API_TOKEN.");
  }
})();
const account = process.env.CLOUDFLARE_ACCOUNT_ID || "969c1ae807b3ae3d635b9c72c0818e54";
const range = `${analyticsEventTime} >= NOW() - INTERVAL '${days}' DAY`;
async function query(sql: string) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/analytics_engine/sql`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "text/plain" },
    body: `${sql} FORMAT JSON`,
  });
  if (!response.ok) throw new Error(`Analytics query failed (${response.status}): ${await response.text()}`);
  return ((await response.json()) as { data: Record<string, unknown>[] }).data;
}
const [events, pages, choices, daily] = await Promise.all([
  query(`SELECT blob1 AS event, COUNT(DISTINCT blob2) AS browsers, SUM(_sample_interval) AS actions,
    MAX(_sample_interval) AS sample FROM mddex_events WHERE ${range} GROUP BY event ORDER BY actions DESC`),
  query(`SELECT blob4 AS path, COUNT(DISTINCT blob2) AS browsers, SUM(_sample_interval) AS views
    FROM mddex_events WHERE ${range} AND blob1 = 'page_view' GROUP BY path ORDER BY views DESC LIMIT 30`),
  query(`SELECT blob1 AS event, blob7 AS choice, COUNT(DISTINCT blob2) AS browsers, SUM(_sample_interval) AS actions
    FROM mddex_events WHERE ${range} AND blob7 != '' GROUP BY event, choice ORDER BY actions DESC LIMIT 30`),
  query(`SELECT intDiv(toUInt32(${analyticsEventTime}), 86400) * 86400 AS day, blob1 AS event,
    SUM(_sample_interval) AS actions FROM mddex_events WHERE ${range}
    AND blob1 IN ('page_view','build_equip_attempt','build_equipped','build_shared')
    GROUP BY day, event ORDER BY day, event LIMIT 1000`),
]);
const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const number = (value: unknown) => Number(value || 0).toLocaleString("en-US");
const count = (event: string, key: "browsers" | "actions") => Number(events.find((row) => row.event === event)?.[key] || 0);
const table = (headers: string[], rows: unknown[][]) => `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
const card = (name: string, value: number, note: string) => `<article><span>${esc(name)}</span><strong>${number(value)}</strong><small>${esc(note)}</small></article>`;
const daysList = [...new Set(daily.map((row) => Number(row.day)))].sort((a, b) => a - b);
const dailyRows = daysList.map((day) => [new Date(day * 1000).toISOString().slice(0, 10),
  ...["page_view", "build_equip_attempt", "build_equipped", "build_shared"].map((event) =>
    number(daily.find((row) => Number(row.day) === day && row.event === event)?.actions))]);
const [buildAttempt, returning] = await Promise.all([
  query(`SELECT COUNT(DISTINCT blob2) AS browsers FROM mddex_events WHERE ${range}
    AND blob1 IN ('build_create_attempt','build_slot_selected','build_equip_attempt')`),
  query(`SELECT COUNT(DISTINCT blob2) AS browsers FROM mddex_events WHERE ${range}
    AND blob1 = 'session_started' AND blob5 = 'returning'`),
]);
const report = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MDDEX product metrics</title><style>
  :root{font:15px system-ui;color-scheme:dark;background:#0b1216;color:#e9f4f2}body{max-width:1180px;margin:auto;padding:28px 20px}h1{margin-bottom:4px}p,small{color:#aec4c0}a{color:#7edfd0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:24px 0}.grid article,section{background:#142126;border:1px solid #294044;border-radius:12px;padding:18px}.grid span,.grid small{display:block}.grid strong{display:block;font-size:32px;margin:8px 0}section{margin:16px 0;overflow:auto}table{width:100%;border-collapse:collapse}th,td{padding:10px;text-align:left;border-bottom:1px solid #294044;white-space:nowrap}th{font-size:12px;color:#aec4c0;text-transform:uppercase}tr:last-child td{border:0}nav{display:flex;gap:18px;flex-wrap:wrap;margin:18px 0}details{margin:20px 0}summary{cursor:pointer}</style>
  <h1>MDDEX product metrics</h1><p>Last ${days} days · generated ${esc(new Date().toISOString())} · UTC dates</p>
  <nav><a href="https://dash.cloudflare.com/969c1ae807b3ae3d635b9c72c0818e54/mddex.net/dashboards/19a05b0a-9d62-4c36-a84f-b905cad4f7f7?filters=%5B%5B%7B%22key%22%3A%22siteTag%22%2C%22operator%22%3A%22eq%22%2C%22value%22%3A%2287114214626c41a9a4c082e1272300e9%22%7D%5D%5D&time=%7B%22r%22%3A10080%7D">Cloudflare traffic and Web Vitals ↗</a><a href="https://dash.cloudflare.com/969c1ae807b3ae3d635b9c72c0818e54/mddex.net/analytics/web/overview">Web Analytics detail ↗</a></nav>
  <div class="grid">${card("Site browsers",count("page_view","browsers"),"Observed browser IDs")}${card("Returning browsers",Number(returning[0]?.browsers || 0),"Existing browser, new session")}${card("Build attempted",Number(buildAttempt[0]?.browsers || 0),"Created, selected slot, or tried equip")}${card("Build equipped",count("build_equipped","browsers"),"Saved an equipped item")}${card("Build shared",count("build_shared","browsers"),"Created a share link")}</div>
  <p><small>A browser is not a person. Browser counts can undercount when Analytics Engine samples rows. Event totals below are sampling adjusted. Cloudflare Web Analytics visits use a separate definition.</small></p>
  <section><h2>Build actions</h2>${table(["Action","Events"],[
    ["Build page views",number(pages.find((p) => p.path === "/build")?.views)],
    ...["build_create_attempt","build_slot_selected","build_equip_attempt","build_equipped","build_shared","shared_build_opened","shared_build_saved"].map((event) => [event.replaceAll("_"," "),number(count(event,"actions"))])
  ])}</section>
  <section><h2>Daily activity</h2>${table(["UTC day","Page views","Equip attempts","Equips","Shares"],dailyRows)}</section>
  <section><h2>Popular pages</h2>${table(["Path","Observed browsers","Views"],pages.map((p) => [p.path,p.browsers,p.views]))}</section>
  <section><h2>Discovery choices</h2>${table(["Event","Choice","Observed browsers","Events"],choices.map((c) => [c.event,c.choice,c.browsers,c.actions]))}</section>
  <details><summary>All product events</summary><section>${table(["Event","Observed browsers","Events","Max sample interval"],events.map((e) => [e.event,e.browsers,e.actions,e.sample]))}</section></details></html>`;
const directory = resolve(".analytics-reports");
mkdirSync(directory, { recursive: true });
const output = resolve(directory, `mddex-product-${days}d.html`);
writeFileSync(output, report);
console.log(output);
