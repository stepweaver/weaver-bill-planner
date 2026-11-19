import { format } from "date-fns";
import { isoDateOnly } from "@/lib/bill-utils";
import { parseLocalIsoDate } from "@/lib/month-dates";
import { centsToDollars } from "@/lib/money";

export function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatCents(cents: number) {
  return formatMoney(centsToDollars(cents));
}

export function formatShortDate(value: string | Date | null | undefined) {
  const iso = isoDateOnly(value);
  if (!iso) return "No date";
  return format(parseLocalIsoDate(iso), "MMM d");
}
