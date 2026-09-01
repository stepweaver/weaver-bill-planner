import { endOfMonth, format } from "date-fns";
import { labelForMonthKey, shiftIsoDateToMonth } from "@/lib/month-dates";

export interface DraftBillInstance {
  templateId: number | null;
  name: string;
  dueDate: string;
  plannedAmount: number | null;
  paymentUrl: string | null;
  isRecurring: boolean;
}

export interface DraftIncomeEvent {
  name: string;
  expectedDate: string;
  expectedAmount: number | null;
}

export interface PropagateResult {
  targetMonthKey: string;
  label: string;
  billInstances: DraftBillInstance[];
  incomeEvents: DraftIncomeEvent[];
}

export interface SourceBillInstance {
  templateId: number | null;
  name: string;
  dueDate: string | null;
  plannedAmount: number | null;
  paymentUrl: string | null;
  isRecurring: boolean | null;
}

export interface SourceIncomeEvent {
  name: string;
  expectedDate: string;
  expectedAmount: number | null;
}

export function propagateMonth(
  sourceBills: SourceBillInstance[],
  sourceIncome: SourceIncomeEvent[],
  targetMonthKey: string
): PropagateResult {
  const [year, month] = targetMonthKey.split("-").map(Number);
  const targetMonthStart = new Date(year, month - 1, 1);
  const targetMonthEnd = endOfMonth(targetMonthStart);

  const monthEndIso = format(targetMonthEnd, "yyyy-MM-dd");

  const billInstances: DraftBillInstance[] = sourceBills
    .filter((b) => b.isRecurring !== false)
    .map((b) => ({
      templateId: b.templateId,
      name: b.name,
      dueDate: b.dueDate
        ? shiftIsoDateToMonth(b.dueDate, targetMonthKey)
        : monthEndIso,
      plannedAmount: b.plannedAmount,
      paymentUrl: b.paymentUrl,
      isRecurring: true,
    }));

  const incomeEvents: DraftIncomeEvent[] = sourceIncome.map((e) => ({
    name: e.name,
    expectedDate: shiftIsoDateToMonth(e.expectedDate, targetMonthKey),
    expectedAmount: e.expectedAmount,
  }));

  const label = labelForMonthKey(targetMonthKey);

  return {
    targetMonthKey,
    label,
    billInstances,
    incomeEvents,
  };
}
