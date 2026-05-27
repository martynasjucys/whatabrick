import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "daily-market-refresh",
  { hourUTC: 6, minuteUTC: 0 },
  internal.marketSnapshotsActions.refreshAllTracked,
);

crons.daily(
  "daily-verdict-refresh",
  { hourUTC: 6, minuteUTC: 30 },
  internal.signalScoresActions.refreshAllTracked,
);

crons.hourly(
  "dispatch-alert-emails",
  { minuteUTC: 15 },
  internal.alertsActions.dispatchEmails,
);

crons.weekly(
  "weekly-digest",
  { dayOfWeek: "monday", hourUTC: 7, minuteUTC: 0 },
  internal.weeklyDigestActions.runWeekly,
);

export default crons;
