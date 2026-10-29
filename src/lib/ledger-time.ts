/** Household ledger clock. Indianapolis observes US Eastern time, including DST. */
export const LEDGER_TIME_ZONE = "America/Indiana/Indianapolis";

/** Calendar date in the ledger timezone, YYYY-MM-DD. */
export function ledgerTodayIso(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: LEDGER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return "1970-01-01";
  return `${year}-${month}-${day}`;
}

export function ledgerMonthKey(now: Date = new Date()): string {
  return ledgerTodayIso(now).slice(0, 7);
}
