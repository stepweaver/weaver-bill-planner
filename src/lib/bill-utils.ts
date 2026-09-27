export function getEffectivePlannedAmount(
  plannedAmount: number | null,
  invoiceAmount: number | null
): number {
  if (invoiceAmount != null && invoiceAmount > 0) return invoiceAmount;
  return plannedAmount ?? 0;
}

export function coerceAmount(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Pending and paid bills with no amount paid yet take the effective amount due.
 * A non-null amountPaid is kept, including zero. Other statuses are unchanged.
 */
export function resolveAmountPaidForStatus(
  status: string,
  amountPaid: number | null,
  plannedAmount: number | null,
  invoiceAmount: number | null
): number | null {
  if (status !== "pending" && status !== "paid") return amountPaid;
  if (amountPaid != null) return amountPaid;
  return getEffectivePlannedAmount(plannedAmount, invoiceAmount);
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
