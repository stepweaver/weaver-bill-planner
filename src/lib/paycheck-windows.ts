import {
  startOfMonth,
  endOfMonth,
  parseISO,
  format,
  isBefore,
  isAfter,
} from "date-fns";

export const WINDOW_COLORS = [
  "rose",
  "blue",
  "amber",
  "green",
  "violet",
  "slate",
] as const;

export type ColorKey = (typeof WINDOW_COLORS)[number];

export interface PaycheckWindow {
  key: string;
  label: string;
  startDate: Date | null;
  endDate: Date | null;
  colorKey: ColorKey;
  incomeEventId: number | null;
}

export interface IncomeEventForWindow {
  id: number;
  expectedDate: string;
  name?: string | null;
}

export function buildPaycheckWindows(
  incomeEvents: IncomeEventForWindow[],
  monthKey: string
): PaycheckWindow[] {
  const [year, month] = monthKey.split("-").map(Number);
  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(new Date(year, month - 1));

  const sorted = [...incomeEvents].sort(
    (a, b) =>
      new Date(a.expectedDate).getTime() - new Date(b.expectedDate).getTime()
  );

  if (sorted.length === 0) {
    return [
      {
        key: "no-income",
        label: "No income",
        startDate: monthStart,
        endDate: monthEnd,
        colorKey: "slate",
        incomeEventId: null,
      },
    ];
  }

  // Group incomes by same calendar day
  const dayGroups: { date: string; events: typeof sorted }[] = [];
  for (const event of sorted) {
    const dateStr = event.expectedDate;
    const last = dayGroups[dayGroups.length - 1];
    if (last && last.date === dateStr) {
      last.events.push(event);
    } else {
      dayGroups.push({ date: dateStr, events: [event] });
    }
  }

  // Merge adjacent days (e.g. 03/05 + 03/06) into one pay period to avoid empty windows
  const MERGE_DAYS = 2; // merge if next income is within this many days
  const groups: { dates: string[]; events: typeof sorted }[] = [];
  for (const dg of dayGroups) {
    const last = groups[groups.length - 1];
    const thisDate = parseISO(dg.date);
    if (
      last &&
      last.dates.length > 0 &&
      thisDate.getTime() - parseISO(last.dates[last.dates.length - 1]!).getTime() <= MERGE_DAYS * 24 * 60 * 60 * 1000
    ) {
      last.dates.push(dg.date);
      last.events.push(...dg.events);
    } else {
      groups.push({ dates: [dg.date], events: [...dg.events] });
    }
  }

  const windows: PaycheckWindow[] = [];

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const firstEvent = group.events[0]!;
    const firstDate = parseISO(group.dates[0]!);
    const colorKey = WINDOW_COLORS[i % WINDOW_COLORS.length];
    const label = firstEvent.name ?? format(firstDate, "MMM d");

    if (i === 0) {
      windows.push({
        key: `pre-${firstEvent.id}`,
        label: `Before ${label}`,
        startDate: monthStart,
        endDate: firstDate,
        colorKey,
        incomeEventId: firstEvent.id,
      });
    }

    const nextGroup = groups[i + 1];
    const endDate = nextGroup ? parseISO(nextGroup.dates[0]!) : monthEnd;
    windows.push({
      key: `income-${firstEvent.id}`,
      label,
      startDate: firstDate,
      endDate,
      colorKey,
      incomeEventId: firstEvent.id,
    });
  }

  return windows;
}

export interface BillForAssignment {
  dueDate: string | null;
  assignedIncomeEventId?: number | null;
  assignedGroupKey?: string | null;
  manualAssignment?: boolean | null;
}

export function assignBillToWindow(
  bill: BillForAssignment,
  windows: PaycheckWindow[]
): { windowKey: string; incomeEventId: number | null } | null {
  if (bill.manualAssignment && bill.assignedGroupKey) {
    const w = windows.find((x) => x.key === bill.assignedGroupKey);
    if (w) return { windowKey: w.key, incomeEventId: w.incomeEventId };
    return {
      windowKey: bill.assignedGroupKey,
      incomeEventId: bill.assignedIncomeEventId ?? null,
    };
  }
  if (!bill.dueDate || windows.length === 0) return null;
  const due = parseISO(bill.dueDate);
  for (const w of windows) {
    if (w.startDate && isBefore(due, w.startDate)) continue;
    if (w.endDate && isAfter(due, w.endDate)) continue;
    // "Before [income]" window: bills due on the income date start that pay period
    if (w.key.startsWith("pre-") && w.endDate && !isBefore(due, w.endDate)) continue;
    // Income window endDate is the next income's date; bills due on that date go to the next window
    if (w.key.startsWith("income-") && w.endDate && !isBefore(due, w.endDate)) continue;
    if (!w.startDate && w.endDate && isAfter(due, w.endDate)) continue;
    if (w.startDate && !w.endDate && isBefore(due, w.startDate)) continue;
    return { windowKey: w.key, incomeEventId: w.incomeEventId };
  }
  const last = windows[windows.length - 1];
  return last ? { windowKey: last.key, incomeEventId: last.incomeEventId } : null;
}
