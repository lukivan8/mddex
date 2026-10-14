import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";
import { dailyAnalyticsSql } from "../../../scripts/analytics.sql";
it("SQL keeps one browser per Almaty day, resolves mixed/replayed rows, and preserves historical totals", () => {
  const db = new DatabaseSync(":memory:");
  db.function("intDiv", (a, b) => Math.floor(Number(a) / Number(b)));
  db.function("toUInt32", (a) => Number(a));
  db.function("toDateTime", (a) =>
    typeof a === "string" ? Date.parse(a + "Z") / 1000 : Number(a),
  );
  db.function("if", (condition, yes, no) => (condition ? yes : no));
  db.exec(
    "CREATE TABLE mddex_events (timestamp REAL, blob2 TEXT, blob6 TEXT, blob9 TEXT, double2 REAL, _sample_interval INTEGER)",
  );
  const insert = db.prepare(
    "INSERT INTO mddex_events VALUES (?, ?, ?, ?, ?, ?)",
  );
  const t = Date.parse("2026-10-14T18:59:59Z");
  for (const [visitor, version, cohort] of [
    ["a", "v4", "new"],
    ["a", "v4", "new"],
    ["a", "v3", ""],
    ["b", "v4", "returning"],
    ["b", "v4", "new"],
    ["c", "v3", ""],
    ["d", "v4", "unknown"],
    ["", "v4", "new"],
  ])
    insert.run(t / 1000, visitor, version, cohort, t, 1);
  insert.run(t / 1000, "a", "v4", "returning", t + 1000, 2); // upload time is still previous day
  insert.run(t / 1000 - 86400, "historical", "v2", "", 0, 1);
  const rows = db
    .prepare(
      dailyAnalyticsSql("2026-10-12 19:00:00", "2026-10-15 19:00:00").replace(
        " FORMAT JSON",
        "",
      ),
    )
    .all();
  expect(
    rows.map((r) => [
      r.dau,
      r.new_browsers,
      r.returning_browsers,
      r.unknown,
      r.sample,
    ]),
  ).toEqual([
    [1, 0, 0, 1, 1],
    [4, 1, 1, 2, 1],
    [1, 0, 1, 0, 2],
  ]);
  for (const r of rows)
    expect(
      Number(r.new_browsers) + Number(r.returning_browsers) + Number(r.unknown),
    ).toBe(r.dau);
  db.close();
});
