import type { PaycheckWindow } from "@/lib/paycheck-windows";

export type DashboardBill = {
  id: number;
  name: string;
  dueDate: string | null;
  plannedAmount: number | null;
  invoiceAmount: number | null;
  amountPaid: number | null;
  status: string;
  notes: string | null;
  paymentUrl: string | null;
  displayWindowKey: string | null;
  displayIncomeEventId: number | null;
  assignedIncomeEventId: number | null;
  assignedGroupKey: string | null;
  manualAssignment: boolean | null;
  templateId: number | null;
  isRecurring?: boolean | null;
  floatTargetDate: string | Date | null;
  floatedAt: string | Date | null;
  ownerMonthId: number;
  ownerMonthKey: string;
};

export type DashboardIncome = {
  id: number;
  name: string;
  expectedDate: string;
  expectedAmount: number | null;
  actualAmount: number | null;
  status: string;
  notes: string | null;
};

export type DashboardWindow = PaycheckWindow;
