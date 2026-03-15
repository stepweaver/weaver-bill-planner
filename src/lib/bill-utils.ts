export function getEffectivePlannedAmount(
  plannedAmount: number | null,
  invoiceAmount: number | null
): number {
  if (invoiceAmount != null && invoiceAmount > 0) return invoiceAmount;
  return plannedAmount ?? 0;
}

export function isBillPaid(
  status: string,
  amountPaid: number | null,
  effectivePlanned: number
): boolean {
  if (status === "paid") return true;
  if (amountPaid != null && amountPaid >= effectivePlanned) return true;
  return false;
}

export function isBillOverdue(
  dueDate: string | null,
  status: string,
  amountPaid: number | null,
  effectivePlanned: number
): boolean {
  if (!dueDate) return false;
  if (isBillPaid(status, amountPaid, effectivePlanned)) return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}
