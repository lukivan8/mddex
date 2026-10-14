// v3 retains capture time in milliseconds; older events used ingestion time.
export const analyticsEventTime =
  "if(blob6 IN ('v3', 'v4'), toDateTime(double2 / 1000), timestamp)";

// Group once per browser/day before counting cohorts: retries and sessions cannot
// inflate DAU. Conflicting metadata resolves returning > new > unknown.
export function dailyAnalyticsSql(start: string, end: string) {
  return `SELECT day, COUNT() AS dau,
    SUM(if(cohort = 1, 1, 0)) AS new_browsers,
    SUM(if(cohort = 2, 1, 0)) AS returning_browsers,
    SUM(if(cohort = 0, 1, 0)) AS unknown, MAX(sample) AS sample
    FROM (SELECT intDiv(toUInt32(${analyticsEventTime}) + 18000, 86400) * 86400 - 18000 AS day,
      blob2, MAX(if(blob6 = 'v4' AND blob9 = 'returning', 2,
        if(blob6 = 'v4' AND blob9 = 'new', 1, 0))) AS cohort,
      MAX(_sample_interval) AS sample
      FROM mddex_events WHERE ${analyticsEventTime} >= toDateTime('${start}')
      AND ${analyticsEventTime} < toDateTime('${end}') AND blob2 != ''
      GROUP BY day, blob2)
    GROUP BY day ORDER BY day FORMAT JSON`;
}
