import { endOfMonth, setMonth, setYear, parseISO } from "date-fns";

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

  const billInstances: DraftBillInstance[] = sourceBills
    .filter((b) => b.isRecurring !== false)
    .map((b) => {
      let dueDate: Date;
      if (b.dueDate) {
        const sourceDue = parseISO(b.dueDate);
        const day = sourceDue.getDate();
        dueDate = setYear(setMonth(new Date(year, month - 1, 1), month - 1), year);
        dueDate.setDate(Math.min(day, targetMonthEnd.getDate()));
      } else {
        dueDate = targetMonthEnd;
      }
      return {
        templateId: b.templateId,
        name: b.name,
        dueDate: dueDate.toISOString().slice(0, 10),
        plannedAmount: b.plannedAmount,
        paymentUrl: b.paymentUrl,
        isRecurring: true,
      };
    });

  const incomeEvents: DraftIncomeEvent[] = sourceIncome.map((e) => {
    const sourceDate = parseISO(e.expectedDate);
    const targetDate = setYear(
      setMonth(
        new Date(year, month - 1, sourceDate.getDate()),
        month - 1
      ),
      year
    );
    const clamped =
      targetDate > targetMonthEnd ? targetMonthEnd : targetDate;
    return {
      name: e.name,
      expectedDate: clamped.toISOString().slice(0, 10),
      expectedAmount: e.expectedAmount,
    };
  });

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const label = `${monthNames[month - 1]} ${year}`;

  return {
    targetMonthKey,
    label,
    billInstances,
    incomeEvents,
  };
}
