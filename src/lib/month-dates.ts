import { endOfMonth, format } from "date-fns";

/** Parse a YYYY-MM-DD (or longer ISO) string as a local calendar date. */
export function parseLocalIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function labelForMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return format(new Date(year, month - 1, 1), "MMMM yyyy");
}

/** Move a calendar date into `targetMonthKey` (YYYY-MM), keeping the day when possible. */
export function shiftIsoDateToMonth(isoDate: string, targetMonthKey: string): string {
  const [year, month] = targetMonthKey.split("-").map(Number);
  const source = parseLocalIsoDate(isoDate);
  const day = Number.isNaN(source.getTime()) ? 1 : source.getDate();
  const lastDay = endOfMonth(new Date(year, month - 1, 1)).getDate();
  return format(new Date(year, month - 1, Math.min(day, lastDay)), "yyyy-MM-dd");
}
