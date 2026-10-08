// v3 retains capture time in milliseconds; older events used ingestion time.
export const analyticsEventTime =
  "if(blob6 = 'v3', toDateTime(double2 / 1000), timestamp)";
