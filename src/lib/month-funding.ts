import { addDays, parseISO, startOfDay } from "date-fns";
import {
  assignBillToWindow,
  type PaycheckWindow,
} from "@/lib/paycheck-windows";
import { getEffectivePlannedAmount, isBillPaid, isBillOverdue } from "@/lib/bill-utils";
import type { BillInstanceForMetrics } from "@/lib/month-metrics";

export interface BillForFunding extends BillInstanceForMetrics {
  id: number;
  name: string;
}

export function resolveBillWindowKey(
  bill: BillInstanceForMetrics,
  windows: PaycheckWindow[]
): string | null {
  return assignBillToWindow(bill, windows)?.windowKey ?? null;
}

export function isEffectivelyUnassigned(
  bill: BillInstanceForMetrics,
  windows: PaycheckWindow[]
): boolean {
  return resolveBillWindowKey(bill, windows) == null;
}

export interface PaycheckWindowSummary {
  windowKey: string;
  label: string;
  colorKey: PaycheckWindow["colorKey"];
  incomeEventId: number | null;
  /** Unpaid obligation (effective planned minus progress) assigned to this window */
  unpaidPlannedTotal: number;
  billCount: number;
  unpaidBillCount: number;
  /** Expected $ for the linked income row (same value on windows sharing an income id) */
  expectedIncome: number | null;
  /** Cushion for the paycheck: expected minus unpaid obligations across all windows with this incomeEventId (only meaningful when incomeEventId set) */
  paycheckCushion: number | null;
  /** True when expectedIncome is not null and obligations for this income id exceed it */
  overExpected: boolean;
}

function unpaidObligation(
  planned: number | null,
  invoice: number | null,
  status: string,
  amountPaid: number | null,
  dueDate: string | null
): number {
  const effective = getEffectivePlannedAmount(planned, invoice);
  if (isBillPaid(status, amountPaid, effective)) return 0;
  return Math.max(0, effective - (amountPaid ?? 0));
}

export function buildPaycheckSummaries(
  windows: PaycheckWindow[],
  bills: BillForFunding[],
  incomeRows: Array<{
    id: number;
    expectedAmount: number | null;
    actualAmount: number | null;
  }>
): PaycheckWindowSummary[] {
  const incomeById = new Map(incomeRows.map((e) => [e.id, e]));

  const billsWithKey = bills.map((b) => ({
    bill: b,
    key: resolveBillWindowKey(b, windows),
  }));

  const unpaidByIncomeId = new Map<number, number>();
  for (const { bill, key } of billsWithKey) {
    if (key == null) continue;
    const win = windows.find((w) => w.key === key);
    const iid = win?.incomeEventId;
    if (iid == null) continue;
    const u = unpaidObligation(
      bill.plannedAmount,
      bill.invoiceAmount,
      bill.status,
      bill.amountPaid,
      bill.dueDate
    );
    unpaidByIncomeId.set(iid, (unpaidByIncomeId.get(iid) ?? 0) + u);
  }

  return windows.map((w) => {
    const mine = billsWithKey.filter(({ key }) => key === w.key);
    let unpaidPlannedTotal = 0;
    let unpaidBillCount = 0;
    for (const { bill } of mine) {
      const u = unpaidObligation(
        bill.plannedAmount,
        bill.invoiceAmount,
        bill.status,
        bill.amountPaid,
        bill.dueDate
      );
      unpaidPlannedTotal += u;
      if (u > 0) unpaidBillCount++;
    }
    const expected =
      w.incomeEventId != null
        ? (incomeById.get(w.incomeEventId)?.expectedAmount ?? null)
        : null;
    const totalUnpaidForPaycheck =
      w.incomeEventId != null ? (unpaidByIncomeId.get(w.incomeEventId) ?? 0) : null;
    const cushion =
      expected != null && totalUnpaidForPaycheck != null
        ? expected - totalUnpaidForPaycheck
        : null;
    const overExpected =
      expected != null &&
      totalUnpaidForPaycheck != null &&
      totalUnpaidForPaycheck > expected;

    return {
      windowKey: w.key,
      label: w.label,
      colorKey: w.colorKey,
      incomeEventId: w.incomeEventId,
      unpaidPlannedTotal,
      billCount: mine.length,
      unpaidBillCount,
      expectedIncome: expected,
      paycheckCushion: cushion,
      overExpected,
    };
  });
}

const DUE_SOON_DAYS = 7;

export interface MonthAttention {
  overdueIds: number[];
  dueSoonIds: number[];
  unassignedIds: number[];
  missingAmountIds: number[];
  overCapacityWindowKeys: string[];
}

export function buildMonthAttention(
  windows: PaycheckWindow[],
  bills: BillForFunding[],
  summaries: PaycheckWindowSummary[]
): MonthAttention {
  const today = startOfDay(new Date());
  const soonEnd = addDays(today, DUE_SOON_DAYS);

  const overdueIds: number[] = [];
  const dueSoonIds: number[] = [];
  const unassignedIds: number[] = [];
  const missingAmountIds: number[] = [];

  for (const b of bills) {
    const effective = getEffectivePlannedAmount(b.plannedAmount, b.invoiceAmount);
    const paid = isBillPaid(b.status, b.amountPaid, effective);

    if (isBillOverdue(b.dueDate, b.status, b.amountPaid, effective)) {
      overdueIds.push(b.id);
    }
    if (
      !paid &&
      b.dueDate &&
      !isBillOverdue(b.dueDate, b.status, b.amountPaid, effective)
    ) {
      const due = startOfDay(parseISO(b.dueDate));
      if (due >= today && due <= soonEnd) {
        dueSoonIds.push(b.id);
      }
    }
    if (isEffectivelyUnassigned(b, windows)) {
      unassignedIds.push(b.id);
    }
    if (!paid && effective <= 0) {
      missingAmountIds.push(b.id);
    }
  }

  const overCapacityWindowKeys = summaries
    .filter((s) => s.overExpected)
    .map((s) => s.windowKey);

  return {
    overdueIds,
    dueSoonIds,
    unassignedIds,
    missingAmountIds,
    overCapacityWindowKeys,
  };
}
