import { isoDateOnly } from "@/lib/bill-utils";
import { addLedgerDays, daysUntilLedgerDate, ledgerDayNumber } from "@/lib/ledger-date-math";
import { buildPaycheckGroups } from "@/lib/paycheck-windows";

export interface FloatPaydayEvent {
  name: string | null;
  expectedDate: string | Date;
  status: string;
}

export interface FloatPayPeriodSuggestion {
  date: string;
  /** True when inferred from a recurring pattern rather than entered in the ledger. */
  estimated: boolean;
}

/**
 * Find the first payday PERIOD after the one covering this bill.
 *
 * A bill already scheduled for a period must not be floated back to the
 * beginning of that same period. An overdue bill is currently actionable,
 * so its current planning period is the period containing today.
 *
 * When a month has not been set up, only infer future dates from two distinct
 * 7- or 14-day paydays with the same name. Projected dates are estimates,
 * never new income events or confirmed deposits.
 */
export function suggestNextFloatPayPeriod(input: {
  todayIso: string;
  dueDate: string | Date | null;
  paydayEvents: readonly FloatPaydayEvent[];
}): FloatPayPeriodSuggestion | null {
  if (ledgerDayNumber(input.todayIso) == null) return null;
  const recorded = input.paydayEvents.flatMap((event) => {
    const date = isoDateOnly(event.expectedDate);
    if (!date || ledgerDayNumber(date) == null) return [];
    return [{ date, name: event.name?.trim().toLocaleLowerCase("en-US") ?? "" }];
  });
  const groupedByName = new Map<string, string[]>();
  for (const row of recorded) {
    if (!row.name) continue;
    const dates = groupedByName.get(row.name) ?? [];
    dates.push(row.date);
    groupedByName.set(row.name, dates);
  }

  const estimatedDates: string[] = [];
  const horizon = addLedgerDays(input.todayIso, 90);
  for (const dates of groupedByName.values()) {
    const unique = [...new Set(dates)].sort();
    if (unique.length < 2) continue;
    const last = unique[unique.length - 1]!;
    const previous = unique[unique.length - 2]!;
    const interval = daysUntilLedgerDate(last, previous);
    if (interval !== 7 && interval !== 14) continue;
    if ((daysUntilLedgerDate(last, input.todayIso) ?? -999) < -35) continue;
    for (let i = 1; i <= 13; i++) {
      const next = addLedgerDays(last, interval * i);
      if (next > horizon) break;
      estimatedDates.push(next);
    }
  }

  const dates = new Map<string, boolean>();
  for (const day of estimatedDates) dates.set(day, true);
  for (const day of recorded.map((row) => row.date)) dates.set(day, false);

  const ordered = [...dates.keys()].sort();
  const groups = buildPaycheckGroups(ordered.map((expectedDate, index) => ({
    id: index + 1,
    expectedDate,
  })));
  const starts = groups.flatMap((group) => group.dates[0] ? [{
    date: group.dates[0],
    estimated: group.dates.every((date) => dates.get(date) === true),
  }] : []);

  const billDue = isoDateOnly(input.dueDate);
  const anchor = [input.todayIso, billDue]
    .filter((day): day is string => day != null && ledgerDayNumber(day) != null)
    .sort().at(-1)!;

  // The latest start <= anchor defines the bill's current paycheck period.
  // Pick the following start; a date late in a period need not push us two
  // periods out. Never select a period that's already underway.
  const current = starts.filter((item) => item.date <= anchor).at(-1);
  const target = starts.find((item) => item.date > (current?.date ?? anchor));
  if (!target || target.date <= input.todayIso) return null;
  return target;
}
